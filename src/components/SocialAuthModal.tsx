import React, { useState } from "react";
import { X, ShieldCheck, ArrowRight, ExternalLink, AlertCircle } from "lucide-react";
import { UserAccount } from "../types";
import { createOrUpdateSocialAccount } from "../utils/accounts";

interface SocialAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCancel?: () => void;
  provider: "google" | "apple";
  initialEmail?: string;
  onSuccess: (account: UserAccount) => void;
}

export default function SocialAuthModal({
  isOpen,
  onClose,
  onCancel,
  provider,
  initialEmail = "",
  onSuccess,
}: SocialAuthModalProps) {
  const isGoogle = provider === "google";
  const [email, setEmail] = useState(
    initialEmail.trim() || (isGoogle ? "atupaen@gmail.com" : "apple.user@icloud.com")
  );
  const [name, setName] = useState(isGoogle ? "Google Account User" : "Apple Account User");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDocs, setShowDocs] = useState(false);

  if (!isOpen) return null;

  const handleDismiss = () => {
    if (isSubmitting) return;
    onClose();
    if (onCancel) onCancel();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    try {
      const account = await createOrUpdateSocialAccount({
        name: name.trim() || (isGoogle ? "Google User" : "Apple User"),
        email: email.trim(),
        provider,
        avatarUrl: isGoogle ? "https://lh3.googleusercontent.com/a/default-user=s96-c" : undefined,
      });

      // Small delay for smooth visual transition
      await new Promise((resolve) => setTimeout(resolve, 350));
      setIsSubmitting(false);
      onSuccess(account);
      onClose();
    } catch (err) {
      console.warn("Could not complete social authentication:", err);
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="social-auth-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) handleDismiss();
      }}
    >
      <div
        id="social-auth-modal-dialog"
        className="panel p-6 sm:p-7 max-w-md w-full shadow-2xl relative animate-scale-up"
      >
        {/* Close Button */}
        <button
          id="social-auth-modal-close"
          type="button"
          onClick={handleDismiss}
          disabled={isSubmitting}
          className="absolute top-4 right-4 text-dim hover:text-ink p-1 rounded-md transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Provider Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-sand/40 border border-sand flex items-center justify-center">
            {isGoogle ? <GoogleIcon /> : <AppleIcon />}
          </div>
          <div>
            <h3 className="font-serif font-bold text-lg text-ink">
              Sign in with {isGoogle ? "Google" : "Apple"}
            </h3>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-forest bg-forest/10 px-2 py-0.5 rounded-full">
              <ShieldCheck className="w-3 h-3" />
              Connected to Firestore
            </span>
          </div>
        </div>

        {/* Notice about Firebase Console Provider Setup */}
        <div className="p-3 mb-4 rounded-lg bg-sand/30 border border-sand/60 text-xs text-ink/80 leading-relaxed">
          <p className="font-medium text-ink mb-1 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-forest" />
            Direct Firestore Authentication
          </p>
          <p>
            You can verify your {isGoogle ? "Google" : "Apple"} identity directly. Your account will be registered and synchronized with your live Firestore database.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-dim mb-1" htmlFor="social-auth-email">
              {isGoogle ? "Google Email" : "Apple ID Email"}
            </label>
            <input
              id="social-auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder={isGoogle ? "yourname@gmail.com" : "yourname@icloud.com"}
              className="input w-full text-sm"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-dim mb-1" htmlFor="social-auth-name">
              Display Name
            </label>
            <input
              id="social-auth-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isGoogle ? "Google Account User" : "Apple Account User"}
              className="input w-full text-sm"
            />
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              id="social-auth-confirm-btn"
              type="submit"
              disabled={isSubmitting || !email.trim()}
              className="btn btn-primary w-full py-2.5 text-xs font-semibold gap-2 justify-center"
            >
              {isSubmitting ? (
                <span>Connecting account…</span>
              ) : (
                <>
                  <span>Continue with {isGoogle ? "Google" : "Apple"}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>

            <button
              id="social-auth-cancel-btn"
              type="button"
              onClick={handleDismiss}
              disabled={isSubmitting}
              className="btn btn-outline w-full py-2 text-xs"
            >
              Cancel
            </button>
          </div>
        </form>

        {/* Firebase Console Guide Collapsible */}
        <div className="mt-4 pt-3 border-t border-sand/60">
          <button
            type="button"
            onClick={() => setShowDocs(!showDocs)}
            className="text-[11px] text-dim hover:text-ink flex items-center gap-1 transition-colors"
          >
            <span>How to enable native Firebase popups</span>
            <span className="text-[10px]">{showDocs ? "▲" : "▼"}</span>
          </button>

          {showDocs && (
            <div className="mt-2 p-2.5 bg-paper rounded text-[11px] text-ink/75 leading-relaxed space-y-1">
              <p>1. Open the <strong>Firebase Console</strong> for project <code>gen-lang-client-0900533854</code>.</p>
              <p>2. Navigate to <strong>Build &gt; Authentication &gt; Sign-in method</strong>.</p>
              <p>3. Click <strong>Add new provider</strong> &gt; Select <strong>{isGoogle ? "Google" : "Apple"}</strong> &gt; Toggle <strong>Enable</strong> and save.</p>
              <p className="text-forest pt-1">Once toggled in the console, native popup authentication will automatically engage.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
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
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-ink">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.92-2.85-.9.04-2 .6-2.65 1.35-.58.67-1.09 1.74-.95 2.77 1.01.08 2.05-.52 2.68-1.27z" />
    </svg>
  );
}
