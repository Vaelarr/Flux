import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { X, Eye, EyeOff, RefreshCw, CheckCircle2 } from "lucide-react"
import type { UserAccount } from "../types"
import type { GoogleAccountLink } from "../utils/accounts"

interface Props {
  accountLink: GoogleAccountLink
  initialRemember?: boolean
  onCancel: () => void
  onLinked: (user: UserAccount) => void
}

export default function GoogleAccountLinkModal({
  accountLink,
  initialRemember = false,
  onCancel,
  onLinked,
}: Props) {
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(initialRemember)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const busyRef = useRef(false)
  const cancelRef = useRef(onCancel)
  const activeRef = useRef(true)
  busyRef.current = submitting
  cancelRef.current = onCancel

  useEffect(() => {
    activeRef.current = true
    const previousFocus = document.activeElement as HTMLElement | null
    inputRef.current?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) cancelRef.current()
      if (event.key !== "Tab") return
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), a[href]:not([aria-disabled="true"])',
      )
      if (!controls?.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", handleKey)
    return () => {
      activeRef.current = false
      document.removeEventListener("keydown", handleKey)
      if (previousFocus?.isConnected) previousFocus.focus()
      else
        document
          .querySelector<HTMLButtonElement>("[data-google-signin]")
          ?.focus()
    }
  }, [])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting || !password) return
    setSubmitting(true)
    setError("")
    try {
      const user = await accountLink.complete(password, remember)
      if (activeRef.current) {
        setPassword("")
        onLinked(user)
      }
    } catch (failure) {
      if (activeRef.current) {
        setPassword("")
        setError(
          failure instanceof Error
            ? failure.message
            : "Could not connect Google. Please try again.",
        )
        inputRef.current?.focus()
      }
    } finally {
      if (activeRef.current) setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest/40 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget && !submitting) onCancel()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="google-link-title"
        aria-describedby="google-link-description"
        className="panel p-6 sm:p-7 max-w-sm w-full shadow-xl relative animate-fade-up"
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          aria-label="Close dialog"
          className="absolute top-3 right-3 p-2 text-dim hover:text-forest disabled:opacity-50 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-10 h-10 rounded-full bg-cream border border-sand flex items-center justify-center mb-3">
          <GoogleIcon />
        </div>

        <h2
          id="google-link-title"
          className="font-heading font-bold text-xl text-forest pr-6"
        >
          Connect Google
        </h2>
        <p
          id="google-link-description"
          className="text-sm text-dim mt-2 mb-4 leading-relaxed"
        >
          An account already exists for{" "}
          <strong className="text-forest font-medium break-all">
            {accountLink.email}
          </strong>
          . Enter your Flux password to connect your Google account and sign in.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label
              htmlFor="google-link-password"
              className="block text-xs font-semibold text-dim uppercase mb-1.5"
            >
              Flux password
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                id="google-link-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setError("")
                }}
                disabled={submitting}
                required
                maxLength={1024}
                placeholder="••••••••"
                className="input pr-10"
                aria-invalid={!!error}
                aria-describedby={error ? "google-link-error" : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                disabled={submitting}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-forest transition-colors p-0.5 disabled:opacity-50"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <p
              id="google-link-error"
              role="alert"
              className="text-xs text-red-700 animate-fade-up"
            >
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => setRemember(!remember)}
              role="checkbox"
              aria-checked={remember}
              disabled={submitting}
              className="flex items-center gap-2 text-xs text-dim select-none text-left cursor-pointer disabled:opacity-50"
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

            <Link
              to="/reset-password"
              state={{ email: accountLink.email }}
              className="link text-xs whitespace-nowrap"
              aria-disabled={submitting}
              onClick={(event) => {
                if (submitting) event.preventDefault()
                else onCancel()
              }}
            >
              Forgot password?
            </Link>
          </div>

          <div className="space-y-2 pt-1">
            <button
              type="submit"
              disabled={submitting || !password}
              className="btn btn-forest w-full disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Connecting…</span>
                </>
              ) : (
                "Connect and sign in"
              )}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="btn btn-outline w-full text-dim hover:text-forest disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
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
