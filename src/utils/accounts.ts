import { signInWithPopup, onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { auth, googleProvider, appleProvider } from "../lib/firebase";
import type { UserAccount, SecuritySession } from "../types";

export class AccountApiError extends Error {
  constructor(message: string, public status: number, public details: Record<string, unknown> = {}) {
    super(message);
  }
}

async function request<T>(action: string, body?: Record<string, unknown>): Promise<T> {
  let response: Response;
  try {
    response = await fetch("/api/auth/" + action, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    throw new AccountApiError("Connection failed. Please try again.", 503);
  }
  let result: Record<string, unknown>;
  try {
    result = await response.json();
  } catch {
    throw new AccountApiError("Account services are unavailable. Please try again later.", 503);
  }
  if (!response.ok) {
    throw new AccountApiError(typeof result.error === "string" ? result.error : "Please try again.", response.status, result);
  }
  return result as T;
}

export async function createAccount(data: { name: string; email: string; password: string }): Promise<UserAccount> {
  return (await request<{ user: UserAccount }>("register", data)).user;
}

export async function signInAccount(email: string, password: string, remember = false): Promise<UserAccount> {
  return (await request<{ user: UserAccount }>("login", { email, password, remember })).user;
}

export async function currentAccount(): Promise<UserAccount | null> {
  try { return (await request<{ user: UserAccount }>("session")).user; }
  catch (error) { if (error instanceof AccountApiError && error.status === 401) return null; throw error; }
}

export async function signOutAccount() {
  await request("logout", {});
  await firebaseSignOut(auth).catch(() => {});
}

export interface ResetRequestResponse { success: boolean; expiresIn: number; retryAfter: number }
export interface ResetVerificationResponse { success: boolean; email: string; expiresIn: number; sessions: SecuritySession[] }

export function requestResetInstructions(email: string) {
  return request<ResetRequestResponse>("reset-request", { email });
}

export function verifyResetCode(email: string, code: string) {
  return request<ResetVerificationResponse>("reset-verify", { email, code });
}

export function verifyResetLink(token: string) {
  return request<ResetVerificationResponse>("reset-verify", { token });
}

export function saveNewPassword(password: string, revokeSessions: boolean) {
  return request<{ success: boolean; sessionsRevoked: boolean }>("reset-complete", { password, revokeSessions });
}

export interface SocialAuthResponse {
  success: boolean;
  user?: UserAccount;
  error?: string;
  isPopupClosed?: boolean;
  needsFallback?: boolean;
  provider?: "google" | "apple";
}

export interface SocialAuthOptions { onClosedImmediate?: () => void }

// Delete legacy browser copies of account credentials; only server records authenticate users.
try {
  for (const key of ["flux_registered_accounts", "flux_reset_challenges", "flux_demo_registered_accounts"]) localStorage.removeItem(key);
} catch { /* Storage can be unavailable in private browsing. */ }

async function executePopupWithInstantCloseDetection<T>(
  action: () => Promise<T>,
  options?: SocialAuthOptions
): Promise<T> {
  if (typeof window === "undefined") {
    return action();
  }

  let capturedPopup: Window | null = null;
  const originalOpen = window.open;

  // Intercept window.open synchronously to capture the popup window reference
  window.open = function (...args: any[]) {
    const win = originalOpen.apply(window, args as any);
    if (win) {
      capturedPopup = win;
    }
    return win;
  };

  let isSettled = false;
  let intervalId: any = null;
  let focusListener: (() => void) | null = null;
  let unsubscribeAuth: (() => void) | null = null;
  let authSucceeded = false;

  const cleanup = () => {
    isSettled = true;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (focusListener) {
      window.removeEventListener("focus", focusListener);
      focusListener = null;
    }
    if (unsubscribeAuth) {
      unsubscribeAuth();
      unsubscribeAuth = null;
    }
    if (window.open !== originalOpen) {
      window.open = originalOpen;
    }
  };

  try {
    unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        authSucceeded = true;
      }
    });
  } catch {
    // Ignore if auth is unavailable
  }

  let actionPromise: Promise<T>;
  try {
    actionPromise = action();
  } finally {
    // Restore window.open immediately after synchronous call
    setTimeout(() => {
      if (window.open !== originalOpen) {
        window.open = originalOpen;
      }
    }, 50);
  }

  const safeActionPromise = actionPromise
    .then((res) => {
      cleanup();
      return res;
    })
    .catch((err) => {
      cleanup();
      throw err;
    });

  // Avoid unhandled rejection warning if the instantClosePromise wins
  safeActionPromise.catch(() => {});

  const instantClosePromise = new Promise<T>((_, reject) => {
    const checkClosed = () => {
      if (isSettled) return;
      if (capturedPopup && capturedPopup.closed) {
        // Wait 120ms to allow in-flight credential message to propagate if window closed on success
        setTimeout(() => {
          if (isSettled) return;
          if (authSucceeded || auth.currentUser) return;

          options?.onClosedImmediate?.();
          cleanup();
          const closedErr = new Error("auth/popup-closed-by-user");
          (closedErr as any).code = "auth/popup-closed-by-user";
          reject(closedErr);
        }, 120);
      }
    };

    // 1. High frequency polling (every 80ms)
    intervalId = setInterval(checkClosed, 80);

    // 2. When the user closes the popup window, the browser immediately focuses the main window
    focusListener = () => {
      setTimeout(checkClosed, 20);
    };
    window.addEventListener("focus", focusListener);
  });

  return Promise.race([safeActionPromise, instantClosePromise]);
}


async function signInWithProvider(provider: "google" | "apple", options?: SocialAuthOptions): Promise<SocialAuthResponse> {
  try {
    const result = await executePopupWithInstantCloseDetection(
      () => signInWithPopup(auth, provider === "google" ? googleProvider : appleProvider), options,
    );
    const token = await result.user.getIdToken();
    const { user } = await request<{ user: UserAccount }>("social", { token });
    return { success: true, user };
  } catch (error) {
    const code = (error as { code?: string }).code || "";
    const providerName = provider === "google" ? "Google" : "Apple";
    if (code === "auth/configuration-not-found" || code === "auth/operation-not-allowed") {
      return { success: false, needsFallback: true, provider };
    }
    const closed = code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request";
    const message = error instanceof AccountApiError ? error.message
      : closed ? providerName + " sign-in was closed. Try again."
      : code === "auth/popup-blocked" ? "Sign-in popup blocked. Allow popups and try again."
      : code === "auth/unauthorized-domain" ? "Social sign-in is unavailable. Use email or try again later."
      : "Could not sign in with " + providerName + ". Please try again.";
    return { success: false, error: message, isPopupClosed: closed, provider };
  }
}

export function signInWithGoogleService(options?: SocialAuthOptions) { return signInWithProvider("google", options); }
export function signInWithAppleService(options?: SocialAuthOptions) { return signInWithProvider("apple", options); }
