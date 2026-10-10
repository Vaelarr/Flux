import { signInWithPopup, signOut as firebaseSignOut } from "firebase/auth"
import { auth, authReady, googleProvider } from "../lib/firebase"
import type { UserAccount, SecuritySession } from "../types"

export class AccountApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details: Record<string, unknown> = {},
  ) {
    super(message)
  }
}

async function request<T>(
  action: string,
  body?: Record<string, unknown>,
): Promise<T> {
  let response: Response
  try {
    response = await fetch("/api/auth/" + action, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    })
  } catch {
    throw new AccountApiError("Connection failed. Please try again.", 503)
  }
  let result: Record<string, unknown>
  try {
    result = await response.json()
  } catch {
    throw new AccountApiError(
      "Account services are unavailable. Please try again later.",
      503,
    )
  }
  if (!response.ok) {
    throw new AccountApiError(
      typeof result.error === "string" ? result.error : "Please try again.",
      response.status,
      result,
    )
  }
  return result as T
}

export async function createAccount(data: {
  name: string
  email: string
  password: string
  phoneNumber?: string
}): Promise<UserAccount> {
  return (await request<{ user: UserAccount }>("register", data)).user
}

export async function signInAccount(
  email: string,
  password: string,
  remember = false,
): Promise<UserAccount> {
  return (
    await request<{ user: UserAccount }>("login", { email, password, remember })
  ).user
}

export async function currentAccount(): Promise<UserAccount | null> {
  try {
    return (await request<{ user: UserAccount }>("session")).user
  } catch (error) {
    if (error instanceof AccountApiError && error.status === 401) return null
    throw error
  }
}

export async function signOutAccount() {
  await request("logout", {})
  await firebaseSignOut(auth).catch(() => {})
}

export interface ResetRequestResponse {
  success: boolean
  expiresIn: number
  retryAfter: number
}
export interface ResetVerificationResponse {
  success: boolean
  email: string
  expiresIn: number
  sessions: SecuritySession[]
}

export function requestResetInstructions(email: string) {
  let timeZone: string | undefined = undefined
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    /* Optional client timezone */
  }
  return request<ResetRequestResponse>("reset-request", { email, timeZone })
}

export function verifyResetCode(email: string, code: string) {
  return request<ResetVerificationResponse>("reset-verify", { email, code })
}

export function verifyResetLink(token: string) {
  return request<ResetVerificationResponse>("reset-verify", { token })
}

export function cancelResetRequest(token: string) {
  return request<{ success: boolean }>("reset-cancel", { token })
}

export interface PasswordUpdateResponse {
  success: boolean
  sessionsRevoked: boolean
}

export function saveNewPassword(
  password: string,
  revokeSessions: boolean,
  keepCurrentSession = false,
) {
  return request<PasswordUpdateResponse>("reset-complete", {
    password,
    revokeSessions,
    keepCurrentSession,
  })
}

export async function updateUserProfile(data: {
  name?: string
  phoneNumber?: string
  bio?: string
  avatarUrl?: string
}): Promise<UserAccount> {
  return (await request<{ user: UserAccount }>("update-profile", data)).user
}

export function changeUserPassword(data: {
  currentPassword?: string
  newPassword: string
  revokeOtherSessions?: boolean
}) {
  return request<PasswordUpdateResponse>("change-password", data)
}

export async function fetchUserSessions(): Promise<SecuritySession[]> {
  return (await request<{ sessions: SecuritySession[] }>("get-sessions"))
    .sessions
}

export function revokeUserSession(sessionId: string) {
  return request<{ success: boolean }>("revoke-session", { sessionId })
}

export function revokeOtherUserSessions() {
  return request<{ success: boolean }>("revoke-other-sessions", {})
}

export function deleteUserAccount(confirmation?: { password?: string }) {
  return request<{ success: boolean }>("delete-account", confirmation || {})
}

export interface SocialAuthResponse {
  success: boolean
  user?: UserAccount
  error?: string
  isPopupClosed?: boolean
  needsFallback?: boolean
  accountLink?: GoogleAccountLink
}

export interface GoogleAccountLink {
  email: string
  complete: (password: string, remember?: boolean) => Promise<UserAccount>
}

export interface SocialAuthOptions {
  remember?: boolean
  phoneNumber?: string
}

// Delete legacy browser copies of account credentials; only server records authenticate users.
try {
  for (const key of [
    "flux_registered_accounts",
    "flux_reset_challenges",
    "flux_demo_registered_accounts",
  ])
    localStorage.removeItem(key)
} catch {
  /* Storage can be unavailable in private browsing. */
}

export async function signInWithGoogleService(
  options: SocialAuthOptions = {},
): Promise<SocialAuthResponse> {
  let token: string | undefined
  const remember = options.remember === true
  const phoneNumber = options.phoneNumber
  try {
    await authReady
    const result = await signInWithPopup(auth, googleProvider)
    token = await result.user.getIdToken(true)
    const { user } = await request<{ user: UserAccount }>("social", {
      token,
      remember,
      phoneNumber,
    })
    return { success: true, user }
  } catch (error) {
    if (
      token &&
      error instanceof AccountApiError &&
      error.status === 409 &&
      error.details.needsAccountLink === true &&
      typeof error.details.email === "string"
    ) {
      const verifiedToken = token
      return {
        success: false,
        accountLink: {
          email: error.details.email,
          complete: async (password: string, linkRemember?: boolean) =>
            (
              await request<{ user: UserAccount }>("social", {
                token: verifiedToken,
                password,
                remember: linkRemember !== undefined ? linkRemember : remember,
                phoneNumber,
              })
            ).user,
        },
      }
    }
    const code = (error as { code?: string }).code || ""
    if (
      code === "auth/configuration-not-found" ||
      code === "auth/operation-not-allowed"
    ) {
      return { success: false, needsFallback: true }
    }
    const closed =
      code === "auth/popup-closed-by-user" ||
      code === "auth/cancelled-popup-request"
    const message =
      error instanceof AccountApiError
        ? error.message
        : closed
          ? "Google sign-in was closed. Try again."
          : code === "auth/popup-blocked"
            ? "Sign-in popup blocked. Allow popups and try again."
            : code === "auth/unauthorized-domain"
              ? "Google sign-in is unavailable here. Use email or try again later."
              : code === "auth/account-exists-with-different-credential"
                ? "This email uses another sign-in method. Continue with email."
                : code === "auth/network-request-failed"
                  ? "Connection failed. Please try again."
                  : "Could not sign in with Google. Please try again."
    return { success: false, error: message, isPopupClosed: closed }
  } finally {
    // Do not retain Firebase access or refresh tokens after exchanging identity for a Flux session.
    await firebaseSignOut(auth).catch(() => {})
  }
}
