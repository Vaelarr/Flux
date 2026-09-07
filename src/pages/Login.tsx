import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { CheckCircle2, ShieldCheck, Eye, EyeOff, RefreshCw, AlertCircle, ArrowRight } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { FluxLogo } from "./Landing";
import {
  findAccount,
  emailToDocId,
  signInWithGoogleService,
  signInWithAppleService,
} from "../utils/accounts";
import AuthSkeleton from "../components/AuthSkeleton";
import SocialAuthModal from "../components/SocialAuthModal";

export default function Login() {
  const location = useLocation();
  const fromReset = location.state?.fromReset === true;
  const sessionsRevoked = location.state?.sessionsRevoked === true;
  const [email, setEmail] = useState<string>(location.state?.email ?? "");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("Signing into your account…");
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [socialModalState, setSocialModalState] = useState<{
    isOpen: boolean;
    provider: "google" | "apple";
  }>({
    isOpen: false,
    provider: "google",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoadingMsg("Signing into your account…");
    setLoading(true);

    try {
      let acc = findAccount(email);
      if (!acc) {
        // Query Firestore in real-time in case registered on another client
        const snap = await getDoc(doc(db, "users", emailToDocId(email)));
        if (snap.exists()) {
          const data = snap.data();
          acc = {
            id: snap.id,
            name: data.name || "User",
            email: data.email || email,
            password: data.password,
            createdAt: data.createdAt || new Date().toISOString(),
            sessionsCount: (data.sessionsCount || 0) + 1,
            lastPasswordReset: data.lastPasswordReset,
            provider: data.provider,
            avatarUrl: data.avatarUrl,
            firebaseUid: data.firebaseUid,
          };
        }
      }

      setLoading(false);

      if (!acc) {
        setErrorMsg("No account found with this email address. Please create an account or sign in with Google or Apple.");
        return;
      }

      if (acc.provider && !acc.password) {
        const providerName = acc.provider === "google" ? "Google" : "Apple";
        setErrorMsg(`This account was registered using ${providerName}. Please use the "${providerName}" button below to sign in.`);
        return;
      }

      if (acc.password && acc.password !== password) {
        setErrorMsg("Incorrect password. If you recently reset your password, please use your new password. Or use 'Forgot password?' to recover access.");
        return;
      }

      setDone(true);
    } catch (err) {
      setLoading(false);
      setErrorMsg("An unexpected error occurred while verifying credentials. Please try again.");
    }
  };

  const handleSocialClick = async (provider: "Google" | "Apple") => {
    setErrorMsg(null);
    setLoadingMsg(`Connecting with ${provider}…`);
    setLoading(true);

    const lowerProvider = provider.toLowerCase() as "google" | "apple";
    const result =
      provider === "Google" ? await signInWithGoogleService() : await signInWithAppleService();
    setLoading(false);

    if (result.success && result.user) {
      setEmail(result.user.email);
      setDone(true);
    } else if (result.needsFallback) {
      setSocialModalState({
        isOpen: true,
        provider: lowerProvider,
      });
    } else {
      setErrorMsg(result.error || `Failed to sign in with ${provider}.`);
    }
  };

  return (
    <div className="bg-cream min-h-screen flex flex-col">

      {/* Nav */}
      <header className="border-b border-sand">
        <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 md:px-10 h-14">
          <FluxLogo />
          <p className="text-sm text-dim">
            New to Flux?{" "}
            <Link to="/signup" className="link font-medium">Create account</Link>
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
                <p className="font-semibold text-forest text-xs">Credentials updated securely</p>
                <p className="text-xs mt-0.5 text-dim">
                  {sessionsRevoked
                    ? "All prior sessions have been revoked. Sign in with your new password to create a secure session."
                    : "Your email is pre-filled. Enter your new password to sign in."}
                </p>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="mb-6">
            <h1 className="font-heading text-3xl font-bold text-forest mb-1.5">Sign in to Flux</h1>
            <p className="text-sm text-dim">Welcome back.</p>
          </div>

          {errorMsg && (() => {
            const isPopupClosed =
              errorMsg.toLowerCase().includes("closed") ||
              errorMsg.toLowerCase().includes("cancelled") ||
              errorMsg.toLowerCase().includes("blocked");

            return (
              <div
                className={`p-3 mb-4 rounded-lg text-xs flex items-start gap-2.5 animate-fade-up ${
                  isPopupClosed
                    ? "bg-amber-50 border border-amber-200 text-amber-900"
                    : "bg-red-50 border border-red-200 text-red-700"
                }`}
              >
                <AlertCircle
                  className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                    isPopupClosed ? "text-amber-600" : "text-red-500"
                  }`}
                />
                <div className="space-y-1">
                  <p className="font-medium">{errorMsg}</p>
                  {!isPopupClosed && !errorMsg.includes("Google") && !errorMsg.includes("Apple") && (
                    <Link
                      to="/reset-password"
                      state={{ email }}
                      className="inline-flex items-center gap-1 font-semibold text-red-800 hover:underline pt-0.5"
                    >
                      <span>Reset password for this account</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })()}

          {done ? (
            <div className="animate-fade-up text-center py-8">
              <div className="w-14 h-14 rounded-full border-2 border-green flex items-center justify-center mx-auto mb-4 text-green">
                <CheckCircle2 className="w-7 h-7 stroke-[2.2]" />
              </div>
              <p className="font-semibold text-forest text-base">Signed in successfully</p>
              <p className="text-xs text-dim mt-1">Authenticated as <strong className="font-mono text-forest">{email}</strong></p>
              
              <div className="mt-6 pt-4 border-t border-sand flex flex-col gap-2">
                <Link
                  to="/"
                  className="btn btn-forest text-xs py-2.5 w-full flex items-center justify-center gap-1.5"
                >
                  <span>Continue to Timeline</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => { setDone(false); setPassword(""); }}
                  className="btn btn-outline text-xs py-2 w-full text-dim"
                >
                  Sign in with a different account
                </button>
              </div>
            </div>
          ) : loading ? (
            /* Elegant CSS Shimmer Skeleton Screen during login verification */
            <AuthSkeleton
              type="login"
              message={loadingMsg}
              submessage="Verifying credentials and preparing your session"
            />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">

              <div>
                <label className="block text-xs font-semibold text-dim tracking-wide uppercase mb-1.5">Email</label>
                <input
                  type="email" value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrorMsg(null); }}
                  placeholder="you@example.com"
                  required autoFocus={!fromReset}
                  className="input"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-dim tracking-wide uppercase">Password</label>
                  <Link to="/reset-password" state={{ email }} className="text-xs link">Forgot password?</Link>
                </div>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrorMsg(null); }}
                    placeholder="••••••••"
                    required autoFocus={fromReset}
                    className="input pr-10"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-forest transition-colors">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember */}
              <button type="button" onClick={() => setRemember(!remember)}
                className="flex items-center gap-2.5 text-sm text-dim select-none w-full text-left">
                <span className="w-4 h-4 rounded-[3px] border flex items-center justify-center flex-shrink-0 transition-all"
                  style={{
                    borderColor: remember ? "#306D29" : "#C8BF8A",
                    background: remember ? "#306D29" : "transparent",
                  }}>
                  {remember && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-cream" />
                  )}
                </span>
                Keep me signed in for 30 days
              </button>

              <button type="submit" disabled={loading}
                className="btn btn-forest w-full py-3.5 text-sm mt-1">
                {loading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Signing in…</> : "Sign in →"}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 py-1">
                <hr className="rule flex-1" />
                <span className="text-xs text-dim">or</span>
                <hr className="rule flex-1" />
              </div>

              {/* Social */}
              <div className="grid grid-cols-2 gap-2.5">
                <SocialBtn onClick={() => handleSocialClick("Google")}><GoogleIcon /> Google</SocialBtn>
                <SocialBtn onClick={() => handleSocialClick("Apple")}><AppleIcon /> Apple</SocialBtn>
              </div>
            </form>
          )}

          <p className="text-center text-xs text-dim mt-6">
            By signing in, you agree to our{" "}
            <a href="#" className="link">Terms</a> &amp;{" "}
            <a href="#" className="link">Privacy</a>.
          </p>
        </div>
      </div>

      <SocialAuthModal
        isOpen={socialModalState.isOpen}
        provider={socialModalState.provider}
        initialEmail={email}
        onClose={() => setSocialModalState((prev) => ({ ...prev, isOpen: false }))}
        onCancel={() => {
          setErrorMsg(
            `The ${socialModalState.provider === "google" ? "Google" : "Apple"} sign-in window was closed before finishing authentication.`
          );
        }}
        onSuccess={(account) => {
          setEmail(account.email);
          setDone(true);
        }}
      />
    </div>
  );
}

function SocialBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="btn btn-outline text-xs gap-2 w-full py-2.5">
      {children}
    </button>
  );
}

function GoogleIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>;
}
function AppleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.92-2.85-.9.04-2 .6-2.65 1.35-.58.67-1.09 1.74-.95 2.77 1.01.08 2.05-.52 2.68-1.27z" />
    </svg>
  );
}
