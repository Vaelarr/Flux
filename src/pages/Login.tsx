import { useState, useEffect } from "react"

import { Link, useLocation, useNavigate } from "react-router-dom"

import {
  CheckCircle2,
  ShieldCheck,
  Eye,
  EyeOff,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  X,
} from "lucide-react"

import { FluxLogo } from "./Landing"

import {
  signInAccount,
  currentAccount,
  signOutAccount,
  signInWithGoogleService,
  type GoogleAccountLink,
} from "../utils/accounts"
import type { UserAccount } from "../types"
import GoogleAccountLinkModal from "../components/GoogleAccountLinkModal"

import AuthSkeleton from "../components/AuthSkeleton"

import SocialAuthModal from "../components/SocialAuthModal"

import { useToast } from "../components/Toast"

export default function Login() {
  const location = useLocation()
  const navigate = useNavigate()

  const { showToast } = useToast()

  const fromReset = location.state?.fromReset === true

  const sessionsRevoked = location.state?.sessionsRevoked === true

  const [email, setEmail] = useState<string>(location.state?.email ?? "")

  const [password, setPassword] = useState("")

  const [remember, setRemember] = useState(false)

  const [showPass, setShowPass] = useState(false)

  const [loading, setLoading] = useState(false)

  const [loadingMsg, setLoadingMsg] = useState("Signing in…")

  const [done, setDone] = useState(false)

  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [isSocialModalOpen, setIsSocialModalOpen] = useState(false)
  const [googleAccountLink, setGoogleAccountLink] =
    useState<GoogleAccountLink | null>(null)

  useEffect(() => {
    if (fromReset) {
      showToast({
        title: "Password updated",

        message: sessionsRevoked
          ? "Sign in with your new password. Other devices were signed out."
          : "Sign in with your new password.",

        type: "security",

        duration: 6000,
      })
    } else if (location.state?.fromRegistration) {
      showToast({
        title: "Account ready",

        message: "Sign in to continue.",

        type: "notice-green",

        duration: 5000,
      })
    }
  }, [fromReset, sessionsRevoked, location.state, showToast])

  useEffect(() => {
    if (fromReset || location.state?.fromRegistration) return
    let active = true
    void currentAccount()
      .then((account) => {
        if (active && account) {
          setEmail(account.email)
          setDone(true)
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [fromReset, location.state?.fromRegistration])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setErrorMsg(null)
    setLoadingMsg("Signing in…")
    setLoading(true)
    try {
      const account = await signInAccount(email, password, remember)
      setEmail(account.email)
      setPassword("")
      setDone(true)
      navigate("/login", { replace: true, state: { email: account.email } })
      showToast({
        title: "Signed in",
        message: "Welcome back, " + account.name + ".",
        type: "notice-green",
      })
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : "Could not sign in. Please try again.",
      )
    } finally {
      setLoading(false)
    }
  }

  const handleSwitchAccount = async () => {
    setLoading(true)
    try {
      await signOutAccount()
      setDone(false)
      setPassword("")
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : "Could not sign out. Please try again.",
      )
    } finally {
      setLoading(false)
    }
  }

  const finishGoogleSignIn = (user: UserAccount) => {
    setGoogleAccountLink(null)
    setEmail(user.email)
    setDone(true)
    setPassword("")
    navigate("/login", { replace: true, state: { email: user.email } })
    showToast({
      title: "Signed in",
      message: "Connected with Google.",
      type: "notice-green",
    })
  }

  const handleGoogleClick = async () => {
    setErrorMsg(null)

    setLoadingMsg("Connecting with Google…")

    setLoading(true)

    const result = await signInWithGoogleService({ remember })

    setLoading(false)

    if (result.success && result.user) {
      finishGoogleSignIn(result.user)
    } else if (result.accountLink) {
      setGoogleAccountLink(result.accountLink)
    } else if (result.needsFallback) {
      setIsSocialModalOpen(true)
    } else {
      setErrorMsg(result.error || "Failed to sign in with Google.")
    }
  }

  return (
    <div className="bg-cream min-h-screen flex flex-col">
      {/* Nav */}
      <header className="border-b border-sand">
        <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 md:px-10 h-14">
          <FluxLogo />
          <p className="text-sm text-dim">
            New to Flux?{" "}
            <Link to="/signup" className="link font-medium">
              Create account
            </Link>
          </p>
        </nav>
      </header>

      {/* Form area */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Pre-fill banner with session revocation note */}
          {fromReset && !done && (
            <div className="notice notice-green flex items-start gap-2.5 mb-5 animate-fade-up">
              <ShieldCheck className="w-4 h-4 text-green flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-forest text-xs">
                  Password updated
                </p>
                <p className="text-xs mt-0.5 text-dim">
                  Enter your new password to sign in.
                </p>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="mb-6">
            <h1 className="font-heading text-3xl font-bold text-forest mb-1.5">
              Sign in to Flux
            </h1>
            <p className="text-sm text-dim">Welcome back.</p>
          </div>

          {errorMsg &&
            (() => {
              const isPopupClosed =
                errorMsg.toLowerCase().includes("closed") ||
                errorMsg.toLowerCase().includes("cancelled") ||
                errorMsg.toLowerCase().includes("blocked")

              return (
                <div
                  role="alert"
                  className={`p-3 mb-4 rounded-lg text-xs flex items-start justify-between gap-2.5 animate-fade-up ${
                    isPopupClosed
                      ? "bg-amber-50 border border-amber-200 text-amber-900"
                      : "bg-red-50 border border-red-200 text-red-700"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <AlertCircle
                      className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                        isPopupClosed ? "text-amber-600" : "text-red-500"
                      }`}
                    />
                    <div className="space-y-1">
                      <p className="font-medium">{errorMsg}</p>
                      {!isPopupClosed &&
                        !errorMsg.includes("Firebase Auth:") &&
                        !errorMsg.includes("Google") &&
                        (errorMsg.toLowerCase().includes("password") ||
                          errorMsg.toLowerCase().includes("credential") ||
                          errorMsg.toLowerCase().includes("user")) && (
                          <Link
                            to="/reset-password"
                            state={{ email }}
                            className="inline-flex items-center gap-1 font-semibold text-red-800 hover:underline pt-0.5"
                          >
                            <span>Reset password</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setErrorMsg(null)}
                    className="text-dim hover:text-ink p-0.5 rounded transition-colors flex-shrink-0"
                    aria-label="Dismiss error"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })()}

          {done ? (
            <div className="animate-fade-up text-center py-8">
              <div className="w-14 h-14 rounded-full border-2 border-green flex items-center justify-center mx-auto mb-4 text-green">
                <CheckCircle2 className="w-7 h-7 stroke-[2.2]" />
              </div>
              <p className="font-semibold text-forest text-base">
                You’re signed in
              </p>
              <p className="text-xs text-dim mt-1 break-all">{email}</p>

              <div className="mt-6 pt-4 border-t border-sand flex flex-col gap-2">
                <Link
                  to="/"
                  className="btn btn-forest text-xs py-2.5 w-full flex items-center justify-center gap-1.5"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => void handleSwitchAccount()}
                  disabled={loading}
                  className="btn btn-outline text-xs py-2 w-full text-dim"
                >
                  Switch account
                </button>
              </div>
            </div>
          ) : loading ? (
            /* Elegant CSS Shimmer Skeleton Screen during login verification */

            <AuthSkeleton
              type="login"
              variant="plain"
              showHeader={false}
              message={loadingMsg}
              submessage=""
            />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-xs font-semibold text-dim tracking-wide uppercase mb-1.5"
                >
                  Email
                </label>
                <input
                  id="login-email"
                  autoComplete="username"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setErrorMsg(null)
                  }}
                  placeholder="you@example.com"
                  required
                  autoFocus={!fromReset}
                  className="input"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-semibold text-dim tracking-wide uppercase"
                  >
                    Password
                  </label>
                  <Link
                    to="/reset-password"
                    state={{ email }}
                    className="text-xs link"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    autoComplete="current-password"
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setErrorMsg(null)
                    }}
                    placeholder="••••••••"
                    required
                    autoFocus={fromReset}
                    className="input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    aria-label={showPass ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-forest transition-colors"
                  >
                    {showPass ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember */}
              <button
                type="button"
                onClick={() => setRemember(!remember)}
                role="checkbox"
                aria-checked={remember}
                className="flex items-center gap-2.5 text-sm text-dim select-none w-full text-left cursor-pointer"
              >
                <span
                  className="w-4 h-4 rounded-[3px] border flex items-center justify-center flex-shrink-0 transition-all"
                  style={{
                    borderColor: remember ? "#306D29" : "#C8BF8A",

                    background: remember ? "#306D29" : "transparent",
                  }}
                >
                  {remember && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-cream" />
                  )}
                </span>
                Keep me signed in
              </button>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-forest w-full py-3.5 text-sm mt-1"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Signing in…
                  </>
                ) : (
                  "Sign in →"
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 py-1">
                <hr className="rule flex-1" />
                <span className="text-xs text-dim">or</span>
                <hr className="rule flex-1" />
              </div>

              {/* Social */}
              <div>
                <SocialBtn onClick={() => void handleGoogleClick()}>
                  <GoogleIcon /> Continue with Google
                </SocialBtn>
              </div>
            </form>
          )}

          <p className="text-center text-xs text-dim mt-6">
            By signing in, you agree to our{" "}
            <a href="#" className="link">
              Terms
            </a>{" "}
            &amp;{" "}
            <a href="#" className="link">
              Privacy
            </a>
            .
          </p>
        </div>
      </div>

      {googleAccountLink && (
        <GoogleAccountLinkModal
          accountLink={googleAccountLink}
          initialRemember={remember}
          onCancel={() => setGoogleAccountLink(null)}
          onLinked={finishGoogleSignIn}
        />
      )}
      <SocialAuthModal
        isOpen={isSocialModalOpen}
        onClose={() => setIsSocialModalOpen(false)}
        onRetry={() => {
          setIsSocialModalOpen(false)
          void handleGoogleClick()
        }}
      />
    </div>
  )
}

function SocialBtn({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      data-google-signin
      onClick={onClick}
      className="btn btn-outline text-xs gap-2 w-full py-2.5"
    >
      {children}
    </button>
  )
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}
