import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FluxLogo } from "./Landing";

export default function Login() {
  const location = useLocation();
  const fromReset = location.state?.fromReset === true;
  const [email, setEmail] = useState<string>(location.state?.email ?? "");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { setLoading(false); setDone(true); }, 1200);
  };

  return (
    <div className="bg-cream min-h-screen flex flex-col">

      {/* Nav */}
      <header className="border-b border-sand">
        <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 md:px-10 h-14">
          <FluxLogo />
          <p className="text-sm text-dim">
            New to Flux?{" "}
            <Link to="/" className="link font-medium">Create account</Link>
          </p>
        </nav>
      </header>

      {/* Form area */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Pre-fill banner (Feature 2) */}
          {fromReset && !done && (
            <div className="notice notice-green flex items-start gap-2.5 mb-5 animate-fade-up">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" className="flex-shrink-0 mt-0.5">
                <path d="M9 12l2 2 4-4" stroke="#306D29" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="9" stroke="#306D29" strokeWidth="1.5" />
              </svg>
              <div>
                <p className="font-semibold text-forest text-xs">Password updated</p>
                <p className="text-xs mt-0.5 text-dim">Your email has been pre-filled — just enter your new password.</p>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="mb-8">
            <h1 className="font-heading text-3xl font-bold text-forest mb-1.5">Sign in to Flux</h1>
            <p className="text-sm text-dim">Welcome back.</p>
          </div>

          {done ? (
            <div className="animate-fade-up text-center py-8">
              <div className="w-14 h-14 rounded-full border-2 border-green flex items-center justify-center mx-auto mb-4">
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7" stroke="#306D29" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="font-semibold text-forest">Signed in</p>
              <p className="text-sm text-dim mt-1">Redirecting to your feed…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">

              <div>
                <label className="block text-xs font-semibold text-dim tracking-wide uppercase mb-1.5">Email</label>
                <input
                  type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required autoFocus={!fromReset}
                  className="input"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-dim tracking-wide uppercase">Password</label>
                  <Link to="/reset-password" className="text-xs link">Forgot password?</Link>
                </div>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required autoFocus={fromReset}
                    className="input pr-10"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-forest transition-colors">
                    {showPass ? <EyeOff /> : <Eye />}
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
                    <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                      <path d="M1.5 4.5l2 2 4-4" stroke="#FBF5DD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                Keep me signed in for 30 days
              </button>

              <button type="submit" disabled={loading}
                className="btn btn-forest w-full py-3.5 text-sm mt-1">
                {loading ? <><Spinner /> Signing in…</> : "Sign in →"}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 py-1">
                <hr className="rule flex-1" />
                <span className="text-xs text-dim">or</span>
                <hr className="rule flex-1" />
              </div>

              {/* Social */}
              <div className="grid grid-cols-2 gap-2.5">
                <SocialBtn><GoogleIcon /> Google</SocialBtn>
                <SocialBtn><GitHubIcon /> GitHub</SocialBtn>
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
    </div>
  );
}

function SocialBtn({ children }: { children: React.ReactNode }) {
  return (
    <button type="button" className="btn btn-outline text-xs gap-2 w-full py-2.5">
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function Eye() {
  return <svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.5" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" /></svg>;
}
function EyeOff() {
  return <svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}
function GoogleIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>;
}
function GitHubIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>;
}
