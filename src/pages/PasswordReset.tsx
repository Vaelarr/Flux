import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  CheckCircle2, Clock, Eye, EyeOff, Sparkles, Smartphone, Laptop,
  ArrowRight, Mail, RefreshCw, Copy, Check, ExternalLink, ChevronDown, Glasses,
} from "lucide-react";
import { FluxLogo } from "./Landing";
import type { ResetStep, SecuritySession } from "../types";
import { analyzeNistPassword, generatePassphrase, maskEmail, getWebmailInfo } from "../utils/security";
import {
  AccountApiError, requestResetInstructions, verifyResetCode, verifyResetLink, saveNewPassword,
  type ResetVerificationResponse,
} from "../utils/accounts";
import NistPasswordValidator from "../components/NistPasswordValidator";
import { useToast } from "../components/Toast";

const STEPS: { key: ResetStep; label: string; stepNumber: number }[] = [
  { key: "email", label: "Email", stepNumber: 1 },
  { key: "verification", label: "Verify", stepNumber: 2 },
  { key: "newpass", label: "Password", stepNumber: 3 },
];
const TOKEN_TTL = 15 * 60;
const MAX_ATTEMPTS = 5;
const messageOf = (error: unknown) => error instanceof Error ? error.message : "Please try again.";

export default function PasswordReset() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const fromSignup = location.state?.fromSignup === true;
  const [linkToken] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("token") ||
    new URLSearchParams(window.location.search).get("token") || "");
  const linkRequest = useRef<Promise<ResetVerificationResponse> | null>(null);
  const [easyReadMode, setEasyReadMode] = useState(() => {
    try { return localStorage.getItem("flux_easy_read_mode") === "true"; } catch { return false; }
  });
  const toggleEasyReadMode = () => {
    setEasyReadMode(!easyReadMode);
    try { localStorage.setItem("flux_easy_read_mode", String(!easyReadMode)); } catch { /* Optional preference. */ }
  };
  const [step, setStep] = useState<ResetStep>("email");
  const [email, setEmail] = useState(location.state?.email || "");
  const [showFullEmail, setShowFullEmail] = useState(false);
  const [code, setCode] = useState<string[]>(Array(6).fill(""));
  const [inputMode, setInputMode] = useState<"split" | "single">("split");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState<"otp" | "magic_link">("otp");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [copiedPassphrase, setCopiedPassphrase] = useState(false);
  const [revokeAllSessions, setRevokeAllSessions] = useState(true);
  const [sessionsRevoked, setSessionsRevoked] = useState(false);
  const [showSessionsList, setShowSessionsList] = useState(false);
  const [activeSessions, setActiveSessions] = useState<SecuritySession[]>([]);
  const [loading, setLoading] = useState(Boolean(linkToken));
  const [loadingLabel, setLoadingLabel] = useState(linkToken ? "Checking reset link\u2026" : "");
  const [codeError, setCodeError] = useState("");
  const [formError, setFormError] = useState("");
  const [expiry, setExpiry] = useState(TOKEN_TTL);
  const [resendCooldown, setResendCooldown] = useState(0);
  const expired = expiry <= 0;
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);
  const singleCodeRef = useRef<HTMLInputElement>(null);
  const [isTroubleshooterOpen, setIsTroubleshooterOpen] = useState(false);
  const [isHelpAccordionOpen, setIsHelpAccordionOpen] = useState(false);

  useEffect(() => {
    if (!linkToken) return;
    let active = true;
    // Reuse the request when React checks effects twice in development.
    linkRequest.current ??= verifyResetLink(linkToken);
    window.history.replaceState(window.history.state, "", "/reset-password");
    void linkRequest.current.then((result) => {
      if (!active) return;
      setEmail(result.email);
      setActiveSessions(result.sessions);
      setExpiry(result.expiresIn);
      setVerificationMethod("magic_link");
      setStep("newpass");
    }).catch((error: unknown) => {
      if (active) setFormError(messageOf(error));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [linkToken]);

  useEffect(() => {
    if (step !== "verification" && step !== "newpass") return;
    const timer = setInterval(() => {
      setExpiry((value) => Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [step]);
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);
  useEffect(() => {
    if (step === "verification" && !loading) {
      (inputMode === "split" ? codeRefs.current[0] : singleCodeRef.current)?.focus();
    }
  }, [step, inputMode, loading]);

  const fmt = (seconds: number) => String(Math.floor(seconds / 60)).padStart(2, "0") + ":" +
    String(seconds % 60).padStart(2, "0");

  const requestInstructions = async (resending = false) => {
    if (loading || (resending && resendCooldown > 0)) return;
    setFormError("");
    setLoading(true);
    setLoadingLabel("Sending instructions\u2026");
    const cleanEmail = email.trim().toLowerCase();
    try {
      const result = await requestResetInstructions(cleanEmail);
      setEmail(cleanEmail);
      setCode(Array(6).fill(""));
      setCodeError("");
      setFailedAttempts(0);
      setIsLockedOut(false);
      setExpiry(result.expiresIn);
      setResendCooldown(result.retryAfter);
      setStep("verification");
      if (resending) showToast({
        title: "Check your email", message: "If an account matches, new instructions are on the way.", type: "notice-green",
      });
    } catch (error) {
      setFormError(messageOf(error));
      if (error instanceof AccountApiError && typeof error.details.retryAfter === "number") {
        setResendCooldown(error.details.retryAfter);
      }
    } finally { setLoading(false); }
  };
  const handleEmailSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (email.trim()) void requestInstructions();
  };
  const handleResend = () => void requestInstructions(true);
  const handleCodeChange = (index: number, value: string) => {
    setCodeError("");
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[index] = digit;
    setCode(next);
    if (digit && index < 5) codeRefs.current[index + 1]?.focus();
  };
  const handleSingleInputChange = (value: string) => {
    setCodeError("");
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setCode(Array.from({ length: 6 }, (_, index) => digits[index] || ""));
  };
  const handleCodeKey = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !code[index] && index > 0) {
      const next = [...code]; next[index - 1] = ""; setCode(next);
      codeRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowLeft" && index > 0) codeRefs.current[index - 1]?.focus();
    else if (event.key === "ArrowRight" && index < 5) codeRefs.current[index + 1]?.focus();
  };
  const pasteDigits = (value: string) => {
    handleSingleInputChange(value);
    if (inputMode === "split") codeRefs.current[Math.min(value.replace(/\D/g, "").length, 5)]?.focus();
  };
  const handlePaste = (event: React.ClipboardEvent) => {
    event.preventDefault();
    pasteDigits(event.clipboardData.getData("text"));
  };
  const handleClipboardPaste = async () => {
    try { pasteDigits(await navigator.clipboard.readText()); }
    catch { setCodeError("Type the code or paste it into the code box."); }
  };
  const handleCodeSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (code.join("").length !== 6 || expired || isLockedOut || loading) return;
    setLoading(true); setLoadingLabel("Checking code\u2026"); setCodeError(""); setFormError("");
    try {
      const result = await verifyResetCode(email, code.join(""));
      setEmail(result.email); setActiveSessions(result.sessions); setExpiry(result.expiresIn);
      setVerificationMethod("otp"); setStep("newpass");
    } catch (error) {
      setCodeError(messageOf(error));
      if (error instanceof AccountApiError) {
        if (typeof error.details.attemptsRemaining === "number") {
          setFailedAttempts(MAX_ATTEMPTS - error.details.attemptsRemaining);
        }
        if (error.details.isLockedOut) setIsLockedOut(true);
        if (error.details.isExpired) setExpiry(0);
      }
    } finally { setLoading(false); }
  };

  const nistAnalysis = analyzeNistPassword(newPassword, email);
  const match = confirmPassword.length > 0 && newPassword === confirmPassword;
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmitPassword = nistAnalysis.allCriticalMet && match && !loading && !expired;
  const handleSuggestPassphrase = () => {
    const suggested = generatePassphrase();
    setNewPassword(suggested); setConfirmPassword(suggested);
    setShowNew(true); setShowConfirm(true); setCopiedPassphrase(false);
  };
  const handleCopyPassphrase = async () => {
    try {
      await navigator.clipboard.writeText(newPassword);
      setCopiedPassphrase(true);
      setTimeout(() => setCopiedPassphrase(false), 2500);
    } catch { setFormError("Copy the password directly from the password box."); }
  };
  const handlePassSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmitPassword) return;
    setLoading(true); setLoadingLabel("Saving password\u2026"); setFormError("");
    try {
      const result = await saveNewPassword(newPassword, revokeAllSessions);
      setSessionsRevoked(result.sessionsRevoked); setNewPassword(""); setConfirmPassword("");
      setStep("success");
      showToast({ title: "Password updated", message: "Sign in with your new password.", type: "security" });
    } catch (error) {
      setFormError(messageOf(error));
      if (error instanceof AccountApiError && error.details.isExpired) setExpiry(0);
    } finally { setLoading(false); }
  };

  const expiryColor = expiry > 300 ? "#306D29" : expiry > 120 ? "#b45309" : "#b4321e";
  const stepIdx = STEPS.findIndex((item) => item.key === step);
  const webmail = getWebmailInfo(email);
  return (
    <div
      className={`bg-cream min-h-screen flex flex-col text-forest ${
        easyReadMode ? "text-base" : "text-sm"
      }`}
    >
<header className="border-b border-sand bg-cream/90 backdrop-blur-xs sticky top-0 z-40">
        <nav className="max-w-5xl mx-auto flex items-center justify-between px-4 sm:px-6 h-15">
          <FluxLogo />
          <div className="flex items-center gap-3 sm:gap-5">
            <button
              type="button"
              id="easy-read-toggle-btn"
              onClick={toggleEasyReadMode}
              className={`px-3 py-2 rounded-full text-xs font-medium border flex items-center gap-1.5 cursor-pointer ${
                easyReadMode
                  ? "bg-forest text-cream border-forest"
                  : "border-sand hover:bg-sand/40"
              }`}
              aria-pressed={easyReadMode}
              aria-label="Larger text"
            >
              <Glasses className="w-3.5 h-3.5" aria-hidden="true" />
              Larger text
            </button>
            <Link to="/login" className="text-xs link">
              Sign in
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-6 sm:py-10">
        <div className={`w-full ${easyReadMode ? "max-w-xl" : "max-w-md"}`}>
          {step !== "success" && (
            <ol
              aria-label="Password reset progress"
              className="flex justify-between gap-3 mb-5"
            >
              {STEPS.map((item, index) => (
                <li
                  key={item.key}
                  aria-current={stepIdx === index ? "step" : undefined}
                  className={`flex items-center gap-2 text-xs ${
                    stepIdx >= index ? "text-forest" : "text-dim"
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                      stepIdx > index
                        ? "bg-forest border-forest text-cream"
                        : stepIdx === index
                          ? "border-forest bg-green/10"
                          : "border-sand"
                    }`}
                  >
                    {stepIdx > index ? (
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className={stepIdx === index ? "font-semibold" : ""}>
                    {item.label}
                  </span>
                  {stepIdx > index && (
                    <span className="sr-only">completed</span>
                  )}
                </li>
              ))}
            </ol>
          )}

          <div
            className={`bg-white border border-sand rounded-xl p-5 sm:p-8 shadow-xs animate-fade-up ${
              easyReadMode
                ? "[&_p]:text-base [&_label]:text-sm [&_button]:text-sm"
                : ""
            }`}
          >
            {formError && <p role="alert" className="notice notice-red mb-4">{formError}</p>}
            {step === "email" && (
              <div>
                <h1 className="font-heading font-bold text-2xl sm:text-3xl mb-2">
                  Reset your password
                </h1>
                <p className="text-sm text-dim mb-5">
                  Enter the email you use for Flux.
                </p>
                {fromSignup && (
                  <p className="notice notice-green mb-4 break-all">
                    Email filled in: {email}
                  </p>
                )}
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="reset-email-input"
                      className="block text-xs font-semibold mb-1.5"
                    >
                      Email address
                    </label>
                    <input
                      type="email"
                      id="reset-email-input"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      required
                      autoFocus
                      className={`input ${
                        easyReadMode ? "py-3.5 text-base" : ""
                      }`}
                      aria-describedby="email-help-text"
                    />
                    <p
                      id="email-help-text"
                      className="text-xs text-dim mt-2 leading-relaxed"
                    >
                      If an account matches, you’ll receive reset instructions.
                    </p>
                  </div>
                  <button
                    type="submit"
                    id="submit-email-btn"
                    disabled={loading || !email}
                    className="btn btn-forest w-full py-3.5"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        {loadingLabel}
                      </>
                    ) : (
                      <>
                        Send reset instructions{" "}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-5 pt-3 border-t border-sand">
                  <button
                    type="button"
                    onClick={() => setIsHelpAccordionOpen(!isHelpAccordionOpen)}
                    aria-expanded={isHelpAccordionOpen}
                    aria-controls="email-account-help"
                    className="text-xs link flex items-center justify-between w-full py-1"
                  >
                    Forgot which email you used?
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${
                        isHelpAccordionOpen ? "rotate-180" : ""
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                  <div
                    id="email-account-help"
                    hidden={!isHelpAccordionOpen}
                    className="mt-2 text-xs text-dim space-y-2 leading-relaxed"
                  >
                    <p>
                      Search your inboxes for “Flux” to find the address you
                      used.
                    </p>
                    <p>
                      Joined with Google or Apple?{" "}
                      <Link to="/login" className="link">
                        Sign in with that provider.
                      </Link>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {step === "verification" && (
              <div>
                <div
                  className="flex justify-end mb-2 text-xs font-medium"
                  style={{ color: expiryColor }}
                >
                  <span
                    className="flex items-center gap-1.5"
                    aria-label={
                      expired
                        ? "Code expired"
                        : `Code expires in ${fmt(expiry)}`
                    }
                  >
                    <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                    {expired ? "Code expired" : `Expires in ${fmt(expiry)}`}
                  </span>
                </div>
                <h1 className="font-heading font-bold text-2xl sm:text-3xl mb-2">
                  Check your email
                </h1>
                <p className="text-sm text-dim mb-3">
                  Use the reset link or enter the 6-digit code.
                </p>
                <div className="text-xs text-dim mb-4 flex items-center justify-between gap-2">
                  <strong className="text-forest truncate">
                    {showFullEmail ? email : maskEmail(email)}
                  </strong>
                  <button
                    type="button"
                    onClick={() => setShowFullEmail(!showFullEmail)}
                    aria-label={
                      showFullEmail
                        ? "Hide email address"
                        : "Show email address"
                    }
                    className="link shrink-0"
                  >
                    {showFullEmail ? "Hide" : "Show"}
                  </button>
                </div>
                {webmail.isKnown && (
                  <a href={webmail.inboxUrl} target="_blank" rel="noopener noreferrer"
                    className="btn btn-outline w-full mb-5">
                    <Mail className="w-4 h-4" aria-hidden="true" /> Open {webmail.providerName}
                    <ExternalLink className="w-3.5 h-3.5" aria-label="opens in a new tab" />
                  </a>
                )}

                <form onSubmit={handleCodeSubmit} className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center gap-2 mb-2">
                      <span id="code-label" className="text-xs font-semibold">
                        6-digit code
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setInputMode(
                            inputMode === "split" ? "single" : "split",
                          )
                        }
                        className="text-xs link"
                      >
                        {inputMode === "split" ? "Use one box" : "Use 6 boxes"}
                      </button>
                    </div>
                    {inputMode === "split" ? (
                      <div
                        className="flex gap-2"
                        onPaste={handlePaste}
                        role="group"
                        aria-labelledby="code-label"
                      >
                        {code.map((digit, index) => (
                          <input
                            key={index}
                            ref={(element) => {
                              codeRefs.current[index] = element
                            }}
                            type="text"
                            inputMode="numeric"
                            autoComplete={index === 0 ? "one-time-code" : "off"}
                            maxLength={2}
                            value={digit}
                            onChange={(event) =>
                              handleCodeChange(index, event.target.value)
                            }
                            onKeyDown={(event) => handleCodeKey(index, event)}
                            disabled={expired || isLockedOut || loading}
                            className={`input min-w-0 flex-1 text-center px-0 font-semibold ${
                              easyReadMode ? "text-2xl h-14" : "text-xl h-12"
                            }`}
                            style={{
                              borderColor: codeError
                                ? "#b4321e"
                                : digit
                                  ? "#306D29"
                                  : undefined,
                            }}
                            aria-label={`Digit ${index + 1} of 6`}
                            aria-invalid={Boolean(codeError)}
                            aria-describedby={
                              codeError ? "code-error" : undefined
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <input
                        ref={singleCodeRef}
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={code.join("")}
                        onChange={(event) =>
                          handleSingleInputChange(event.target.value)
                        }
                        onPaste={handlePaste}
                        placeholder="000000"
                        disabled={expired || isLockedOut || loading}
                        className="input text-center font-mono text-xl tracking-widest"
                        aria-labelledby="code-label"
                        aria-invalid={Boolean(codeError)}
                        aria-describedby={codeError ? "code-error" : undefined}
                      />
                    )}
                    <div className="flex items-center justify-between gap-2 mt-3 text-xs">
                      <button
                        type="button"
                        onClick={handleClipboardPaste}
                        disabled={expired || isLockedOut || loading}
                        className="link inline-flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Copy className="w-3.5 h-3.5" /> Paste code
                      </button>
                      <span className="text-dim">
                        {isLockedOut
                          ? "Code locked"
                          : `${MAX_ATTEMPTS - failedAttempts} attempts left`}
                      </span>
                    </div>
                    {codeError && !expired && (
                      <p
                        id="code-error"
                        role="alert"
                        className="notice notice-red mt-3"
                      >
                        {codeError}
                      </p>
                    )}
                    {expired && (
                      <p role="alert" className="notice mt-3">
                        Code expired. Request a new one below.
                      </p>
                    )}
                  </div>
                  <button
                    type="submit"
                    id="verify-code-btn"
                    disabled={
                      loading ||
                      code.join("").length < 6 ||
                      expired ||
                      isLockedOut
                    }
                    className="btn btn-forest w-full py-3.5"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        {loadingLabel}
                      </>
                    ) : (
                      <>
                        Verify code <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-4 flex items-center justify-between gap-2 text-xs">
                  {resendCooldown === 0 ? (
                    <button
                      type="button"
                      id="resend-code-btn"
                      onClick={handleResend}
                      disabled={loading}
                      className="link"
                    >
                      Resend code
                    </button>
                  ) : (
                    <span className="text-dim">
                      Resend in{" "}
                      <strong className="font-mono">{resendCooldown}s</strong>
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setFormError("")
                      setStep("email")
                      setCode(Array(6).fill(""))
                      setCodeError("")
                    }}
                    className="link"
                  >
                    Change email
                  </button>
                </div>

                <div className="mt-5 pt-3 border-t border-sand">
                  <button
                    type="button"
                    onClick={() =>
                      setIsTroubleshooterOpen(!isTroubleshooterOpen)
                    }
                    aria-expanded={isTroubleshooterOpen}
                    aria-controls="email-delivery-help"
                    className="text-xs link flex items-center justify-between w-full py-1"
                  >
                    Didn’t get the email?
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${
                        isTroubleshooterOpen ? "rotate-180" : ""
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                  <div
                    id="email-delivery-help"
                    hidden={!isTroubleshooterOpen}
                    className="mt-2 text-xs text-dim space-y-2 leading-relaxed"
                  >
                    <p>
                      Check Spam or Junk, confirm the address, then wait a
                      minute before resending.
                    </p>
                    {webmail.isKnown && (
                      <a
                        href={webmail.inboxUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link inline-flex items-center gap-1"
                      >
                        Open {webmail.providerName}{" "}
                        <ExternalLink
                          className="w-3 h-3"
                          aria-label="opens in a new tab"
                        />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {step === "newpass" && (
              <div>
                <h1 className="font-heading font-bold text-2xl sm:text-3xl mb-5">
                  Choose a new password
                </h1>
                {expired && (
                  <p role="alert" className="notice notice-red mb-4">
                    Reset expired.{" "}
                    <button type="button" className="link" onClick={() => {
                      setStep("email"); setFormError(""); setNewPassword(""); setConfirmPassword("");
                    }}>Request new instructions</button>
                  </p>
                )}
                <form onSubmit={handlePassSubmit} className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <label
                        htmlFor="new-password-input"
                        className="text-xs font-semibold"
                      >
                        New password
                      </label>
                      <button
                        type="button"
                        id="suggest-passphrase-btn"
                        onClick={handleSuggestPassphrase}
                        className="text-xs link flex items-center gap-1"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> Suggest password
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showNew ? "text" : "password"}
                        id="new-password-input"
                        autoComplete="new-password"
                        minLength={15}
                        aria-describedby="password-guidance"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        placeholder="Create a new password"
                        required
                        autoFocus
                        className={`input pr-11 ${
                          easyReadMode ? "text-base" : ""
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(!showNew)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-dim hover:text-forest"
                        aria-label={showNew ? "Hide password" : "Show password"}
                      >
                        {showNew ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <NistPasswordValidator
                      analysis={nistAnalysis}
                      passwordLength={newPassword.length}
                      easyReadMode={easyReadMode}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="confirm-password-input"
                      className="block text-xs font-semibold mb-1.5"
                    >
                      Confirm password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirm ? "text" : "password"}
                        id="confirm-password-input"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(event) =>
                          setConfirmPassword(event.target.value)
                        }
                        placeholder="Repeat your new password"
                        required
                        className={`input pr-11 ${
                          easyReadMode ? "text-base" : ""
                        }`}
                        style={{
                          borderColor: mismatch
                            ? "#b4321e"
                            : match
                              ? "#306D29"
                              : undefined,
                        }}
                        aria-invalid={mismatch}
                        aria-describedby={
                          mismatch ? "password-mismatch" : undefined
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-dim hover:text-forest"
                        aria-label={
                          showConfirm
                            ? "Hide confirmation password"
                            : "Show confirmation password"
                        }
                      >
                        {showConfirm ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {mismatch && (
                      <p
                        id="password-mismatch"
                        role="alert"
                        className="text-xs mt-1.5 text-red-700"
                      >
                        Passwords don’t match.
                      </p>
                    )}
                    {match && (
                      <p className="text-xs mt-1.5 text-green">
                        Passwords match
                      </p>
                    )}
                  </div>

                  <label className="flex items-start gap-2.5 pt-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      id="revoke-sessions-checkbox"
                      checked={revokeAllSessions}
                      onChange={(event) =>
                        setRevokeAllSessions(event.target.checked)
                      }
                      className="accent-forest mt-0.5"
                    />
                    <span>
                      Sign out other devices{" "}
                      <span className="text-dim">(recommended)</span>
                    </span>
                  </label>
                  <details className="text-xs text-dim">
                    <summary className="link cursor-pointer py-1 w-fit">
                      Password and device help
                    </summary>
                    <div className="mt-2 space-y-3 leading-relaxed">
                      <p>
                        Keep your password in a password manager or a private,
                        secure place.
                      </p>
                      {newPassword && (
                        <button
                          type="button"
                          onClick={handleCopyPassphrase}
                          className="link flex items-center gap-1.5"
                        >
                          {copiedPassphrase ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          {copiedPassphrase ? "Copied" : "Copy password"}
                        </button>
                      )}
                      <p>Signing out ends active Flux sessions on your devices.</p>
                      <button
                        type="button"
                        onClick={() => setShowSessionsList(!showSessionsList)}
                        aria-expanded={showSessionsList}
                        aria-controls="active-devices"
                        className="link"
                      >
                        {showSessionsList
                          ? "Hide active devices"
                          : "View active devices"}
                      </button>
                      <ul
                        id="active-devices"
                        hidden={!showSessionsList}
                        className="space-y-2"
                      >
                        {activeSessions.length === 0 && <li>No active sessions.</li>}
                        {activeSessions.map((session) => (
                          <li
                            key={session.id}
                            className="flex items-start gap-2"
                          >
                            {/iPhone|Android/i.test(session.device) ? (
                              <Smartphone className="w-4 h-4 shrink-0" />
                            ) : (
                              <Laptop className="w-4 h-4 shrink-0" />
                            )}
                            <span>
                              <span className="font-medium text-forest">
                                {session.device}
                              </span>{" "}
                              ·{" "}
                              {session.isCurrent
                                ? "Current browser"
                                : "Signed in " + new Date(session.lastActive).toLocaleDateString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </details>

                  <button
                    type="submit"
                    id="save-new-password-btn"
                    disabled={!canSubmitPassword}
                    className="btn btn-forest w-full py-3.5"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        {loadingLabel}
                      </>
                    ) : (
                      <>
                        Save password <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {step === "success" && (
              <div className="text-center">
                <CheckCircle2
                  className="w-12 h-12 text-green mx-auto mb-4"
                  aria-hidden="true"
                />
                <h1 className="font-heading font-bold text-2xl sm:text-3xl mb-2">
                  Password updated
                </h1>
                <p className="text-sm text-dim mb-5">
                  Sign in with your new password.
                </p>
                <details className="text-xs text-dim text-left mb-5">
                  <summary className="link cursor-pointer py-1">
                    Reset details
                  </summary>
                  <div className="mt-2 space-y-2 leading-relaxed">
                    <p>Account: {maskEmail(email)}</p>
                    <p>
                      Verified with{" "}
                      {verificationMethod === "magic_link"
                        ? "the reset link"
                        : "the 6-digit code"}
                      . The reset code and link have been invalidated.
                    </p>
                    {sessionsRevoked && <p>Your other Flux sessions were signed out.</p>}
                  </div>
                </details>
                <button
                  type="button"
                  id="continue-to-login-btn"
                  onClick={() =>
                    navigate("/login", {
                      state: {
                        email,
                        fromReset: true,
                        sessionsRevoked,
                      },
                    })
                  }
                  className="btn btn-forest w-full py-3.5"
                >
                  Continue to sign in <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}
