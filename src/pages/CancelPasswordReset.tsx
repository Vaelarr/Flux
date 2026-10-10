import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { AlertTriangle, LoaderCircle, Shield, ShieldCheck } from "lucide-react"
import FluxLogo from "../components/FluxLogo"
import { AccountApiError, cancelResetRequest } from "../utils/accounts"

type Status = "ready" | "submitting" | "canceled" | "unavailable"

export default function CancelPasswordReset() {
  const [token] = useState(
    () => new URLSearchParams(window.location.hash.slice(1)).get("token") || "",
  )
  const [status, setStatus] = useState<Status>(
    /^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(token) ? "ready" : "unavailable",
  )
  const [error, setError] = useState<string | null>(null)
  const submitting = useRef(false)

  useEffect(() => {
    // Opening an email link never cancels a request. Only the button sends POST.
    // Keep the capability in memory and remove it from the address bar.
    window.history.replaceState(
      window.history.state,
      "",
      "/reset-password/cancel",
    )
  }, [])

  const cancel = async () => {
    if (submitting.current || status !== "ready") return
    submitting.current = true
    setStatus("submitting")
    setError(null)
    try {
      await cancelResetRequest(token)
      setStatus("canceled")
    } catch (error) {
      if (error instanceof AccountApiError && error.status === 400) {
        setStatus("unavailable")
      } else {
        setError(error instanceof Error ? error.message : "Please try again.")
        setStatus("ready")
      }
    } finally {
      submitting.current = false
    }
  }

  const canceled = status === "canceled"
  const unavailable = status === "unavailable"
  const busy = status === "submitting"

  return (
    <div className="min-h-screen bg-cream flex flex-col px-5 py-8 sm:py-12">
      <header className="mx-auto w-full max-w-md mb-10">
        <FluxLogo />
      </header>

      <main
        className="panel mx-auto w-full max-w-md p-6 sm:p-8"
        aria-labelledby="cancel-title"
      >
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-cream">
          {canceled ? (
            <ShieldCheck size={24} aria-hidden="true" />
          ) : unavailable ? (
            <AlertTriangle size={24} aria-hidden="true" />
          ) : (
            <Shield size={24} aria-hidden="true" />
          )}
        </div>
        <div aria-live="polite" aria-atomic="true">
          <h1 id="cancel-title" className="font-heading text-2xl mb-3">
            {canceled
              ? "Reset request canceled"
              : unavailable
                ? "This link is no longer available"
                : "Didn't request a password reset?"}
          </h1>
          <p className="text-sm text-dim leading-relaxed">
            {canceled
              ? "The code and link for this request are disabled. Any pending password change using this request has also been canceled. Your password and signed-in sessions stay unchanged."
              : unavailable
                ? "This cancellation link may have expired, been replaced, or already been used. Open the link from your latest recovery email. If you're concerned, reset your password and review your account security."
                : "Confirm below to disable this request's verification code, reset link, and any pending password change. A reset request alone does not change your password."}
          </p>
        </div>

        {!canceled && !unavailable && (
          <div className="mt-6">
            {error && (
              <p role="alert" className="mb-4 text-sm text-red-700">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              className="btn btn-forest w-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest"
            >
              {busy && (
                <LoaderCircle
                  size={16}
                  className="animate-spin"
                  aria-hidden="true"
                />
              )}
              {busy ? "Canceling request…" : "Cancel this reset request"}
            </button>
            <p className="mt-3 text-xs text-dim leading-relaxed">
              This only cancels the request in this email. It won't block future
              requests or sign you out.
            </p>
          </div>
        )}

        <div className="mt-7 border-t border-sand pt-6">
          <h2 className="text-sm font-semibold mb-2">
            Review your account security
          </h2>
          <p className="text-sm text-dim leading-relaxed mb-4">
            If you suspect someone has access, sign in to check your devices,
            sign out unfamiliar sessions, and change your password.
          </p>
          <Link to="/profile?tab=security" className="btn btn-outline w-full">
            Review account security
          </Link>
          {unavailable && (
            <Link
              to="/reset-password"
              className="mt-4 block text-center text-sm underline underline-offset-4"
            >
              Reset your password
            </Link>
          )}
        </div>
      </main>

      <footer className="mt-6 text-center">
        <Link
          to="/login"
          className="text-sm text-dim underline underline-offset-4"
        >
          Back to sign in
        </Link>
      </footer>
    </div>
  )
}
