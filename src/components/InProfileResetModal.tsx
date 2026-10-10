import { useState, useRef, useEffect } from "react"
import {
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  X,
  AlertCircle,
  HelpCircle,
} from "lucide-react"
import type { SecuritySession } from "../types"
import {
  analyzeNistPassword,
  generatePassphrase,
  maskEmail,
  getWebmailInfo,
} from "../utils/security"
import {
  AccountApiError,
  requestResetInstructions,
  verifyResetCode,
  saveNewPassword,
} from "../utils/accounts"
import NistPasswordValidator from "./NistPasswordValidator"
import { useToast } from "./Toast"

interface InProfileResetModalProps {
  isOpen: boolean
  onClose: () => void
  userEmail: string
  easyReadMode?: boolean
  onPasswordUpdated: () => void
}

type ModalStep = "request" | "verify" | "newpass" | "success"

const TOKEN_TTL = 15 * 60
const MAX_ATTEMPTS = 5

export default function InProfileResetModal({
  isOpen,
  onClose,
  userEmail,
  easyReadMode = false,
  onPasswordUpdated,
}: InProfileResetModalProps) {
  const { showToast } = useToast()
  const [step, setStep] = useState<ModalStep>("request")
  const [code, setCode] = useState<string[]>(Array(6).fill(""))
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [copiedPassphrase, setCopiedPassphrase] = useState(false)
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(true)
  const [activeSessions, setActiveSessions] = useState<SecuritySession[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingLabel, setLoadingLabel] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [expiry, setExpiry] = useState(TOKEN_TTL)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [isLockedOut, setIsLockedOut] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const codeRefs = useRef<(HTMLInputElement | null)[]>([])

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setStep("request")
      setCode(Array(6).fill(""))
      setNewPassword("")
      setConfirmPassword("")
      setErrorMsg("")
      setFailedAttempts(0)
      setIsLockedOut(false)
      setShowHelp(false)
      // Auto-trigger request on open
      void handleSendCode()
    }
  }, [isOpen])

  // Expiry timer
  useEffect(() => {
    if (!isOpen || step !== "verify" || expiry <= 0) return
    const interval = setInterval(() => {
      setExpiry((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [isOpen, step, expiry])

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [resendCooldown])

  if (!isOpen) return null

  const handleSendCode = async () => {
    setLoading(true)
    setLoadingLabel("Sending verification code…")
    setErrorMsg("")
    try {
      const result = await requestResetInstructions(userEmail)
      setExpiry(result.expiresIn || TOKEN_TTL)
      setResendCooldown(result.retryAfter || 60)
      setStep("verify")
      setCode(Array(6).fill(""))
      setTimeout(() => {
        codeRefs.current[0]?.focus()
      }, 100)
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : "Could not send verification code.",
      )
    } finally {
      setLoading(false)
    }
  }

  const handleDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1)
    const next = [...code]
    next[index] = digit
    setCode(next)
    setErrorMsg("")
    if (digit && index < 5) {
      codeRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Backspace" && !code[index] && index > 0) {
      const next = [...code]
      next[index - 1] = ""
      setCode(next)
      codeRefs.current[index - 1]?.focus()
    } else if (event.key === "ArrowLeft" && index > 0) {
      codeRefs.current[index - 1]?.focus()
    } else if (event.key === "ArrowRight" && index < 5) {
      codeRefs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (event: React.ClipboardEvent) => {
    event.preventDefault()
    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6)
    if (!pasted) return
    const next = Array(6).fill("")
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i]
    }
    setCode(next)
    codeRefs.current[Math.min(pasted.length, 5)]?.focus()
  }

  const handleVerifyCode = async (event: React.FormEvent) => {
    event.preventDefault()
    const fullCode = code.join("")
    if (fullCode.length !== 6 || expiry <= 0 || isLockedOut || loading) return

    setLoading(true)
    setLoadingLabel("Verifying code…")
    setErrorMsg("")
    try {
      const result = await verifyResetCode(userEmail, fullCode)
      setActiveSessions(result.sessions)
      setExpiry(result.expiresIn)
      setStep("newpass")
    } catch (error) {
      setErrorMsg(
        error instanceof Error ? error.message : "Code not recognised.",
      )
      if (error instanceof AccountApiError) {
        if (typeof error.details.attemptsRemaining === "number") {
          setFailedAttempts(MAX_ATTEMPTS - error.details.attemptsRemaining)
        }
        if (error.details.isLockedOut) setIsLockedOut(true)
        if (error.details.isExpired) setExpiry(0)
      }
    } finally {
      setLoading(false)
    }
  }

  const nistAnalysis = analyzeNistPassword(newPassword, userEmail)
  const isMatch = confirmPassword.length > 0 && newPassword === confirmPassword
  const canSubmitPassword =
    nistAnalysis.allCriticalMet && isMatch && !loading && expiry > 0

  const handleSuggestPassphrase = () => {
    const suggested = generatePassphrase()
    setNewPassword(suggested)
    setConfirmPassword(suggested)
    setShowNew(true)
    setShowConfirm(true)
    setCopiedPassphrase(false)
  }

  const handleCopyPassphrase = async () => {
    try {
      await navigator.clipboard.writeText(newPassword)
      setCopiedPassphrase(true)
      setTimeout(() => setCopiedPassphrase(false), 2500)
    } catch {
      /* clipboard access fallback */
    }
  }

  const handleSavePassword = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSubmitPassword) return

    setLoading(true)
    setLoadingLabel("Saving new password…")
    setErrorMsg("")
    try {
      // keepCurrentSession = true maintains the user's active login in their profile
      await saveNewPassword(newPassword, revokeOtherSessions, true)
      setStep("success")
      showToast({
        title: "Password updated",
        message: "Your new password is active and secured.",
        type: "security",
      })
      onPasswordUpdated()
    } catch (error) {
      setErrorMsg(
        error instanceof Error ? error.message : "Failed to update password.",
      )
    } finally {
      setLoading(false)
    }
  }

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const webmail = getWebmailInfo(userEmail)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-forest/40 backdrop-blur-xs animate-fade-up"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-modal-title"
    >
      <div className="bg-[#FAF7EE] border border-sand rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-sand bg-cream">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-forest/10 flex items-center justify-center text-forest">
              <ShieldCheck className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h2
                id="reset-modal-title"
                className="font-heading text-lg font-bold text-forest leading-tight"
              >
                Reset Account Password
              </h2>
              <p className="text-xs text-dim">
                Secure self-service verification
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-dim hover:text-forest p-1.5 rounded-md hover:bg-sand/30 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-lg text-xs flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 animate-fade-up"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
              <p className="font-medium">{errorMsg}</p>
            </div>
          )}

          {step === "request" && (
            <div className="text-center py-8 space-y-4">
              <RefreshCw className="w-8 h-8 animate-spin text-green mx-auto" />
              <p className="text-sm font-medium text-forest">
                Sending a secure verification code to your email…
              </p>
              <p className="text-xs text-dim">{maskEmail(userEmail)}</p>
            </div>
          )}

          {step === "verify" && (
            <form onSubmit={handleVerifyCode} className="space-y-5">
              <div className="notice notice-green flex items-start gap-2.5 text-xs">
                <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5 text-green" />
                <div>
                  <p className="font-semibold text-forest">
                    Verification code sent
                  </p>
                  <p className="mt-0.5 text-dim">
                    We sent a 6-digit code to{" "}
                    <span className="font-semibold text-forest">
                      {maskEmail(userEmail)}
                    </span>
                    .
                  </p>
                </div>
              </div>

              {/* 6-box OTP Input */}
              <div>
                <label className="block text-xs font-semibold text-forest mb-2">
                  Enter 6-digit verification code
                </label>
                <div
                  className="flex items-center justify-between gap-2 sm:gap-2.5"
                  onPaste={handlePaste}
                >
                  {code.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        codeRefs.current[idx] = el
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      disabled={loading || expiry <= 0 || isLockedOut}
                      className="w-11 h-13 text-center text-xl font-bold rounded-lg border border-sand bg-cream text-forest focus:border-green focus:outline-none transition-all shadow-xs disabled:opacity-50"
                      aria-label={`Digit ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>

              {/* Expiry countdown and resend */}
              <div className="flex items-center justify-between text-xs text-dim pt-1 border-t border-sand/60">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    Expires in:{" "}
                    <span
                      className={`font-mono font-semibold ${
                        expiry < 120 ? "text-red-600" : "text-forest"
                      }`}
                    >
                      {formatTimer(expiry)}
                    </span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => void handleSendCode()}
                  disabled={loading || resendCooldown > 0}
                  className="link text-xs font-medium disabled:opacity-50 disabled:no-underline"
                >
                  {resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : "Resend code"}
                </button>
              </div>

              {failedAttempts > 0 && !isLockedOut && (
                <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                  {MAX_ATTEMPTS - failedAttempts} attempts remaining before
                  lockout.
                </p>
              )}

              {/* Quick webmail link helper */}
              {webmail.isKnown && (
                <div className="pt-1">
                  <a
                    href={webmail.inboxUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-forest hover:text-green font-medium link"
                  >
                    <span>Open {webmail.providerName} inbox</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-outline py-2 px-4 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    code.join("").length !== 6 ||
                    expiry <= 0 ||
                    isLockedOut ||
                    loading
                  }
                  className="btn btn-forest py-2 px-5 text-xs flex items-center gap-1.5"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{loadingLabel}</span>
                    </>
                  ) : (
                    <>
                      <span>Verify Code</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

              {/* Help & Troubleshooting */}
              <div className="border-t border-sand/60 pt-3">
                <button
                  type="button"
                  onClick={() => setShowHelp(!showHelp)}
                  className="flex items-center gap-1.5 text-xs text-dim hover:text-forest transition-colors"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Didn't receive the email?</span>
                </button>
                {showHelp && (
                  <div className="mt-2 text-xs text-dim space-y-1 bg-sand/20 p-2.5 rounded-md leading-relaxed animate-fade-up">
                    <p>• Check your spam or junk email folders.</p>
                    <p>• The code is valid for 15 minutes.</p>
                    <p>• Make sure you have authorized emails from Flux.</p>
                  </div>
                )}
              </div>
            </form>
          )}

          {step === "newpass" && (
            <form onSubmit={handleSavePassword} className="space-y-4">
              <div className="notice notice-green flex items-start gap-2 text-xs">
                <CheckCircle2 className="w-4 h-4 text-green flex-shrink-0 mt-0.5" />
                <p>Identity verified. Enter your new password below.</p>
              </div>

              {/* New Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-forest">
                    New Password
                  </label>
                  <button
                    type="button"
                    onClick={handleSuggestPassphrase}
                    className="inline-flex items-center gap-1 text-xs text-green hover:underline font-medium"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Suggest passphrase</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter at least 15 characters"
                    className="input pr-16 text-xs sm:text-sm font-mono"
                    autoFocus
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-dim">
                    {newPassword && (
                      <button
                        type="button"
                        onClick={handleCopyPassphrase}
                        className="p-1 hover:text-forest rounded"
                        title="Copy to clipboard"
                        aria-label="Copy password"
                      >
                        {copiedPassphrase ? (
                          <Check className="w-3.5 h-3.5 text-green" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="p-1 hover:text-forest rounded"
                      aria-label={showNew ? "Hide password" : "Show password"}
                    >
                      {showNew ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* NIST live validation checklist */}
                <NistPasswordValidator
                  analysis={nistAnalysis}
                  passwordLength={newPassword.length}
                  easyReadMode={easyReadMode}
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-forest mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your new password"
                    className="input pr-10 text-xs sm:text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dim hover:text-forest p-1 rounded"
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                  >
                    {showConfirm ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                {confirmPassword && (
                  <p
                    className={`text-xs mt-1 font-medium ${
                      isMatch ? "text-green" : "text-red-600"
                    }`}
                  >
                    {isMatch ? "✓ Passwords match" : "✕ Passwords do not match"}
                  </p>
                )}
              </div>

              {/* Revoke Sessions Option */}
              <div className="p-3 rounded-lg border border-sand bg-cream/70 space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={revokeOtherSessions}
                    onChange={(e) => setRevokeOtherSessions(e.target.checked)}
                    className="mt-0.5 rounded text-green focus:ring-green accent-forest"
                  />
                  <div className="text-xs">
                    <p className="font-semibold text-forest">
                      Sign out all other devices and active sessions
                    </p>
                    <p className="text-dim mt-0.5">
                      Recommended. Your current session will remain signed in.
                    </p>
                  </div>
                </label>
                {activeSessions.length > 1 && (
                  <p className="text-[11px] text-dim pl-6">
                    {activeSessions.length} active sessions currently recorded.
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-outline py-2 px-4 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSubmitPassword}
                  className="btn btn-forest py-2.5 px-5 text-xs flex items-center gap-1.5"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{loadingLabel}</span>
                    </>
                  ) : (
                    <>
                      <span>Save New Password</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {step === "success" && (
            <div className="text-center py-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-green/10 text-green flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7 stroke-[2.3]" />
              </div>
              <div>
                <h3 className="font-heading text-xl font-bold text-forest">
                  Password Updated
                </h3>
                <p className="text-xs text-dim mt-1">
                  Your new password is now active.
                </p>
              </div>

              <div className="text-xs text-dim bg-cream p-3 rounded-lg border border-sand text-left space-y-1.5">
                <p>
                  <strong className="text-forest">Account:</strong> {userEmail}
                </p>
                <p>
                  <strong className="text-forest">Verification:</strong>{" "}
                  Verified via secure 6-digit email OTP.
                </p>
                {revokeOtherSessions ? (
                  <p className="text-green font-medium">
                    ✓ Other device sessions were safely signed out.
                  </p>
                ) : (
                  <p>Other active sessions were preserved.</p>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="btn btn-forest w-full py-2.5 text-xs"
              >
                Back to Profile Settings
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
