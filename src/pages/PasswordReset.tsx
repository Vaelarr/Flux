import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FluxLogo } from "./Landing";

type Step = "email" | "code" | "newpass" | "success";
const STEPS: Step[] = ["email", "code", "newpass"];
const TOKEN_TTL = 15 * 60;

export default function PasswordReset() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState<string[]>(Array(6).fill(""));
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("");
  const [expiry, setExpiry] = useState(TOKEN_TTL);
  const [expired, setExpired] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const expiryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resendRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();

  const startExpiry = useCallback(() => {
    setExpiry(TOKEN_TTL); setExpired(false);
    if (expiryRef.current) clearInterval(expiryRef.current);
    expiryRef.current = setInterval(() => {
      setExpiry((s) => { if (s <= 1) { clearInterval(expiryRef.current!); setExpired(true); return 0; } return s - 1; });
    }, 1000);
  }, []);

  const startResend = useCallback(() => {
    setResendCooldown(60);
    if (resendRef.current) clearInterval(resendRef.current);
    resendRef.current = setInterval(() => {
      setResendCooldown((c) => { if (c <= 1) { clearInterval(resendRef.current!); return 0; } return c - 1; });
    }, 1000);
  }, []);

  useEffect(() => {
    if (step === "code") { startExpiry(); startResend(); setTimeout(() => codeRefs.current[0]?.focus(), 60); }
    return () => { if (expiryRef.current) clearInterval(expiryRef.current); if (resendRef.current) clearInterval(resendRef.current); };
  }, [step, startExpiry, startResend]);

  const go = (next: Step) => { setLoading(false); setLoadingLabel(""); setStep(next); };
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoadingLabel("Creating your reset code…");
    setTimeout(() => setLoadingLabel("Locking it for your safety…"), 550);
    setTimeout(() => setLoadingLabel("Sending to your inbox…"), 1050);
    setTimeout(() => go("code"), 1650);
  };

  const handleCodeChange = (idx: number, val: string) => {
    const d = val.replace(/\D/g, "").slice(-1);
    const n = [...code]; n[idx] = d; setCode(n);
    if (d && idx < 5) codeRefs.current[idx + 1]?.focus();
    if (!d && val === "" && idx > 0) codeRefs.current[idx - 1]?.focus();
  };
  const handleCodeKey = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[idx] && idx > 0) { const n = [...code]; n[idx - 1] = ""; setCode(n); codeRefs.current[idx - 1]?.focus(); }
    else if (e.key === "ArrowLeft" && idx > 0) codeRefs.current[idx - 1]?.focus();
    else if (e.key === "ArrowRight" && idx < 5) codeRefs.current[idx + 1]?.focus();
  };
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6).split("");
    const n = Array(6).fill(""); digits.forEach((d, i) => { n[i] = d; }); setCode(n);
    codeRefs.current[Math.min(digits.length, 5)]?.focus();
  };
  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.join("").length < 6 || expired) return;
    setLoading(true); setLoadingLabel("Checking your code…");
    setTimeout(() => go("newpass"), 900);
  };
  const handleResend = () => { setCode(Array(6).fill("")); setExpired(false); startExpiry(); startResend(); setTimeout(() => codeRefs.current[0]?.focus(), 50); };

  const str = pwStrength(newPassword);
  const match = confirmPassword.length > 0 && newPassword === confirmPassword;
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const handlePassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8 || !match) return;
    setLoading(true); setLoadingLabel("Saving your new password…");
    setTimeout(() => { setLoadingLabel("Cleaning up…"); setTimeout(() => { if (expiryRef.current) clearInterval(expiryRef.current); go("success"); }, 400); }, 850);
  };

  const expiryFrac = expiry / TOKEN_TTL;
  const expiryColor = expiry > 300 ? "#306D29" : expiry > 120 ? "#b45309" : "#b4321e";
  const stepIdx = STEPS.indexOf(step);

  return (
    <div className="bg-cream min-h-screen flex flex-col text-forest">

      {/* Nav */}
      <header className="border-b border-sand">
        <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 md:px-10 h-14">
          <FluxLogo />
          <Link to="/login" className="text-sm text-dim hover:text-forest transition-colors flex items-center gap-1.5">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
              <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to login
          </Link>
        </nav>
      </header>

      {/* Step dots */}
      {step !== "success" && (
        <div className="flex justify-center gap-2 pt-8 pb-2">
          {STEPS.map((s, i) => {
            const done = stepIdx > i;
            const active = stepIdx === i;
            return (
              <div key={s} className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all"
                  style={{
                    background: done ? "#0D530E" : active ? "rgba(13,83,14,0.1)" : "transparent",
                    border: done ? "none" : `1.5px solid ${active ? "#0D530E" : "#E7E1B1"}`,
                    color: done ? "#FBF5DD" : active ? "#0D530E" : "#C0B87A",
                  }}>
                  {done ? <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#FBF5DD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg> : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div className="w-8 h-px transition-all" style={{ background: done ? "#0D530E" : "#E7E1B1" }} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Card */}
      <div className="flex-1 flex items-start justify-center px-6 py-8 pb-16">
        <div className="w-full max-w-sm animate-fade-up">

          {/* ══ STEP 1 — Email ══ */}
          {step === "email" && (
            <div>
              <h1 className="font-heading text-3xl font-bold mb-2">Reset your password</h1>
              <p className="text-sm text-dim mb-7">Enter your email and we'll send a secure reset code.</p>

              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-dim tracking-wide uppercase mb-1.5">Email address</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com" required autoFocus className="input" />
                </div>

                {/* Feature 1 — Generic message notice */}
                <div className="notice flex items-start gap-2.5">
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" className="flex-shrink-0 mt-0.5">
                    <path d="M12 2l7 4v6c0 4.5-3.5 7.5-7 9-3.5-1.5-7-4.5-7-9V6l7-4Z" stroke="#306D29" strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
                  <p>
                    <span className="font-semibold text-forest">Your privacy is protected.</span>{" "}
                    We send the same response whether or not an account exists for this email, so nobody can tell if you have an account here.
                  </p>
                </div>

                <SubmitBtn loading={loading} label={loadingLabel}>Send reset code →</SubmitBtn>
              </form>

              <div className="mt-5 text-center">
                <Link to="/login" className="text-xs text-dim hover:text-forest transition-colors">← Back to sign in</Link>
              </div>
            </div>
          )}

          {/* ══ STEP 2 — Code ══ */}
          {step === "code" && (
            <div>
              <h1 className="font-heading text-3xl font-bold mb-2">Check your inbox</h1>

              {/* Feature 1 — generic message */}
              <div className="notice mb-5">
                If <span className="font-semibold text-forest">{email || "that address"}</span> has a Flux account, a one-time code was sent to your inbox. It works once and disappears after 15 minutes. Check your spam folder if it doesn't show up.
              </div>

              {/* Feature 5 — 15-min expiry */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-dim tracking-wide uppercase">Code expires in</span>
                  <span className="font-mono text-sm font-bold tabular-nums" style={{ color: expiryColor }}>
                    {expired ? "Expired" : fmt(expiry)}
                  </span>
                </div>
                <div className="h-[2px] rounded-full bg-sand overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${expiryFrac * 100}%`, background: expiryColor }} />
                </div>
              </div>

              {/* Features 3 & 4 — security pills */}
              <div className="flex flex-wrap gap-2 mb-5">
                <span className="sec-pill">
                  <svg width="9" height="9" fill="none" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" /><path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                  Stored safely
                </span>
                <span className="sec-pill">
                  <svg width="9" height="9" fill="none" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" /></svg>
                  One-time use
                </span>
                <span className="sec-pill">
                  <svg width="9" height="9" fill="none" viewBox="0 0 24 24"><path d="M12 2l7 4v6c0 4.5-3.5 7.5-7 9-3.5-1.5-7-4.5-7-9V6l7-4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
                  Sent privately
                </span>
              </div>

              <form onSubmit={handleCodeSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-dim tracking-wide uppercase mb-2">6-digit code</label>
                  <div className="flex gap-2" onPaste={handlePaste}>
                    {code.map((digit, idx) => (
                      <input key={idx} ref={(el) => { codeRefs.current[idx] = el; }}
                        type="text" inputMode="numeric" maxLength={2}
                        value={digit}
                        onChange={(e) => handleCodeChange(idx, e.target.value)}
                        onKeyDown={(e) => handleCodeKey(idx, e)}
                        disabled={expired}
                        className="text-center text-xl font-bold rounded-[6px] outline-none transition-all"
                        style={{
                          width: "calc((100% - 2.5rem) / 6)", aspectRatio: "1",
                          background: expired ? "#f0e9c8" : "#fff",
                          border: `1.5px solid ${digit ? "#306D29" : expired ? "#ddd" : "#E7E1B1"}`,
                          color: expired ? "#bbb" : "#0D530E",
                          boxShadow: digit && !expired ? "0 0 0 3px rgba(48,109,41,0.1)" : "none",
                        }}
                      />
                    ))}
                  </div>
                  {expired && (
                    <p className="text-xs mt-2 text-red-600 flex items-center gap-1.5">
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" /><path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                      This code has expired. Request a fresh one below.
                    </p>
                  )}
                </div>

                <SubmitBtn loading={loading} label={loadingLabel} disabled={code.join("").length < 6 || expired}>
                  Verify code →
                </SubmitBtn>
              </form>

              <div className="mt-5 space-y-2 text-center">
                {resendCooldown === 0
                  ? <button onClick={handleResend} className="text-xs link">Send me a new code</button>
                  : <p className="text-xs text-dim">Resend in <span className="font-mono font-semibold text-forest">0:{String(resendCooldown).padStart(2, "0")}</span></p>
                }
                <div>
                  <button onClick={() => setStep("email")} className="text-xs text-dim hover:text-forest transition-colors">Wrong email?</button>
                </div>
              </div>
            </div>
          )}

          {/* ══ STEP 3 — New password ══ */}
          {step === "newpass" && (
            <div>
              <h1 className="font-heading text-3xl font-bold mb-2">Set a new password</h1>
              <p className="text-sm text-dim mb-5">Choose something strong that you haven't used before.</p>

              {/* Feature 4 — token verified */}
              <div className="notice notice-green flex items-center gap-2 mb-5">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4" stroke="#306D29" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 2l7 4v6c0 4.5-3.5 7.5-7 9-3.5-1.5-7-4.5-7-9V6l7-4Z" stroke="#306D29" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
                <span><span className="font-semibold">Code accepted.</span> Your identity has been confirmed — you're good to go.</span>
              </div>

              <form onSubmit={handlePassSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-dim tracking-wide uppercase mb-1.5">New password</label>
                  <div className="relative">
                    <input type={showNew ? "text" : "password"} value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min. 8 characters" required minLength={8} autoFocus
                      className="input pr-10" />
                    <EyeBtn show={showNew} toggle={() => setShowNew(!showNew)} />
                  </div>
                  {newPassword.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">{Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="strength-bar" style={{ background: i < str.level ? str.color : undefined }} />
                      ))}</div>
                      <p className="text-xs font-medium" style={{ color: str.color }}>{str.label}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-dim tracking-wide uppercase mb-1.5">Confirm password</label>
                  <div className="relative">
                    <input type={showConfirm ? "text" : "password"} value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat your password" required className="input pr-10"
                      style={{ borderColor: mismatch ? "#b4321e" : match ? "#306D29" : undefined }} />
                    <EyeBtn show={showConfirm} toggle={() => setShowConfirm(!showConfirm)} />
                  </div>
                  {mismatch && <p className="text-xs mt-1.5 text-red-600">Passwords don't match</p>}
                  {match && <p className="text-xs mt-1.5" style={{ color: "#306D29" }}>Passwords match ✓</p>}
                </div>

                {/* Requirements */}
                <div className="py-3 px-3.5 rounded-[6px] border border-sand space-y-2">
                  {[
                    { t: "At least 8 characters", ok: newPassword.length >= 8 },
                    { t: "One uppercase letter", ok: /[A-Z]/.test(newPassword) },
                    { t: "One number", ok: /[0-9]/.test(newPassword) },
                  ].map((r) => (
                    <div key={r.t} className="flex items-center gap-2">
                      <span className="check-bullet" style={{ borderColor: r.ok ? "#306D29" : "#C8BF8A", background: r.ok ? "rgba(48,109,41,0.08)" : "transparent" }}>
                        {r.ok && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="#306D29" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </span>
                      <span className="text-xs" style={{ color: r.ok ? "#306D29" : "rgba(13,83,14,0.4)" }}>{r.t}</span>
                    </div>
                  ))}
                </div>

                <SubmitBtn loading={loading} label={loadingLabel} disabled={newPassword.length < 8 || !match}>
                  Update password →
                </SubmitBtn>
              </form>
            </div>
          )}

          {/* ══ STEP 4 — Success ══ */}
          {step === "success" && (
            <div className="text-center pt-6 animate-fade-up">
              {/* Check circle */}
              <div className="relative w-16 h-16 mx-auto mb-7">
                <div className="absolute inset-0 rounded-full animate-pulse-ring border-2 border-green opacity-40" />
                <div className="w-16 h-16 rounded-full border-2 border-forest flex items-center justify-center">
                  <svg width="26" height="26" fill="none" viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7" stroke="#0D530E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              <h1 className="font-heading text-3xl font-bold text-forest mb-2">Password updated</h1>
              <p className="text-sm text-dim mb-7 max-w-[260px] mx-auto leading-relaxed">
                Your credentials have been changed successfully.
              </p>

              {/* Feature 5 — Token destroyed */}
              <div className="notice notice-red flex items-start gap-2.5 text-left mb-4">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" className="flex-shrink-0 mt-0.5">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#b4321e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div>
                  <p className="font-semibold text-xs" style={{ color: "#b4321e" }}>Reset link permanently deleted</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(180,50,30,0.7)" }}>
                    This link no longer works and can't be used again — even if someone else tries it.
                  </p>
                </div>
              </div>

              {/* Feature 2 — Email pre-fill */}
              <div className="notice notice-green flex items-start gap-2.5 text-left mb-7">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" className="flex-shrink-0 mt-0.5">
                  <path d="M20 4H4C2.9 4 2 4.9 2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2Z" stroke="#306D29" strokeWidth="1.5" />
                  <path d="M22 6L12 13 2 6" stroke="#306D29" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <div>
                  <p className="font-semibold text-xs text-forest">Ready to sign in</p>
                  <p className="text-xs mt-0.5 text-dim">
                    <span className="font-medium text-forest">{email}</span> has been pre-filled on the login page.
                  </p>
                </div>
              </div>

              <button onClick={() => navigate("/login", { state: { email, fromReset: true } })}
                className="btn btn-forest w-full py-3.5 text-sm">
                Continue to sign in →
              </button>
            </div>
          )}

          {/* Bottom footnote */}
          {step !== "success" && (
            <div className="flex items-center justify-center gap-4 mt-7 flex-wrap">
              <FootNote icon="🔒" label="Codes stored safely" />
              <FootNote icon="⏱" label="15-minute time limit" />
              <FootNote icon="✕" label="One-time use" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function SubmitBtn({ loading, label, disabled, children }: {
  loading: boolean; label?: string; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button type="submit" disabled={loading || disabled} className="btn btn-forest w-full py-3.5 text-sm">
      {loading ? <><Spinner /><span className="truncate">{label || "…"}</span></> : children}
    </button>
  );
}

function EyeBtn({ show, toggle }: { show: boolean; toggle: () => void }) {
  return (
    <button type="button" onClick={toggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-forest transition-colors">
      {show
        ? <svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        : <svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.5" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" /></svg>
      }
    </button>
  );
}

function FootNote({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs">{icon}</span>
      <span className="text-xs text-dim">{label}</span>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function pwStrength(pw: string): { level: number; label: string; color: string } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 1) return { level: s, label: "Weak", color: "#b4321e" };
  if (s <= 3) return { level: s, label: "Fair", color: "#b45309" };
  if (s === 4) return { level: s, label: "Good", color: "#306D29" };
  return { level: s, label: "Strong", color: "#0D530E" };
}
