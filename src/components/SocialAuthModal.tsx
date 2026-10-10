import { useEffect, useRef } from "react"
import { X, AlertCircle } from "lucide-react"

interface SocialAuthModalProps {
  isOpen: boolean
  onClose: () => void
  onRetry: () => void
}

export default function SocialAuthModal({
  isOpen,
  onClose,
  onRetry,
}: SocialAuthModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const retryRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return
    const previousFocus = document.activeElement as HTMLElement | null
    retryRef.current?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current()
      if (event.key !== "Tab") return
      const buttons =
        dialogRef.current?.querySelectorAll<HTMLButtonElement>("button")
      if (!buttons?.length) return
      const first = buttons[0]
      const last = buttons[buttons.length - 1]
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
      document.removeEventListener("keydown", handleKey)
      previousFocus?.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest/40 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="social-auth-title"
        aria-describedby="social-auth-description"
        className="panel p-6 sm:p-7 max-w-sm w-full shadow-xl relative"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-2 text-dim hover:text-forest"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>
        <AlertCircle className="w-7 h-7 text-green mb-4" aria-hidden="true" />
        <h2
          id="social-auth-title"
          className="font-heading font-bold text-xl text-forest pr-4"
        >
          Google sign-in unavailable
        </h2>
        <p id="social-auth-description" className="text-sm text-dim mt-2 mb-5">
          Try again, or continue with email.
        </p>
        <div className="space-y-2">
          <button
            ref={retryRef}
            type="button"
            onClick={onRetry}
            className="btn btn-forest w-full"
          >
            Try Google again
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-outline w-full"
          >
            Use email
          </button>
        </div>
      </div>
    </div>
  )
}
