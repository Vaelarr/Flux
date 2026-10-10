import assert from "node:assert/strict"
import { createServer } from "node:http"
import { test } from "node:test"
import { createClient, type TransactionMode } from "@libsql/client"
import {
  AuthError,
  AuthService,
  RESET_TTL,
  type AuthContext,
} from "../server/auth.js"
import { checkPassword } from "../server/crypto.js"
import { initializeDatabase } from "../server/db.js"
import { createAuthHandler } from "../server/http.js"
import {
  createRecoveryMailer,
  smtpOptions,
  type RecoveryEmail,
} from "../server/mail.js"
import { renderRecoveryEmail } from "../server/recovery-email.js"

const PASSWORD = "Cedar-Lantern-82!river"
const NEXT_PASSWORD = "Orchard-Timber-93!cloud"
const context: AuthContext = {
  ip: "test-client",
  userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/130.0",
}

async function fixture() {
  const database = createClient({ url: "file::memory:" })
  await initializeDatabase(database)
  let now = Date.now()
  let mailFails = false
  const emails: RecoveryEmail[] = []
  const options = {
    database,
    secret: "test-secret-at-least-thirty-two-characters-long",
    now: () => now,
    recoveryDelayMs: 0,
    mailer: {
      assertConfigured() {},
      async send(message: RecoveryEmail) {
        if (mailFails) throw new Error("Mock SMTP failure")
        emails.push(message)
      },
    },
    async verifyIdentity(token: string) {
      if (token !== "verified-token") throw new Error("Invalid token")
      return {
        uid: "verified-uid",
        email: "social@example.com",
        name: "Social User",
        provider: "google" as const,
      }
    },
  }
  const service = new AuthService(options)
  return {
    database,
    service,
    emails,
    advance: (milliseconds: number) => {
      now += milliseconds
    },
    failMail: () => {
      mailFails = true
    },
    freshService: () => new AuthService(options),
    register: (email = "user@example.com") =>
      service.register(
        { name: "Test User", email, password: PASSWORD },
        context,
      ),
    close: () => database.close(),
  }
}

function rejectsStatus(
  operation: Promise<unknown>,
  status: number,
  details?: string,
) {
  return assert.rejects(
    operation,
    (error: unknown) =>
      error instanceof AuthError &&
      error.status === status &&
      (!details || error.details[details] === true),
  )
}

test("accounts persist salted password hashes and duplicate emails cannot overwrite them", async () => {
  const f = await fixture()
  try {
    const result = await f.register(" User@Example.com ")
    assert.equal(result.user.email, "user@example.com")
    assert.equal("password" in result.user, false)
    const row = (await f.database.execute("SELECT * FROM flux_accounts"))
      .rows[0]
    assert.match(String(row.password_hash), /^scrypt\$131072\$8\$1\$/)
    assert.equal(await checkPassword(PASSWORD, String(row.password_hash)), true)
    assert.equal(JSON.stringify(row).includes(PASSWORD), false)
    await rejectsStatus(
      f.service.register(
        {
          name: "Changed User",
          email: "USER@example.com",
          password: NEXT_PASSWORD,
        },
        context,
      ),
      409,
    )
    const unchanged = (
      await f.database.execute("SELECT password_hash FROM flux_accounts")
    ).rows[0]
    assert.equal(unchanged.password_hash, row.password_hash)
    await rejectsStatus(
      f.service.register(
        {
          name: "Test User",
          email: "other@example.com",
          password: "password123",
        },
        context,
      ),
      400,
    )
    await rejectsStatus(
      f.service.register(
        {
          name: "Test User",
          email: "other@example.com",
          password: "short-82!",
        },
        context,
      ),
      400,
    )
    await rejectsStatus(
      f.service.register(
        {
          name: "Test User",
          email: "other@example.com",
          password: "aaaaaaaaaaaaaaaa",
        },
        context,
      ),
      400,
    )
  } finally {
    f.close()
  }
})

test("login uses one generic error and sessions persist across service instances, expire, and log out", async () => {
  const f = await fixture()
  try {
    await f.register()
    const failures = await Promise.allSettled([
      f.service.login(
        { email: "user@example.com", password: "wrong" },
        context,
      ),
      f.service.login(
        { email: "unknown@example.com", password: "wrong" },
        context,
      ),
    ])
    assert.equal(
      (failures[0] as PromiseRejectedResult).reason.message,
      (failures[1] as PromiseRejectedResult).reason.message,
    )
    const signedIn = await f.service.login(
      { email: "user@example.com", password: PASSWORD, remember: true },
      context,
    )
    assert.equal(signedIn.maxAge, 30 * 86400)
    const signedContext = { ...context, sessionToken: signedIn.token }
    assert.equal(
      (await f.freshService().session(signedContext)).user.id,
      signedIn.user.id,
    )
    const rows = (await f.database.execute("SELECT * FROM flux_sessions")).rows
    assert.equal(JSON.stringify(rows).includes(signedIn.token), false)
    await f.service.logout(signedContext)
    await rejectsStatus(f.service.session(signedContext), 401)
    const second = await f.service.login(
      { email: "user@example.com", password: PASSWORD },
      context,
    )
    assert.equal(second.maxAge, undefined)
    f.advance(86400 * 1000 + 1)
    await rejectsStatus(
      f.service.session({ ...context, sessionToken: second.token }),
      401,
    )
  } finally {
    f.close()
  }
})

test("recovery responses disclose no secrets or account existence; rate limits survive service restarts", async () => {
  const f = await fixture()
  try {
    await f.register()
    const known = await f.service.requestReset(
      { email: "user@example.com" },
      context,
    )
    const unknown = await f.service.requestReset(
      { email: "unknown@example.com" },
      context,
    )
    assert.deepEqual(known, unknown)
    assert.equal(f.emails.length, 1)
    assert.match(f.emails[0].code, /^\d{6}$/)
    const saved = JSON.stringify(
      (await f.database.execute("SELECT * FROM flux_password_resets")).rows,
    )
    assert.equal(saved.includes(f.emails[0].code), false)
    assert.equal(saved.includes(f.emails[0].token), false)
    assert.equal(saved.includes(f.emails[0].cancelToken), false)
    await rejectsStatus(
      f.freshService().requestReset({ email: "user@example.com" }, context),
      429,
    )
  } finally {
    f.close()
  }
})

test("five wrong recovery codes lock the challenge, including its link; a resend replaces it", async () => {
  const f = await fixture()
  try {
    await f.register()
    await f.service.requestReset({ email: "user@example.com" }, context)
    const original = f.emails[0]
    const wrong = original.code === "111111" ? "222222" : "111111"
    for (let attempt = 1; attempt <= 5; attempt++) {
      await assert.rejects(
        f
          .freshService()
          .verifyReset({ email: original.email, code: wrong }, context),
        (error: unknown) =>
          error instanceof AuthError &&
          error.details.attemptsRemaining === 5 - attempt,
      )
    }
    await rejectsStatus(
      f.service.verifyReset({ token: original.token }, context),
      400,
      "isLockedOut",
    )
    f.advance(61000)
    await f.service.requestReset({ email: original.email }, context)
    await rejectsStatus(
      f.service.verifyReset({ token: original.token }, context),
      400,
    )
    assert.equal(
      (await f.service.verifyReset({ token: f.emails[1].token }, context))
        .email,
      original.email,
    )
  } finally {
    f.close()
  }
})

test("reset completion requires verified proof, changes the password, revokes real sessions and blocks replay", async () => {
  const f = await fixture()
  try {
    await f.register()
    const first = await f.service.login(
      { email: "user@example.com", password: PASSWORD },
      context,
    )
    const second = await f.service.login(
      { email: "user@example.com", password: PASSWORD },
      { ...context, userAgent: "iPhone Safari/17.0" },
    )
    await rejectsStatus(
      f.service.completeReset(
        { email: "user@example.com", password: NEXT_PASSWORD },
        context,
      ),
      400,
    )
    await f.service.requestReset({ email: "user@example.com" }, context)
    const mail = f.emails[0]
    const proof = await f.service.verifyReset(
      { email: mail.email, code: mail.code },
      { ...context, sessionToken: first.token },
    )
    assert.equal(proof.sessions.length, 2)
    assert.equal(
      proof.sessions.filter((session) => session.isCurrent).length,
      1,
    )
    const grantContext = { ...context, resetGrant: proof.grant }
    const completed = await f.service.completeReset(
      { password: NEXT_PASSWORD, revokeSessions: true },
      grantContext,
    )
    assert.equal(completed.sessionsRevoked, true)
    await rejectsStatus(
      f.service.session({ ...context, sessionToken: first.token }),
      401,
    )
    await rejectsStatus(
      f.service.session({ ...context, sessionToken: second.token }),
      401,
    )
    await rejectsStatus(
      f.service.login({ email: mail.email, password: PASSWORD }, context),
      401,
    )
    assert.equal(
      (
        await f.service.login(
          { email: mail.email, password: NEXT_PASSWORD },
          context,
        )
      ).user.email,
      mail.email,
    )
    await rejectsStatus(
      f.service.completeReset({ password: PASSWORD }, grantContext),
      400,
    )
    await rejectsStatus(
      f.service.verifyReset({ token: mail.token }, context),
      400,
    )
  } finally {
    f.close()
  }
})

test("expired codes and grants are rejected by the server", async () => {
  const f = await fixture()
  try {
    await f.register()
    await f.service.requestReset({ email: "user@example.com" }, context)
    const proof = await f.service.verifyReset(
      { token: f.emails[0].token },
      context,
    )
    f.advance(RESET_TTL + 1)
    await rejectsStatus(
      f.service.verifyReset({ token: f.emails[0].token }, context),
      400,
      "isExpired",
    )
    await rejectsStatus(
      f.service.completeReset({ password: NEXT_PASSWORD }, {
        ...context,
        resetGrant: proof.grant,
      }),
      400,
      "isExpired",
    )
  } finally {
    f.close()
  }
})

test("users can retain existing sessions when they choose to", async () => {
  const f = await fixture()
  try {
    await f.register()
    const signed = await f.service.login(
      { email: "user@example.com", password: PASSWORD },
      context,
    )
    await f.service.requestReset({ email: "user@example.com" }, context)
    const proof = await f.service.verifyReset(
      { token: f.emails[0].token },
      context,
    )
    const result = await f.service.completeReset(
      { password: NEXT_PASSWORD, revokeSessions: false },
      { ...context, resetGrant: proof.grant },
    )
    assert.equal(result.sessionsRevoked, false)
    assert.equal(
      (await f.service.session({ ...context, sessionToken: signed.token })).user
        .email,
      "user@example.com",
    )
  } finally {
    f.close()
  }
})

test("SMTP failures do not report success or leave usable recovery challenges", async () => {
  const f = await fixture()
  try {
    await f.register()
    f.failMail()
    await rejectsStatus(
      f.service.requestReset({ email: "user@example.com" }, context),
      503,
    )
    assert.equal(
      (
        await f.database.execute(
          "SELECT count(*) AS n FROM flux_password_resets",
        )
      ).rows[0].n,
      0,
    )
  } finally {
    f.close()
  }
})

test("social accounts come from verified identities, never an email supplied by the browser", async () => {
  const f = await fixture()
  try {
    await rejectsStatus(
      f.service.social(
        { email: "victim@example.com", provider: "google", token: "forged" },
        context,
      ),
      401,
    )
    const result = await f.service.social(
      { email: "victim@example.com", token: "verified-token" },
      context,
    )
    assert.equal(result.user.email, "social@example.com")
    assert.equal(result.user.provider, "google")
    const repeated = await f.service.social(
      { token: "verified-token" },
      context,
    )
    assert.equal(repeated.user.id, result.user.id)
    assert.equal(
      (await f.database.execute("SELECT count(*) AS n FROM flux_accounts"))
        .rows[0].n,
      1,
    )
  } finally {
    f.close()
  }
})

test("social sign-in cannot attach to a password account using only a matching email", async () => {
  const f = await fixture()
  try {
    await f.register("social@example.com")
    await rejectsStatus(
      f.service.social({ token: "verified-token" }, context),
      409,
    )
    assert.equal(
      (await f.database.execute("SELECT firebase_uid FROM flux_accounts"))
        .rows[0].firebase_uid,
      null,
    )
  } finally {
    f.close()
  }
})

test("Google linking prompt requires password proof, links identity, and honors remember preference", async () => {
  const f = await fixture()
  try {
    await f.register("social@example.com")
    // Without password, prompt returns 409 requesting account link
    await rejectsStatus(
      f.service.social({ token: "verified-token" }, context),
      409,
      "needsAccountLink",
    )

    // Wrong password fails with 401
    await rejectsStatus(
      f.service.social(
        { token: "verified-token", password: "wrong-password" },
        context,
      ),
      401,
    )

    // Correct password with remember: true links the account and issues a 30-day session
    const linked = await f.service.social(
      { token: "verified-token", password: PASSWORD, remember: true },
      context,
    )
    assert.equal(linked.user.email, "social@example.com")
    assert.equal(linked.maxAge, 30 * 86400)
    const accountRow = (
      await f.database.execute(
        "SELECT firebase_uid FROM flux_accounts WHERE email = 'social@example.com'",
      )
    ).rows[0]
    assert.equal(accountRow.firebase_uid, "verified-uid")

    // Subsequent Google sign-in does not need password and honors remember: false
    const returnLogin = await f.service.social(
      { token: "verified-token", remember: false },
      context,
    )
    assert.equal(returnLogin.user.email, "social@example.com")
    assert.equal(returnLogin.maxAge, undefined)
  } finally {
    f.close()
  }
})

test("Google sign-in honors Keep me signed in preference on new accounts and over HTTP API", async () => {
  const f = await fixture()
  try {
    const sessionDefault = await f.service.social(
      { token: "verified-token" },
      context,
    )
    assert.equal(sessionDefault.maxAge, undefined)
  } finally {
    f.close()
  }

  const f2 = await fixture()
  try {
    const sessionRemembered = await f2.service.social(
      { token: "verified-token", remember: true },
      context,
    )
    assert.equal(sessionRemembered.maxAge, 30 * 86400)
  } finally {
    f2.close()
  }

  const f3 = await fixture()
  const server = createServer(
    createAuthHandler(async () => ({
      service: f3.service,
      secureCookies: true,
    })),
  )
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const port = (server.address() as { port: number }).port
  const base = "http://127.0.0.1:" + port
  try {
    const res = await fetch(base + "/api/auth/social", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://127.0.0.1:" + port,
      },
      body: JSON.stringify({ token: "verified-token", remember: true }),
    })
    assert.equal(res.status, 200)
    const cookie = res.headers.get("set-cookie")!
    assert.match(cookie, /^__Host-flux_session=/)
    for (const attr of [
      "HttpOnly",
      "SameSite=Lax",
      "Secure",
      "Path=/",
      "Max-Age=2592000",
    ]) {
      assert.ok(cookie.includes(attr), `Expected cookie to include ${attr}`)
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    f3.close()
  }
})

test("HTTP API issues protected cookies, strips recovery secrets, rejects cross-origin requests and signs out", async () => {
  const f = await fixture()
  const server = createServer(
    createAuthHandler(async () => ({
      service: f.service,
      secureCookies: true,
    })),
  )
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const port = (server.address() as { port: number }).port
  const base = "http://127.0.0.1:" + port
  const send = (
    action: string,
    body?: unknown,
    cookie?: string,
    origin = "https://127.0.0.1:" + port,
  ) =>
    fetch(base + "/api/auth/" + action, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  try {
    assert.equal((await send("session")).status, 401)
    assert.equal(
      (
        await send(
          "register",
          { name: "Test User", email: "user@example.com", password: PASSWORD },
          undefined,
          "https://attacker.example",
        )
      ).status,
      403,
    )
    assert.equal(
      (
        await send("register", {
          name: "Test User",
          email: "user@example.com",
          password: PASSWORD,
        })
      ).status,
      201,
    )
    const login = await send("login", {
      email: "user@example.com",
      password: PASSWORD,
      remember: true,
    })
    assert.equal(login.status, 200)
    assert.equal(login.headers.get("cache-control"), "no-store")
    const sessionHeader = login.headers.get("set-cookie")!
    assert.match(sessionHeader, /^__Host-flux_session=/)
    for (const attribute of [
      "HttpOnly",
      "SameSite=Lax",
      "Secure",
      "Path=/",
      "Max-Age=2592000",
    ])
      assert.ok(sessionHeader.includes(attribute))
    assert.equal("token" in (await login.json()), false)
    const sessionCookie = sessionHeader.split(";")[0]
    assert.equal((await send("session", undefined, sessionCookie)).status, 200)
    await send("reset-request", { email: "user@example.com" })
    const verify = await send(
      "reset-verify",
      { token: f.emails[0].token },
      sessionCookie,
    )
    assert.equal(verify.status, 200)
    const response = await verify.json()
    assert.equal("grant" in response, false)
    assert.equal("token" in response, false)
    const proofHeader = verify.headers.get("set-cookie")!
    assert.match(proofHeader, /^__Host-flux_reset=/)
    assert.ok(proofHeader.includes("HttpOnly"))
    const reset = await send(
      "reset-complete",
      { password: NEXT_PASSWORD },
      proofHeader.split(";")[0],
    )
    assert.equal(reset.status, 200)
    assert.equal((await send("session", undefined, sessionCookie)).status, 401)
    const logout = await send("logout", {}, sessionCookie)
    assert.ok(logout.headers.get("set-cookie")!.includes("Max-Age=0"))
    const malformed = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    })
    assert.equal(malformed.status, 400)
    assert.equal(
      (
        await fetch(base + "/api/auth/login", {
          method: "POST",
          body: "email=test",
        })
      ).status,
      415,
    )
    assert.equal((await send("login")).status, 405)
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
    f.close()
  }
})

test("canceling a reset disables its code, link and issued grant while preserving passwords and sessions", async () => {
  const f = await fixture()
  try {
    await f.register()
    const signedIn = await f.service.login(
      { email: "user@example.com", password: PASSWORD },
      context,
    )
    await f.service.requestReset({ email: "user@example.com" }, context)
    const mail = f.emails[0]
    const proof = await f.service.verifyReset(
      { email: mail.email, code: mail.code },
      context,
    )
    assert.deepEqual(
      await f.freshService().cancelReset({ token: mail.cancelToken }, context),
      { success: true },
    )
    await rejectsStatus(
      f.service.verifyReset({ token: mail.token }, context),
      400,
    )
    await rejectsStatus(
      f.service.verifyReset({ email: mail.email, code: mail.code }, context),
      400,
    )
    await rejectsStatus(
      f.service.completeReset({ password: NEXT_PASSWORD }, {
        ...context,
        resetGrant: proof.grant,
      }),
      400,
    )
    await rejectsStatus(
      f.service.cancelReset({ token: mail.cancelToken }, context),
      400,
    )
    assert.equal(
      (await f.service.session({ ...context, sessionToken: signedIn.token }))
        .user.email,
      mail.email,
    )
    assert.equal(
      (
        await f.service.login(
          { email: mail.email, password: PASSWORD },
          context,
        )
      ).user.email,
      mail.email,
    )
    assert.equal(
      (
        await f.database.execute(
          "SELECT last_password_reset FROM flux_accounts",
        )
      ).rows[0].last_password_reset,
      null,
    )

    f.advance(61000)
    await f.service.requestReset({ email: mail.email }, context)
    assert.equal(
      (await f.service.verifyReset({ token: f.emails[1].token }, context))
        .email,
      mail.email,
    )
  } finally {
    f.close()
  }
})

test("cancellation rejects forged tokens and cannot authorize a reset or cancel another or newer request", async () => {
  const f = await fixture()
  try {
    await f.register()
    await f.register("other@example.com")
    await f.service.requestReset({ email: "user@example.com" }, context)
    await f.service.requestReset({ email: "other@example.com" }, context)
    const [first, other] = f.emails
    const [identifier, signature] = first.cancelToken.split(".")
    const forgedSignature =
      (signature[0] === "0" ? "1" : "0") + signature.slice(1)
    for (const token of [
      first.token,
      identifier,
      `${identifier}.${forgedSignature}`,
      `${other.cancelToken.split(".")[0]}.${signature}`,
      "x".repeat(1000),
      null,
    ]) {
      await rejectsStatus(f.service.cancelReset({ token }, context), 400)
    }
    await rejectsStatus(
      f.service.verifyReset({ token: first.cancelToken }, context),
      400,
    )
    await rejectsStatus(
      f.service.completeReset({ password: NEXT_PASSWORD }, {
        ...context,
        resetGrant: first.cancelToken,
      }),
      400,
    )
    assert.equal(
      (await f.service.verifyReset({ token: first.token }, context)).email,
      first.email,
    )

    f.advance(61000)
    await f.service.requestReset({ email: first.email }, context)
    await rejectsStatus(
      f.service.cancelReset({ token: first.cancelToken }, context),
      400,
    )
    assert.deepEqual(
      await f.service.cancelReset({ token: f.emails[2].cancelToken }, context),
      { success: true },
    )
    assert.equal(
      (await f.service.verifyReset({ token: other.token }, context)).email,
      other.email,
    )
  } finally {
    f.close()
  }
})

test("expired and completed requests cannot be canceled; locked requests can still be canceled", async () => {
  const f = await fixture()
  try {
    await f.register()
    await f.service.requestReset({ email: "user@example.com" }, context)
    const expired = f.emails[0]
    f.advance(RESET_TTL)
    await rejectsStatus(
      f.service.cancelReset({ token: expired.cancelToken }, context),
      400,
      "isExpired",
    )

    await f.service.requestReset({ email: expired.email }, context)
    const completed = f.emails[1]
    const proof = await f.service.verifyReset(
      { token: completed.token },
      context,
    )
    await f.service.completeReset({ password: NEXT_PASSWORD }, {
      ...context,
      resetGrant: proof.grant,
    })
    await rejectsStatus(
      f.service.cancelReset({ token: completed.cancelToken }, context),
      400,
    )
    assert.equal(
      (
        await f.service.login(
          { email: completed.email, password: NEXT_PASSWORD },
          context,
        )
      ).user.email,
      completed.email,
    )

    f.advance(61000)
    await f.service.requestReset({ email: completed.email }, context)
    const locked = f.emails[2]
    const wrong = locked.code === "111111" ? "222222" : "111111"
    for (let attempt = 0; attempt < 5; attempt++)
      await rejectsStatus(
        f.service.verifyReset({ email: locked.email, code: wrong }, context),
        400,
      )
    assert.deepEqual(
      await f.service.cancelReset({ token: locked.cancelToken }, context),
      { success: true },
    )
  } finally {
    f.close()
  }
})

test("cancellation prevents a password update already in progress from committing", async () => {
  const f = await fixture()
  const originalTransaction = f.database.transaction.bind(f.database)
  let release: () => void = () => {}
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  let entered: () => void = () => {}
  const enteredTransaction = new Promise<void>((resolve) => {
    entered = resolve
  })
  try {
    await f.register()
    await f.service.requestReset({ email: "user@example.com" }, context)
    const mail = f.emails[0]
    const proof = await f.service.verifyReset({ token: mail.token }, context)
    f.database.transaction = async (mode?: TransactionMode) => {
      entered()
      await released
      return originalTransaction(mode)
    }
    const completion = f.service.completeReset({ password: NEXT_PASSWORD }, {
      ...context,
      resetGrant: proof.grant,
    })
    const rejectedCompletion = rejectsStatus(completion, 400)
    await enteredTransaction
    await f.service.cancelReset({ token: mail.cancelToken }, context)
    release()
    await rejectedCompletion
    assert.equal(
      (
        await f.service.login(
          { email: mail.email, password: PASSWORD },
          context,
        )
      ).user.email,
      mail.email,
    )
  } finally {
    release()
    f.database.transaction = originalTransaction
    f.close()
  }
})

test("HTTP cancellation requires a same-origin POST, never grants a session, and blocks replay", async () => {
  const f = await fixture()
  const server = createServer(
    createAuthHandler(async () => ({
      service: f.service,
      secureCookies: true,
    })),
  )
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const port = (server.address() as { port: number }).port
  const url = `http://127.0.0.1:${port}/api/auth/reset-cancel`
  try {
    await f.register()
    await f.service.requestReset({ email: "user@example.com" }, context)
    const mail = f.emails[0]
    const scanner = await fetch(url + "?token=" + mail.cancelToken)
    assert.equal(scanner.status, 405)
    assert.equal(scanner.headers.get("allow"), "POST")
    const post = (origin: string) =>
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: origin },
        body: JSON.stringify({ token: mail.cancelToken }),
      })
    assert.equal((await post("https://attacker.example")).status, 403)
    assert.equal(
      (await f.service.verifyReset({ token: mail.token }, context)).email,
      mail.email,
    )
    const response = await post(`https://127.0.0.1:${port}`)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("set-cookie"), null)
    assert.equal(response.headers.get("cache-control"), "no-store")
    assert.equal(response.headers.get("referrer-policy"), "no-referrer")
    assert.deepEqual(await response.json(), { success: true })
    assert.equal((await post(`https://127.0.0.1:${port}`)).status, 400)
    await rejectsStatus(
      f.service.verifyReset({ token: mail.token }, context),
      400,
    )
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    f.close()
  }
})

test("cancellation rate limits persist across service restarts", async () => {
  const f = await fixture()
  try {
    for (let attempt = 0; attempt < 30; attempt++)
      await rejectsStatus(
        f.service.cancelReset({ token: "invalid" }, context),
        400,
      )
    await rejectsStatus(
      f.freshService().cancelReset({ token: "invalid" }, context),
      429,
    )
  } finally {
    f.close()
  }
})

test("recovery emails include distinct cancellation links and escape untrusted request details", () => {
  const message: RecoveryEmail = {
    email: "user@example.com",
    code: "123456",
    token: "reset-proof",
    cancelToken: "cancellation-proof",
    location: '<a href="https://attacker.example">City</a>',
    device: "Browser & <script>alert('injection')</script>",
    ip: '1.2.3.4"><img src=x>',
    requestedAt: "Today <b>now</b>",
  }
  const { text, html } = renderRecoveryEmail(message, "https://flux.example")
  for (const body of [text, html]) {
    assert.ok(
      body.includes("https://flux.example/reset-password#token=reset-proof"),
    )
    assert.ok(
      body.includes(
        "https://flux.example/reset-password/cancel#token=cancellation-proof",
      ),
    )
    assert.ok(body.includes("https://flux.example/profile?tab=security"))
    assert.ok(body.includes("15 minutes"))
  }
  assert.ok(text.includes("confirm cancellation"))
  assert.ok(html.includes("This wasn't me — cancel request"))
  assert.ok(
    html.includes("&lt;script&gt;alert(&#39;injection&#39;)&lt;/script&gt;"),
  )
  assert.ok(html.includes("Browser &amp;"))
  assert.ok(
    html.includes("&lt;a href=&quot;https://attacker.example&quot;&gt;"),
  )
  for (const unsafe of [
    "<script>",
    '<a href="https://attacker.example">',
    "<img",
    "<b>now</b>",
  ])
    assert.equal(html.includes(unsafe), false)
})

test("Brevo SMTP requires TLS and configuration never permits an insecure public recovery URL", () => {
  const keys = [
    "BREVO_SMTP_USER",
    "BREVO_SMTP_PASSWORD",
    "BREVO_FROM_EMAIL",
    "BREVO_SMTP_PORT",
    "APP_URL",
    "VERCEL",
  ]
  const previous = new Map(keys.map((key) => [key, process.env[key]]))
  try {
    Object.assign(process.env, {
      BREVO_SMTP_USER: "test",
      BREVO_SMTP_PASSWORD: "test",
      BREVO_FROM_EMAIL: "sender@example.com",
      APP_URL: "https://flux.example",
      BREVO_SMTP_PORT: "587",
    })
    delete process.env.VERCEL
    assert.equal(smtpOptions().requireTLS, true)
    assert.equal(smtpOptions().tls.rejectUnauthorized, true)
    createRecoveryMailer().assertConfigured()
    process.env.BREVO_SMTP_PORT = "465"
    assert.equal(smtpOptions().secure, true)
    process.env.APP_URL = "http://flux.example"
    assert.throws(() => createRecoveryMailer().assertConfigured())
    process.env.APP_URL = "ftp://localhost"
    assert.throws(() => createRecoveryMailer().assertConfigured())
    process.env.APP_URL = "https://flux.example"
    delete process.env.BREVO_SMTP_PASSWORD
    assert.throws(() => createRecoveryMailer().assertConfigured())
  } finally {
    for (const [key, value] of previous)
      value === undefined ? delete process.env[key] : (process.env[key] = value)
  }
})
