import { useState } from "react";
import { Mail, ExternalLink, Copy, Check, ShieldAlert, X } from "lucide-react";
import { maskEmail } from "../utils/security";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest/40 backdrop-blur-xs animate-fade-up">
      <div className="bg-cream w-full max-w-lg rounded-xl border border-sand shadow-2xl overflow-hidden text-forest flex flex-col max-h-[90vh]">
        {/* Email client header */}
        <div className="bg-sand/60 px-5 py-3.5 border-b border-sand flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-forest text-cream flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-forest flex items-center gap-1.5">
                <span>Flux Security</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-forest/10 text-forest rounded font-mono">security@flux.social</span>
              </div>
              <p className="text-[11px] text-dim">To: {email || "you@example.com"} • Just now</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-dim hover:text-forest hover:bg-sand/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Email body */}
        <div className="p-6 overflow-y-auto space-y-5 bg-white text-sm">
          <div className="border-b border-sand/40 pb-4">
            <h2 className="font-heading text-xl font-bold text-forest">Password reset request for {maskEmail(email)}</h2>
            <p className="text-xs text-dim mt-1">We received a request to reset your Flux account password.</p>
          </div>

          <div className="space-y-3">
            <p className="text-xs text-dim leading-relaxed">
              Click the button below to quickly reset your password in one tap:
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
                className="btn btn-forest w-full py-3 text-sm flex items-center justify-center gap-2 shadow-sm hover:scale-[1.01] transition-transform"
              >
                <span>Reset Password Now</span>
                <ExternalLink className="w-4 h-4" />
              </button>
              <p className="text-xs text-center text-dim mt-1.5">
                ✓ Safe single-use link • Valid for 15 minutes
              </p>
            </div>
          </div>

          {/* Alternative 6-digit code */}
          <div className="p-4 rounded-lg bg-sand/25 border border-sand space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-forest">
                Or enter this 6-digit code:
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs font-medium text-green hover:text-forest flex items-center gap-1 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy code"}
              </button>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="font-mono text-2xl font-bold tracking-widest text-forest py-1">
                {code ? `${code.slice(0, 3)} ${code.slice(3, 6)}` : "649 281"}
              </div>
              <button
                type="button"
                onClick={handleFillCode}
                className="btn btn-outline text-xs py-1.5 px-3"
              >
                Use code in form →
              </button>
            </div>
          </div>

          {/* Security Context Details */}
          <div className="p-3 rounded-md bg-cream/40 border border-sand/60 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-forest">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
              <span>Did you not request this?</span>
            </div>
            <p className="text-dim leading-relaxed text-xs">
              If you did not make this request, you can safely ignore this email. Your current password remains safe and unchanged.
            </p>
          </div>
        </div>

        {/* Modal footer */}
        <div className="bg-sand/30 px-5 py-3 border-t border-sand flex items-center justify-between text-xs text-dim">
          <span>Flux Security Infrastructure Simulation</span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-forest hover:underline"
          >
            Close preview
          </button>
        </div>
      </div>
    </div>
  );
}
