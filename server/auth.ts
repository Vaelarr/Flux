import { randomInt, randomUUID } from "node:crypto";
import type { Client, Row, Transaction } from "@libsql/client";
import { analyzeNistPassword } from "../src/utils/security.js";
import type { UserAccount, SecuritySession } from "../src/types.js";
import { checkPassword, equalHash, hashPassword, opaqueToken, secretHash } from "./crypto.js";
import type { RecoveryMailer } from "./mail.js";
import type { VerifiedIdentity } from "./identity.js";

export class AuthError extends Error {
  constructor(public status: number, message: string, public details: Record<string, unknown> = {}) {
    super(message);
  }
}

export interface AuthContext {
  ip: string;
  userAgent: string;
  sessionToken?: string;
  resetGrant?: string;
}

interface AuthOptions {
  database: Client;
  secret: string;
  mailer: RecoveryMailer;
  verifyIdentity: (token: string) => Promise<VerifiedIdentity>;
  now?: () => number;
  recoveryDelayMs?: number;
}

export const RESET_TTL = 15 * 60 * 1000;
const LOGIN_ERROR = "Check your email and password, or reset your password.";
const RESET_ERROR = "This reset link or code is invalid or expired. Request a new one.";

export function normalizedEmail(value: unknown) {
  if (typeof value !== "string" || value.length > 254) throw new AuthError(400, "Enter a valid email address.");
  const email = value.trim().toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) throw new AuthError(400, "Enter a valid email address.");
  return email;
}

function passwordValue(value: unknown, email: string) {
  if (typeof value !== "string" || value.length > 1024 || !analyzeNistPassword(value, email).allCriticalMet) {
    throw new AuthError(400, "Use at least 15 characters and avoid common passwords.");
  }
  return value;
}

export class AuthService {
  private readonly db: Client;
  private readonly now: () => number;
  private dummyHash?: Promise<string>;

  constructor(private readonly options: AuthOptions) {
    if (options.secret.length < 32) throw new Error("AUTH_SECRET must have at least 32 characters.");
    this.db = options.database;
    this.now = options.now ?? Date.now;
  }

  private hash(value: string) {
    return secretHash(this.options.secret, value);
  }

  private async rate(key: string, maximum: number, windowMs = RESET_TTL) {
    const now = this.now();
    const start = Math.floor(now / windowMs) * windowMs;
    const result = await this.db.execute({
      sql: "INSERT INTO flux_rate_limits (key, window_start, count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN window_start = excluded.window_start THEN count + 1 ELSE 1 END, window_start = excluded.window_start RETURNING count",
      args: [this.hash("rate:" + key), start],
    });
    if (Number(result.rows[0].count) > maximum) {
      throw new AuthError(429, "Too many requests. Please wait and try again.", {
        retryAfter: Math.max(1, Math.ceil((start + windowMs - now) / 1000)),
      });
    }
  }

  private async account(id: string): Promise<UserAccount> {
    const result = await this.db.execute({
      sql: "SELECT a.*, (SELECT count(*) FROM flux_sessions s WHERE s.user_id = a.id AND s.expires_at > ?) AS session_count FROM flux_accounts a WHERE a.id = ?",
      args: [this.now(), id],
    });
    const row = result.rows[0];
    if (!row) throw new AuthError(401, "Please sign in.");
    return {
      id: String(row.id), name: String(row.name), email: String(row.email),
      createdAt: new Date(Number(row.created_at)).toISOString(),
      sessionsCount: Number(row.session_count),
      provider: row.provider as UserAccount["provider"],
      avatarUrl: row.avatar_url ? String(row.avatar_url) : undefined,
      lastPasswordReset: row.last_password_reset ? new Date(Number(row.last_password_reset)).toISOString() : undefined,
    };
  }

  private async createSession(userId: string, remember: boolean, context: AuthContext) {
    const token = opaqueToken();
    const duration = remember ? 30 * 24 * 60 * 60 : 24 * 60 * 60;
    await this.db.execute({
      sql: "INSERT INTO flux_sessions (token_hash, user_id, user_agent, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
      args: [this.hash("session:" + token), userId, context.userAgent.slice(0, 300), this.now(), this.now() + duration * 1000],
    });
    return { user: await this.account(userId), token, maxAge: remember ? duration : undefined };
  }

  async register(body: Record<string, unknown>, context: AuthContext) {
    await this.rate("register:" + context.ip, 10);
    const email = normalizedEmail(body.email);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 2 || name.length > 100) throw new AuthError(400, "Enter a name between 2 and 100 characters.");
    const password = passwordValue(body.password, email);
    const encoded = await hashPassword(password);
    const id = randomUUID();
    try {
      await this.db.execute({
        sql: "INSERT INTO flux_accounts (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
        args: [id, name, email, encoded, this.now()],
      });
    } catch (error) {
      if (String((error as { code?: string }).code).includes("CONSTRAINT")) {
        throw new AuthError(409, "This email is already registered. Sign in or reset your password.");
      }
      throw error;
    }
    return { user: await this.account(id) };
  }

  async login(body: Record<string, unknown>, context: AuthContext) {
    await this.rate("login-ip:" + context.ip, 30);
    const email = normalizedEmail(body.email);
    await this.rate("login-email:" + email, 10);
    if (typeof body.password !== "string" || body.password.length > 1024) throw new AuthError(401, LOGIN_ERROR);
    this.dummyHash ??= hashPassword(opaqueToken());
    const dummy = await this.dummyHash;
    const result = await this.db.execute({ sql: "SELECT id, password_hash FROM flux_accounts WHERE email = ?", args: [email] });
    const row = result.rows[0];
    const valid = await checkPassword(body.password, row?.password_hash ? String(row.password_hash) : dummy);
    if (!row?.password_hash || !valid) throw new AuthError(401, LOGIN_ERROR);
    return this.createSession(String(row.id), body.remember === true, context);
  }

  async social(body: Record<string, unknown>, context: AuthContext) {
    await this.rate("social:" + context.ip, 20);
    if (typeof body.token !== "string" || body.token.length > 8192) throw new AuthError(401, "Social sign-in could not be verified.");
    let identity: VerifiedIdentity;
    try {
      identity = await this.options.verifyIdentity(body.token);
    } catch {
      throw new AuthError(401, "Social sign-in could not be verified. Try again.");
    }
    const email = normalizedEmail(identity.email);
    const transaction = await this.db.transaction("write");
    let userId: string;
    try {
      const existing = await transaction.execute({
        sql: "SELECT id, firebase_uid FROM flux_accounts WHERE email = ? OR firebase_uid = ?",
        args: [email, identity.uid],
      });
      if (existing.rows.length > 1) throw new AuthError(409, "These accounts need to be linked before signing in.");
      if (existing.rows[0]) {
        // A matching email alone must not link an unverified password account.
        // Otherwise a pre-created account could retain an attacker's password.
        if (existing.rows[0].firebase_uid !== identity.uid) {
          throw new AuthError(409, "This email already has an account. Sign in with email or reset your password.");
        }
        userId = String(existing.rows[0].id);
        await transaction.execute({
          sql: "UPDATE flux_accounts SET firebase_uid = ?, avatar_url = COALESCE(?, avatar_url) WHERE id = ?",
          args: [identity.uid, identity.avatarUrl ?? null, userId],
        });
      } else {
        userId = randomUUID();
        await transaction.execute({
          sql: "INSERT INTO flux_accounts (id, name, email, provider, firebase_uid, avatar_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          args: [userId, identity.name.slice(0, 100), email, identity.provider, identity.uid, identity.avatarUrl ?? null, this.now()],
        });
      }
      await transaction.commit();
    } finally {
      transaction.close();
    }
    return this.createSession(userId!, body.remember === true, context);
  }

  async session(context: AuthContext) {
    if (!context.sessionToken) throw new AuthError(401, "Please sign in.");
    const result = await this.db.execute({
      sql: "SELECT user_id FROM flux_sessions WHERE token_hash = ? AND expires_at > ?",
      args: [this.hash("session:" + context.sessionToken), this.now()],
    });
    if (!result.rows[0]) throw new AuthError(401, "Please sign in.");
    return { user: await this.account(String(result.rows[0].user_id)) };
  }

  async logout(context: AuthContext) {
    if (context.sessionToken) {
      await this.db.execute({ sql: "DELETE FROM flux_sessions WHERE token_hash = ?", args: [this.hash("session:" + context.sessionToken)] });
    }
    return { success: true };
  }

  async requestReset(body: Record<string, unknown>, context: AuthContext) {
    const start = Date.now();
    try {
      await this.rate("reset-ip:" + context.ip, 20);
      const email = normalizedEmail(body.email);
      await this.rate("reset-email-minute:" + email, 1, 60 * 1000);
      await this.rate("reset-email:" + email, 5);
      this.options.mailer.assertConfigured();
      const result = await this.db.execute({ sql: "SELECT id FROM flux_accounts WHERE email = ?", args: [email] });
      const row = result.rows[0];
      if (row) {
        const token = opaqueToken();
        const code = String(randomInt(100000, 1000000));
        const tokenHash = this.hash("reset:" + token);
        await this.db.execute({
          sql: "INSERT INTO flux_password_resets (user_id, code_hash, token_hash, expires_at, attempts, grant_hash, consumed_at) VALUES (?, ?, ?, ?, 0, NULL, NULL) ON CONFLICT(user_id) DO UPDATE SET code_hash = excluded.code_hash, token_hash = excluded.token_hash, expires_at = excluded.expires_at, attempts = 0, grant_hash = NULL, consumed_at = NULL",
          args: [String(row.id), this.hash("code:" + email + ":" + code), tokenHash, this.now() + RESET_TTL],
        });
        try {
          await this.options.mailer.send({ email, token, code });
        } catch {
          await this.db.execute({ sql: "DELETE FROM flux_password_resets WHERE token_hash = ?", args: [tokenHash] });
          throw new AuthError(503, "Recovery email is unavailable. Please try again later.");
        }
      }
      // Do not return account existence, codes, or recovery tokens to the browser.
      return { success: true, expiresIn: RESET_TTL / 1000, retryAfter: 60 };
    } finally {
      const delay = (this.options.recoveryDelayMs ?? 600) - (Date.now() - start);
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  private checkReset(row: Row | undefined) {
    if (!row || row.consumed_at || Number(row.expires_at) <= this.now()) {
      throw new AuthError(400, RESET_ERROR, { isExpired: true });
    }
    if (Number(row.attempts) >= 5) {
      throw new AuthError(400, "Too many attempts. Request a new code.", { isLockedOut: true, attemptsRemaining: 0 });
    }
  }

  private async devices(userId: string, context: AuthContext): Promise<SecuritySession[]> {
    const result = await this.db.execute({
      sql: "SELECT token_hash, user_agent, created_at FROM flux_sessions WHERE user_id = ? AND expires_at > ? ORDER BY created_at DESC",
      args: [userId, this.now()],
    });
    const current = context.sessionToken ? this.hash("session:" + context.sessionToken) : "";
    return result.rows.map((row) => {
      const agent = String(row.user_agent || "");
      const browser = /Edg\//.test(agent) ? "Edge" : /Firefox\//.test(agent) ? "Firefox" :
        /Chrome\//.test(agent) ? "Chrome" : /Safari\//.test(agent) ? "Safari" : "Browser";
      const device = /iPhone/.test(agent) ? "iPhone" : /iPad/.test(agent) ? "iPad" :
        /Android/.test(agent) ? "Android" : /Windows/.test(agent) ? "Windows" :
        /Macintosh|Mac OS/.test(agent) ? "Mac" : /Linux/.test(agent) ? "Linux" : "Unknown device";
      return {
      id: String(row.token_hash).slice(0, 16),
      device: browser + " on " + device,
      browser,
      location: "",
      lastActive: new Date(Number(row.created_at)).toISOString(),
      isCurrent: String(row.token_hash) === current,
      };
    });
  }

  async verifyReset(body: Record<string, unknown>, context: AuthContext) {
    await this.rate("verify-reset:" + context.ip, 30);
    const token = typeof body.token === "string" ? body.token : "";
    const email = token ? "" : normalizedEmail(body.email);
    if (token.length > 128 || (!token && (typeof body.code !== "string" || !/^\d{6}$/.test(body.code)))) {
      throw new AuthError(400, "Enter the 6-digit code from your email.");
    }
    const transaction = await this.db.transaction("write");
    let userId = "";
    let grant = "";
    let expiresAt = 0;
    let verifiedEmail = "";
    try {
      const result = await transaction.execute({
        sql: token
          ? "SELECT r.*, a.email FROM flux_password_resets r JOIN flux_accounts a ON a.id = r.user_id WHERE r.token_hash = ?"
          : "SELECT r.*, a.email FROM flux_password_resets r JOIN flux_accounts a ON a.id = r.user_id WHERE a.email = ?",
        args: [token ? this.hash("reset:" + token) : email],
      });
      const row = result.rows[0];
      this.checkReset(row);
      if (!token && !equalHash(String(row.code_hash), this.hash("code:" + email + ":" + body.code))) {
        const attempts = Number(row.attempts) + 1;
        await transaction.execute({ sql: "UPDATE flux_password_resets SET attempts = ? WHERE user_id = ?", args: [attempts, String(row.user_id)] });
        await transaction.commit();
        throw new AuthError(400, attempts >= 5 ? "Too many attempts. Request a new code." : "Code not recognised. Try again.", {
          attemptsRemaining: Math.max(0, 5 - attempts), isLockedOut: attempts >= 5,
        });
      }
      userId = String(row.user_id);
      verifiedEmail = String(row.email);
      expiresAt = Number(row.expires_at);
      grant = opaqueToken();
      await transaction.execute({ sql: "UPDATE flux_password_resets SET grant_hash = ? WHERE user_id = ?", args: [this.hash("grant:" + grant), userId] });
      await transaction.commit();
    } finally {
      transaction.close();
    }
    return { success: true, grant, email: verifiedEmail, expiresIn: Math.max(1, Math.ceil((expiresAt - this.now()) / 1000)), sessions: await this.devices(userId, context) };
  }

  async completeReset(body: Record<string, unknown>, context: AuthContext) {
    if (!context.resetGrant) throw new AuthError(400, RESET_ERROR, { isExpired: true });
    const grantHash = this.hash("grant:" + context.resetGrant);
    const result = await this.db.execute({
      sql: "SELECT r.*, a.email FROM flux_password_resets r JOIN flux_accounts a ON a.id = r.user_id WHERE r.grant_hash = ?",
      args: [grantHash],
    });
    const row = result.rows[0];
    this.checkReset(row);
    const password = passwordValue(body.password, String(row.email));
    const encoded = await hashPassword(password);
    const transaction: Transaction = await this.db.transaction("write");
    try {
      const checked = await transaction.execute({ sql: "SELECT * FROM flux_password_resets WHERE grant_hash = ?", args: [grantHash] });
      this.checkReset(checked.rows[0]);
      await transaction.execute({
        sql: "UPDATE flux_accounts SET password_hash = ?, last_password_reset = ? WHERE id = ?",
        args: [encoded, this.now(), String(row.user_id)],
      });
      await transaction.execute({
        sql: "UPDATE flux_password_resets SET consumed_at = ?, grant_hash = NULL WHERE user_id = ?",
        args: [this.now(), String(row.user_id)],
      });
      if (body.revokeSessions !== false) {
        await transaction.execute({ sql: "DELETE FROM flux_sessions WHERE user_id = ?", args: [String(row.user_id)] });
      }
      await transaction.commit();
    } finally {
      transaction.close();
    }
    return { success: true, sessionsRevoked: body.revokeSessions !== false };
  }
}
