import { useState } from "react";
import { Mail, ExternalLink, Copy, Check, ShieldAlert, X, AlertCircle, ArrowRight, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import { maskEmail } from "../utils/security";
import { findAccount } from "../utils/accounts";

interface EmailSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  code: string;
  token: string;
  onUseMagicLink: () => void;
  onUseCode: (codeStr: string) => void;
}

export default function EmailSimulatorModal({
  isOpen,
  onClose,
  email,
  code,
  onUseMagicLink,
  onUseCode,
}: EmailSimulatorModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const account = findAccount(email);
  const isOAuthOnly = account && account.provider && !account.password;
  const isUnregistered = !account;

  const handleCopy = () => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFillCode = () => {
    onUseCode(code);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest/50 backdrop-blur-xs animate-fade-up">
      <div className="bg-cream w-full max-w-lg rounded-xl border border-sand shadow-2xl overflow-hidden text-forest flex flex-col max-h-[90vh]">
        {/* Email client top bar */}
        <div className="bg-sand/70 px-5 py-3.5 border-b border-sand flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-forest text-cream flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-forest flex items-center gap-1.5">
                <span>Flux Security Mail</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-forest/10 text-forest rounded font-mono">
                  security@flux.social
                </span>
              </div>
              <p className="text-[11px] text-forest/70">To: {email || "you@example.com"} • Just now</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-dim hover:text-forest hover:bg-sand/60 transition-colors cursor-pointer"
            aria-label="Close email preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Email body */}
        <div className="p-6 overflow-y-auto space-y-5 bg-white text-sm">
          
          {/* Header */}
          <div className="border-b border-sand/50 pb-4">
            <h2 className="font-heading text-xl sm:text-2xl font-bold text-forest">
              {isOAuthOnly
                ? `Account access info for ${maskEmail(email)}`
                : isUnregistered
                ? `Flux account inquiry for ${maskEmail(email)}`
                : `Password reset request for ${maskEmail(email)}`}
            </h2>
            <p className="text-xs text-forest/70 mt-1">
              Sent in response to a password recovery request on Flux.
            </p>
          </div>

          {/* Scenario A: OAuth Account (Registered via Google or Apple) */}
          {isOAuthOnly ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <AlertCircle className="w-4 h-4 text-amber-700" />
                  <span>You sign in with {account.provider === "google" ? "Google" : "Apple"}</span>
                </div>
                <p className="text-xs leading-relaxed">
                  Your Flux account was created using your <strong>{account.provider === "google" ? "Google" : "Apple"}</strong> account, so you don't need a standalone password.
                </p>
              </div>

              <div className="pt-1">
                <Link
                  to="/login"
                  onClick={onClose}
                  className="btn btn-forest w-full py-3.5 text-sm flex items-center justify-center gap-2"
                >
                  <span>Sign in with {account.provider === "google" ? "Google" : "Apple"}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <p className="text-xs text-center text-dim mt-2">
                  Or continue below to set up an independent password if you prefer:
                </p>
              </div>

              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => {
                    onUseMagicLink();
                    onClose();
                  }}
                  className="link text-xs font-medium"
                >
                  Set a standalone password anyway →
                </button>
              </div>
            </div>
          ) : isUnregistered ? (
            /* Scenario B: Unregistered Account (Anti-Enumeration Email Dispatch) */
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-sand/30 border border-sand text-forest space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <UserPlus className="w-4 h-4 text-green" />
                  <span>No Flux account was found with this email</span>
                </div>
                <p className="text-xs text-dim leading-relaxed">
                  We received a request to reset the password for <strong>{email}</strong>, but there is currently no account registered under this address.
                </p>
              </div>

              <div className="pt-1">
                <Link
                  to="/signup"
                  state={{ email }}
                  onClick={onClose}
                  className="btn btn-forest w-full py-3.5 text-sm flex items-center justify-center gap-2"
                >
                  <span>Create a new Flux account</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <p className="text-xs text-center text-dim mt-2">
                  If this was a typo, check your email address and request again.
                </p>
              </div>

              {/* Simulation convenience path */}
              <div className="pt-2 border-t border-sand/40 text-center">
                <p className="text-[11px] text-dim mb-1.5 font-medium">Developer / Testing Simulation:</p>
                <button
                  type="button"
                  onClick={() => {
                    onUseMagicLink();
                    onClose();
                  }}
                  className="text-xs link text-green font-semibold"
                >
                  Test reset flow for this new email address anyway →
                </button>
              </div>
            </div>
          ) : (
            /* Scenario C: Standard Password Account */
            <div className="space-y-5">
              <div className="space-y-3">
                <p className="text-xs sm:text-sm text-dim leading-relaxed">
                  <strong>Option 1:</strong> If you are reading this on the same computer or phone where you asked to reset your password, click this button to continue immediately:
                </p>

                {/* Magic Link Button */}
                <div className="pt-1 pb-1">
                  <button
                    type="button"
                    id="btn-use-magic-link"
                    onClick={() => {
                      onUseMagicLink();
                      onClose();
                    }}
                    className="btn btn-forest w-full py-3.5 text-sm font-semibold flex items-center justify-center gap-2 shadow-sm hover:scale-[1.01] transition-transform cursor-pointer"
                  >
                    <span>Reset Password in 1 Click</span>
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  <p className="text-xs text-center text-dim mt-1.5">
                    ✓ Safe single-use link • Automatically expires in 15 minutes
                  </p>
                </div>
              </div>

              {/* Alternative 6-digit code */}
              <div className="p-4 rounded-lg bg-sand/25 border border-sand space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-forest">
                    Option 2: Enter this 6-digit code
                  </span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="text-xs font-semibold text-green hover:text-forest flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "Copied to clipboard!" : "Copy code"}</span>
                  </button>
                </div>

                <p className="text-xs text-dim">
                  If you are looking at your email on a different screen (like your phone), enter this code into the Flux website:
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                  <div className="font-mono text-3xl font-extrabold tracking-widest text-forest py-1 px-3 bg-white rounded border border-sand">
                    {code ? `${code.slice(0, 3)} ${code.slice(3, 6)}` : "649 281"}
                  </div>
                  <button
                    type="button"
                    onClick={handleFillCode}
                    className="btn btn-outline text-xs py-2 px-3.5 w-full sm:w-auto"
                  >
                    Use code in form →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Security Context Details */}
          <div className="p-3.5 rounded-lg bg-cream/40 border border-sand/60 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-forest">
              <ShieldAlert className="w-4 h-4 text-amber-700" />
              <span>Did you not ask to reset your password?</span>
            </div>
            <p className="text-dim leading-relaxed text-xs">
              If you didn't make this request, you can safely ignore this email. Your current password remains completely safe and unchanged. No one can access your account without your email inbox.
            </p>
          </div>
        </div>

        {/* Modal footer */}
        <div className="bg-sand/30 px-5 py-3 border-t border-sand flex items-center justify-between text-xs text-dim">
          <span className="font-medium">Flux Security Simulation</span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-forest hover:underline cursor-pointer"
          >
            Close preview
          </button>
        </div>
      </div>
    </div>
  );
}

