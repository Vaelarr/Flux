import { useState } from "react"

import { Link, useNavigate, useLocation } from "react-router-dom"

import {
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  UserPlus,
  RefreshCw,
  AlertCircle,
  X,
} from "lucide-react"

import { FluxLogo } from "./Landing"

import { analyzeNistPassword, generatePassphrase } from "../utils/security"

import {
  createAccount,
  signInWithGoogleService,
  type GoogleAccountLink,
} from "../utils/accounts"
import type { UserAccount } from "../types"
import GoogleAccountLinkModal from "../components/GoogleAccountLinkModal"
import { normalizePhoneNumber } from "../utils/phone"

import NistPasswordValidator from "../components/NistPasswordValidator"

import AuthSkeleton from "../components/AuthSkeleton"

import SocialAuthModal from "../components/SocialAuthModal"

import { useToast } from "../components/Toast"

export default function Register() {
  const navigate = useNavigate()

  const location = useLocation()

  const { showToast } = useToast()

  // Form states

  const [name, setName] = useState(location.state?.name ?? "")

  const [email, setEmail] = useState(location.state?.email ?? "")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [phoneTouched, setPhoneTouched] = useState(false)

  const [password, setPassword] = useState("")

  const [showPassword, setShowPassword] = useState(false)

  const [agreeTerms, setAgreeTerms] = useState(true)

  // Flow states

  const [isSubmitting, setIsSubmitting] = useState(false)

  const [loadingMsg, setLoadingMsg] = useState("Creating your account…")

  const [accountCreated, setAccountCreated] = useState<boolean>(false)

  const [createdEmail, setCreatedEmail] = useState("")

  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [isSocialModalOpen, setIsSocialModalOpen] = useState(false)
  const [googleAccountLink, setGoogleAccountLink] =
    useState<GoogleAccountLink | null>(null)
  let phoneError = ""
  try {
    normalizePhoneNumber(phoneNumber)
  } catch {
    phoneError = "Enter a valid phone number."
  }

  // NIST Password analysis in real-time

  const nistAnalysis = analyzeNistPassword(password, email)

  const canSubmit =
    name.trim().length >= 2 &&
    email.includes("@") &&
    nistAnalysis.allCriticalMet &&
    !phoneError &&
    agreeTerms &&
    !isSubmitting

  const handleGeneratePassphrase = () => {
    const generated = generatePassphrase()

    setPassword(generated)

    setShowPassword(true)
  }

  const finishGoogleSignIn = (user: UserAccount) => {
    setGoogleAccountLink(null)
    setPassword("")
    navigate("/login", { replace: true, state: { email: user.email } })
    showToast({
      title: "Signed in",
      message: "Connected with Google.",
      type: "notice-green",
    })
  }

  const handleGoogleRegister = async () => {
    setPhoneTouched(true)
    if (phoneError || !agreeTerms) return
    setErrorMsg(null)

    setLoadingMsg("Setting up account with Google…")

    setIsSubmitting(true)

    const res = await signInWithGoogleService({ phoneNumber, remember: true })

    setIsSubmitting(false)

    if (res.success && res.user) {
      finishGoogleSignIn(res.user)
    } else if (res.accountLink) {
      setGoogleAccountLink(res.accountLink)
    } else if (res.needsFallback) {
      setIsSocialModalOpen(true)
    } else {
      setErrorMsg(res.error || "Failed to sign up with Google.")
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    setErrorMsg(null)
    setLoadingMsg("Creating your account…")
    setIsSubmitting(true)
    try {
      const account = await createAccount({
        name,
        email,
        password,
        phoneNumber,
      })
      setCreatedEmail(account.email)
      setPassword("")
      setAccountCreated(true)
      showToast({
        title: "Account ready",
        message: "Welcome to Flux.",
        type: "notice-green",
        action: {
          label: "Sign in",
          onClick: () =>
            navigate("/login", {
              state: { email: account.email, fromRegistration: true },
            }),
        },
      })
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : "Could not create your account. Please try again.",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-cream min-h-screen flex flex-col text-forest">
      {/* Header Navigation */}
      <header className="border-b border-sand bg-cream/80 backdrop-blur sticky top-0 z-10">
        <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 md:px-10 h-14">
          <FluxLogo />
          <div className="flex items-center gap-3 text-sm">
            <span className="text-dim hidden sm:inline">
              Already have an account?
            </span>
            <Link to="/login" className="btn btn-outline text-xs py-1.5 px-3">
              Sign in
            </Link>
          </div>
        </nav>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-10 md:py-14">
        <div className="w-full max-w-md">
          {accountCreated ? (
            /* Post-Account Creation Success Screen */

            <div className="panel p-6 sm:p-8 space-y-6 animate-fade-up">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-full bg-green/10 border-2 border-green flex items-center justify-center mx-auto text-green mb-1">
                  <CheckCircle2 className="w-8 h-8 stroke-[2.2]" />
                </div>
                <h1 className="font-heading text-2xl font-bold text-forest">
                  Welcome to Flux!
                </h1>
                <p className="text-xs text-dim max-w-xs mx-auto">
                  Your account for{" "}
                  <span className="font-semibold text-forest font-mono">
                    {createdEmail}
                  </span>{" "}
                  is ready.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    navigate("/login", {
                      state: { email: createdEmail, fromRegistration: true },
                    })
                  }
                  className="btn btn-forest w-full py-3.5 text-sm gap-2 font-medium flex items-center justify-center"
                >
                  <span>Sign in</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="btn btn-outline w-full py-2.5 text-xs text-dim hover:text-forest"
                >
                  Back to homepage
                </button>
              </div>
            </div>
          ) : (
            /* Create Account Form */

            <div className="panel p-6 sm:p-8">
              <div className="mb-6">
                <h1 className="font-heading text-3xl font-bold text-forest mb-1.5">
                  Create your account
                </h1>
              </div>

              {isSubmitting ? (
                /* Elegant CSS Shimmer Skeleton Screen during account registration */

                <AuthSkeleton
                  type="register"
                  variant="plain"
                  showHeader={false}
                  message={loadingMsg}
                  submessage=""
                />
              ) : (
                <>
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
                                isPopupClosed
                                  ? "text-amber-600"
                                  : "text-red-500"
                              }`}
                            />
                            <p className="font-medium">{errorMsg}</p>
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

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Full Name */}
                    <div>
                      <label
                        htmlFor="signup-name"
                        className="block text-xs font-semibold text-dim tracking-wide uppercase mb-1.5"
                      >
                        Full Name
                      </label>
                      <input
                        id="signup-name"
                        autoComplete="name"
                        minLength={2}
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Jane Doe"
                        required
                        className="input"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label
                        htmlFor="signup-email"
                        className="block text-xs font-semibold text-dim tracking-wide uppercase mb-1.5"
                      >
                        Email address
                      </label>
                      <input
                        id="signup-email"
                        autoComplete="username"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        className="input font-mono text-sm"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="signup-phone"
                        className="block text-xs font-semibold text-dim tracking-wide uppercase mb-1.5"
                      >
                        Phone number{" "}
                        <span className="font-normal normal-case tracking-normal">
                          (optional)
                        </span>
                      </label>
                      <input
                        id="signup-phone"
                        type="tel"
                        autoComplete="tel"
                        inputMode="tel"
                        maxLength={40}
                        value={phoneNumber}
                        onChange={(event) => setPhoneNumber(event.target.value)}
                        onBlur={() => setPhoneTouched(true)}
                        placeholder="0912 345 6789 or +63 912 345 6789"
                        className="input text-sm"
                        aria-invalid={phoneTouched && !!phoneError}
                        aria-describedby={
                          phoneTouched && phoneError
                            ? "phone-error"
                            : "phone-help"
                        }
                      />
                      {phoneTouched && phoneError ? (
                        <p
                          id="phone-error"
                          role="alert"
                          className="text-xs text-red-700 mt-1.5"
                        >
                          {phoneError}
                        </p>
                      ) : (
                        <p id="phone-help" className="text-xs text-dim mt-1.5">
                          Outside the Philippines? Include your country code.
                        </p>
                      )}
                    </div>

                    {/* Password with live validation */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label
                          htmlFor="signup-password"
                          className="block text-xs font-semibold text-dim tracking-wide uppercase"
                        >
                          Password
                        </label>
                        <button
                          type="button"
                          onClick={handleGeneratePassphrase}
                          className="text-xs link flex items-center gap-1 text-green font-medium hover:underline"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Suggest password
                        </button>
                      </div>

                      <div className="relative">
                        <input
                          id="signup-password"
                          autoComplete="new-password"
                          minLength={15}
                          aria-describedby="password-guidance"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Create a password"
                          required
                          className="input pr-10 font-mono text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-forest transition-colors p-1"
                          title={
                            showPassword ? "Hide password" : "Show password"
                          }
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      {/* Password Validator */}
                      <NistPasswordValidator
                        analysis={nistAnalysis}
                        passwordLength={password.length}
                      />
                    </div>

                    {/* Terms agreement checkbox */}
                    <div className="pt-2">
                      <label className="flex items-start gap-2.5 text-xs text-dim cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={agreeTerms}
                          onChange={(e) => setAgreeTerms(e.target.checked)}
                          className="mt-0.5 accent-green rounded"
                        />
                        <span className="leading-tight">
                          I agree to the Terms and Privacy Policy.
                        </span>
                      </label>
                    </div>

                    {/* Submit button */}
                    <button
                      type="submit"
                      disabled={!canSubmit}
                      className="btn btn-forest w-full py-3.5 text-sm mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Creating account…</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" />
                          <span>Create Account</span>
                        </>
                      )}
                    </button>

                    {/* Divider */}
                    <div className="flex items-center gap-3 py-1">
                      <hr className="rule flex-1" />
                      <span className="text-xs text-dim">or</span>
                      <hr className="rule flex-1" />
                    </div>

                    {/* Social Buttons */}
                    <div>
                      <button
                        type="button"
                        onClick={() => void handleGoogleRegister()}
                        data-google-signin
                        disabled={!agreeTerms || !!phoneError}
                        className="btn btn-outline text-xs gap-2 w-full py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <GoogleIcon /> Continue with Google
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {googleAccountLink && (
        <GoogleAccountLinkModal
          accountLink={googleAccountLink}
          initialRemember={true}
          onCancel={() => setGoogleAccountLink(null)}
          onLinked={finishGoogleSignIn}
        />
      )}
      <SocialAuthModal
        isOpen={isSocialModalOpen}
        onClose={() => setIsSocialModalOpen(false)}
        onRetry={() => {
          setIsSocialModalOpen(false)
          void handleGoogleRegister()
        }}
      />
    </div>
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
