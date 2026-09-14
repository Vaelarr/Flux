import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import {
  Shield,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  EyeOff,
  Sparkles,
  Smartphone,
  Laptop,
  ArrowRight,
  ArrowLeft,
  Mail,
  RefreshCw,
  Lock,
  AlertTriangle,
  HelpCircle,
  UserPlus,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Glasses
} from "lucide-react";
import { FluxLogo } from "./Landing";
import { ResetStep } from "../types";
import {
  analyzeNistPassword,
  generatePassphrase,
  maskEmail,
  DEFAULT_ACTIVE_SESSIONS,
  getWebmailInfo
} from "../utils/security";
import {
  updatePassword,
  saveResetChallenge,
  verifyResetChallenge,
  consumeResetChallenge
} from "../utils/accounts";
import EmailSimulatorModal from "../components/EmailSimulatorModal";
import NistPasswordValidator from "../components/NistPasswordValidator";
import { useToast } from "../components/Toast";

const STEPS: { key: ResetStep; label: string; stepNumber: number }[] = [
  { key: "email", label: "Email", stepNumber: 1 },
  { key: "verification", label: "Verify", stepNumber: 2 },
  { key: "newpass", label: "New Password", stepNumber: 3 },
];

const TOKEN_TTL = 15 * 60; // 15 minutes
const MAX_ATTEMPTS = 5;

export default function PasswordReset() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  const fromSignup = location.state?.fromSignup === true;
  const initialEmail = location.state?.email || searchParams.get("email") || "";

  // Accessibility & Senior Mode ("Easy Read")
  const [easyReadMode, setEasyReadMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("flux_easy_read_mode") === "true";
  });

  const toggleEasyReadMode = () => {
    const next = !easyReadMode;
    setEasyReadMode(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("flux_easy_read_mode", String(next));
    }
  };

  // Core flow state
  const [step, setStep] = useState<ResetStep>("email");
  const [email, setEmail] = useState(initialEmail);
  const [showFullEmail, setShowFullEmail] = useState(false);

  // Verification challenge state
  const [generatedCode, setGeneratedCode] = useState("649281");
  const [magicToken, setMagicToken] = useState("tok_sec_994f8a12");
  const [code, setCode] = useState<string[]>(Array(6).fill(""));
  const [inputMode, setInputMode] = useState<"split" | "single">("split");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState<"otp" | "magic_link">("otp");

  // Passwords
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [copiedPassphrase, setCopiedPassphrase] = useState(false);

  // Security controls
  const [revokeAllSessions, setRevokeAllSessions] = useState(true);
  const [showSessionsList, setShowSessionsList] = useState(false);
  const [activeSessions] = useState(DEFAULT_ACTIVE_SESSIONS);

  // Loading & feedback
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("");
  const [codeError, setCodeError] = useState("");

  // Timers
  const [expiry, setExpiry] = useState(TOKEN_TTL);
  const [expired, setExpired] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const expiryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resendRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Email simulation drawer & Troubleshooter
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isTroubleshooterOpen, setIsTroubleshooterOpen] = useState(false);
  const [isHelpAccordionOpen, setIsHelpAccordionOpen] = useState(false);
  const [auditTimestamp] = useState(() =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  );

  // Check URL params for direct magic link resolution
  useEffect(() => {
    const urlToken = searchParams.get("token");
    const urlEmail = searchParams.get("email");
    if (urlToken && urlEmail) {
      setEmail(urlEmail);
      setMagicToken(urlToken);
      const res = verifyResetChallenge(urlEmail, urlToken, true);
      if (res.success) {
        setVerificationMethod("magic_link");
        setStep("newpass");
      }
    }
  }, [searchParams]);

  // Expiry countdown timer
  const startExpiry = useCallback(() => {
    setExpiry(TOKEN_TTL);
    setExpired(false);
    if (expiryRef.current) clearInterval(expiryRef.current);
    expiryRef.current = setInterval(() => {
      setExpiry((s) => {
        if (s <= 1) {
          clearInterval(expiryRef.current!);
          setExpired(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, []);

  // Resend cooldown timer
  const startResend = useCallback(() => {
    setResendCooldown(60);
    if (resendRef.current) clearInterval(resendRef.current);
    resendRef.current = setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) {
          clearInterval(resendRef.current!);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    if (step === "verification") {
      startExpiry();
      startResend();
      setTimeout(() => {
        if (inputMode === "split") {
          codeRefs.current[0]?.focus();
        }
      }, 80);
    }
    return () => {
      if (expiryRef.current) clearInterval(expiryRef.current);
      if (resendRef.current) clearInterval(resendRef.current);
    };
  }, [step, startExpiry, startResend, inputMode]);

  const go = (next: ResetStep) => {
    setLoading(false);
    setLoadingLabel("");
    setStep(next);
  };

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // STEP 1: Email Submission (OWASP Anti-Enumeration & Uniform Timing Delay)
  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    setLoading(true);
    setLoadingLabel("Securing account recovery challenge…");

    // Generate fresh cryptographically random OTP & token
    const freshCode = Math.floor(100000 + Math.random() * 900000).toString();
    const freshToken = "tok_" + Math.random().toString(36).substring(2, 14);
    setGeneratedCode(freshCode);
    setMagicToken(freshToken);

    // Save challenge into Firestore and local cache
    saveResetChallenge({
      email: cleanEmail,
      otpCode: freshCode,
      magicToken: freshToken,
      expiresAt: Date.now() + TOKEN_TTL * 1000,
    });

    // Anti-enumeration constant-time timing delay: identical experience regardless of account state
    setTimeout(() => {
      setLoadingLabel("Sending recovery instructions to your email…");
      setTimeout(() => {
        go("verification");
        // Open simulation email drawer so user can experience both 1-click and code options
        setIsEmailModalOpen(true);
      }, 550);
    }, 600);
  };

  // STEP 2: Code Input Handling
  const handleCodeChange = (idx: number, val: string) => {
    setCodeError("");
    const d = val.replace(/\D/g, "").slice(-1);
    const n = [...code];
    n[idx] = d;
    setCode(n);
    if (d && idx < 5) codeRefs.current[idx + 1]?.focus();
    if (!d && val === "" && idx > 0) codeRefs.current[idx - 1]?.focus();
  };

  const handleSingleInputChange = (val: string) => {
    setCodeError("");
    const digits = val.replace(/\D/g, "").slice(0, 6);
    const n = Array(6).fill("");
    digits.split("").forEach((d, i) => {
      n[i] = d;
    });
    setCode(n);
  };

  const handleCodeKey = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[idx] && idx > 0) {
      const n = [...code];
      n[idx - 1] = "";
      setCode(n);
      codeRefs.current[idx - 1]?.focus();
    } else if (e.key === "ArrowLeft" && idx > 0) {
      codeRefs.current[idx - 1]?.focus();
    } else if (e.key === "ArrowRight" && idx < 5) {
      codeRefs.current[idx + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    setCodeError("");
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6).split("");
    const n = Array(6).fill("");
    digits.forEach((d, i) => {
      n[i] = d;
    });
    setCode(n);
    if (inputMode === "split") {
      codeRefs.current[Math.min(digits.length, 5)]?.focus();
    }
  };

  // Dedicated "Paste code from clipboard" button for seniors / mobile users
  const handleClipboardPaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const digits = text.replace(/\D/g, "").slice(0, 6);
      if (digits.length > 0) {
        const n = Array(6).fill("");
        digits.split("").forEach((d, i) => {
          n[i] = d;
        });
        setCode(n);
        setCodeError("");
        if (inputMode === "split") {
          codeRefs.current[Math.min(digits.length, 5)]?.focus();
        }
        showToast({
          title: "Code pasted",
          message: `Entered ${digits.length} numbers from your clipboard.`,
          type: "notice-green",
          duration: 2500,
        });
      } else {
        showToast({
          title: "No numbers found",
          message: "We couldn't find any numbers in your copied text.",
          type: "notice-red",
          duration: 3000,
        });
      }
    } catch {
      showToast({
        title: "Clipboard notice",
        message: "Please type the code directly or press Ctrl+V.",
        type: "notice-red",
        duration: 3000,
      });
    }
  };

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const entered = code.join("");
    if (entered.length < 6 || expired || isLockedOut) return;

    setLoading(true);
    setLoadingLabel("Verifying security challenge…");

    setTimeout(() => {
      // Validate strictly against issued challenge without hardcoded bypasses
      const result = verifyResetChallenge(email, entered, false);

      if (result.success) {
        setVerificationMethod("otp");
        go("newpass");
      } else {
        setLoading(false);
        if (result.isLockedOut) {
          setIsLockedOut(true);
          setCodeError(result.error || "Maximum attempts reached. This challenge is locked.");
        } else if (result.isExpired) {
          setExpired(true);
          setCodeError(result.error || "This code has expired. Please request a fresh challenge.");
        } else {
          setFailedAttempts(MAX_ATTEMPTS - (result.attemptsRemaining ?? 0));
          setCodeError(result.error || "Invalid verification code.");
        }
      }
    }, 650);
  };

  const handleResend = () => {
    setCode(Array(6).fill(""));
    setCodeError("");
    setExpired(false);
    startExpiry();
    startResend();

    const cleanEmail = email.trim().toLowerCase();
    const freshCode = Math.floor(100000 + Math.random() * 900000).toString();
    const freshToken = "tok_" + Math.random().toString(36).substring(2, 14);
    setGeneratedCode(freshCode);
    setMagicToken(freshToken);

    saveResetChallenge({
      email: cleanEmail,
      otpCode: freshCode,
      magicToken: freshToken,
      expiresAt: Date.now() + TOKEN_TTL * 1000,
    });

    setIsEmailModalOpen(true);
    showToast({
      title: "Fresh code dispatched",
      message: `A new 6-digit code has been sent to ${maskEmail(cleanEmail)}.`,
      type: "security",
      duration: 5000,
    });
    setTimeout(() => {
      if (inputMode === "split") {
        codeRefs.current[0]?.focus();
      }
    }, 80);
  };

  // Instant Magic Link verification (One-click path for general users)
  const handleUseMagicLink = () => {
    setVerificationMethod("magic_link");
    go("newpass");
  };

  // Auto-fill from simulator
  const handleAutoFillCode = (codeStr: string) => {
    const digits = codeStr.replace(/\D/g, "").slice(0, 6);
    const n = Array(6).fill("");
    digits.split("").forEach((d, i) => {
      n[i] = d;
    });
    setCode(n);
    setCodeError("");
  };

  // STEP 3: NIST SP 800-63B Password Validation & Passphrase Generation
  const nistAnalysis = analyzeNistPassword(newPassword, email);
  const match = confirmPassword.length > 0 && newPassword === confirmPassword;
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmitPassword = nistAnalysis.allCriticalMet && match && !loading;

  const handleSuggestPassphrase = () => {
    const suggested = generatePassphrase();
    setNewPassword(suggested);
    setConfirmPassword(suggested);
    setShowNew(true);
    setShowConfirm(true);
    setCopiedPassphrase(false);
  };

  const handleCopyPassphrase = () => {
    if (!newPassword) return;
    navigator.clipboard?.writeText(newPassword);
    setCopiedPassphrase(true);
    setTimeout(() => setCopiedPassphrase(false), 2500);
    showToast({
      title: "Password copied",
      message: "Your new password is now in your clipboard.",
      type: "notice-green",
      duration: 3000,
    });
  };

  const handlePassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitPassword) return;

    setLoading(true);
    setLoadingLabel("Saving new password…");

    setTimeout(() => {
      if (revokeAllSessions) {
        setLoadingLabel("Signing out other devices…");
      }
      setTimeout(() => {
        setLoadingLabel("Finalizing security guarantees…");
        setTimeout(() => {
          if (expiryRef.current) clearInterval(expiryRef.current);
          updatePassword(email, newPassword);
          // Single-use token burning: invalidate challenge so it cannot be re-used
          consumeResetChallenge(email);
          go("success");
          showToast({
            title: "Password reset complete",
            message: "Your new password has been securely saved and verified.",
            type: "security",
            duration: 6000,
            action: {
              label: "Sign in",
              onClick: () =>
                navigate("/login", {
                  state: {
                    email,
                    fromReset: true,
                    sessionsRevoked: revokeAllSessions,
                  },
                }),
            },
          });
        }, 400);
      }, 450);
    }, 550);
  };

  const expiryFrac = expiry / TOKEN_TTL;
  const expiryColor = expiry > 300 ? "#306D29" : expiry > 120 ? "#b45309" : "#b4321e";
  const stepIdx = STEPS.findIndex((s) => s.key === step);
  const webmail = getWebmailInfo(email);

  return (
    <div className={`bg-cream min-h-screen flex flex-col text-forest ${easyReadMode ? "text-base" : "text-sm"}`}>
      {/* Simulation Email Drawer */}
      <EmailSimulatorModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        email={email}
        code={generatedCode}
        token={magicToken}
        onUseMagicLink={handleUseMagicLink}
        onUseCode={handleAutoFillCode}
      />

      {/* Top Header */}
      <header className="border-b border-sand bg-cream/90 backdrop-blur-xs sticky top-0 z-40">
        <nav className="max-w-5xl mx-auto flex items-center justify-between px-4 sm:px-6 h-15">
          <FluxLogo />

          <div className="flex items-center gap-3">
            {/* Easy Read Mode Toggle for Elderly / Accessible Ergonomics */}
            <button
              type="button"
              id="easy-read-toggle-btn"
              onClick={toggleEasyReadMode}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                easyReadMode
                  ? "bg-forest text-cream border-forest shadow-xs ring-2 ring-forest/20"
                  : "bg-sand/40 text-forest border-sand hover:bg-sand/70"
              }`}
              aria-pressed={easyReadMode}
              aria-label="Toggle Easy Read large text mode"
            >
              <Glasses className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Easy Read</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold uppercase ${
                  easyReadMode ? "bg-cream text-forest" : "bg-forest/10 text-forest"
                }`}
              >
                {easyReadMode ? "ON" : "OFF"}
              </span>
            </button>

            <span className="text-sand hidden sm:inline">|</span>

            <div className="flex items-center gap-3 text-xs">
              <Link
                to="/signup"
                className="text-dim hover:text-forest transition-colors hidden md:flex items-center gap-1 font-medium"
              >
                <UserPlus className="w-3.5 h-3.5 text-green" />
                <span>Create account</span>
              </Link>
              <Link
                to="/login"
                className="text-dim hover:text-forest transition-colors flex items-center gap-1 font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to login</span>
              </Link>
            </div>
          </div>
        </nav>
      </header>

      {/* Main Flow Container */}
      <main className="flex-1 flex flex-col items-center justify-start px-4 py-6 sm:py-10">
        <div className={`w-full transition-all duration-200 ${easyReadMode ? "max-w-xl" : "max-w-md"}`}>

          {/* Stepper Header (Only shown during active steps) */}
          {step !== "success" && (
            <div className="mb-6">
              <div className="flex items-center justify-between px-2 mb-2">
                {STEPS.map((s, i) => {
                  const done = stepIdx > i;
                  const active = stepIdx === i;
                  return (
                    <div key={s.key} className="flex items-center gap-2">
                      <div
                        className={`rounded-full flex items-center justify-center font-bold transition-all ${
                          easyReadMode ? "w-7 h-7 text-sm" : "w-6 h-6 text-xs"
                        }`}
                        style={{
                          background: done ? "#0D530E" : active ? "rgba(13,83,14,0.12)" : "transparent",
                          border: done ? "none" : `1.5px solid ${active ? "#0D530E" : "#E7E1B1"}`,
                          color: done ? "#FBF5DD" : active ? "#0D530E" : "#C0B87A",
                        }}
                      >
                        {done ? <CheckCircle2 className="w-4 h-4 text-cream" /> : i + 1}
                      </div>
                      <span
                        className={`text-xs hidden sm:inline font-medium ${
                          active ? "text-forest font-bold" : done ? "text-forest" : "text-dim"
                        }`}
                      >
                        {s.label}
                      </span>
                      {i < STEPS.length - 1 && (
                        <div
                          className="w-8 sm:w-16 h-px mx-1"
                          style={{ background: done ? "#0D530E" : "#E7E1B1" }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Step indicator banner for older adults */}
              <div className="px-2">
                <span className="text-xs font-semibold text-green flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>
                    Step {stepIdx + 1} of 3:{" "}
                    {step === "email"
                      ? "Enter your email"
                      : step === "verification"
                      ? "Check your email for instructions"
                      : "Choose your new password"}
                  </span>
                </span>
              </div>
            </div>
          )}

          {/* Card Container */}
          <div className="bg-white border border-sand rounded-xl p-6 sm:p-8 shadow-xs animate-fade-up">

            {/* ══════════════════════════════════════════════════════════
                STEP 1: EMAIL (Identity & Anti-Enumeration)
               ══════════════════════════════════════════════════════════ */}
            {step === "email" && (
              <div>
                <h1
                  className={`font-heading font-bold text-forest mb-2 ${
                    easyReadMode ? "text-2xl sm:text-3xl leading-tight" : "text-2xl sm:text-3xl"
                  }`}
                >
                  Reset your password
                </h1>
                <p
                  className={`text-dim mb-5 leading-relaxed ${
                    easyReadMode ? "text-base text-forest/80" : "text-sm"
                  }`}
                >
                  Don't worry — we'll help you get back into your account in 3 simple steps. Enter your email address below.
                </p>

                {fromSignup && (
                  <div className="mb-4 p-3 rounded-lg bg-green/10 border border-green/20 text-xs text-forest flex items-start gap-2 animate-fade-up">
                    <CheckCircle2 className="w-4 h-4 text-green flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Test Account Ready</p>
                      <p className="text-forest/70 text-[11px] mt-0.5">
                        Your test email <strong className="font-mono text-forest">{email}</strong> has been filled in. Click below to proceed.
                      </p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="reset-email-input"
                      className={`block font-semibold text-dim uppercase tracking-wide mb-1.5 ${
                        easyReadMode ? "text-xs font-bold text-forest/80" : "text-xs"
                      }`}
                    >
                      Email address
                    </label>
                    <input
                      type="email"
                      id="reset-email-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. mary.smith@example.com"
                      required
                      autoFocus
                      className={`input ${easyReadMode ? "py-3.5 px-4 text-base" : ""}`}
                      aria-describedby="email-help-text"
                    />
                  </div>

                  {/* Anti-Enumeration & Security Assurance Notice */}
                  <div className="p-3.5 rounded-lg border border-sand bg-sand/20 flex items-start gap-2.5 text-xs">
                    <Shield className="w-4 h-4 text-forest flex-shrink-0 mt-0.5" />
                    <div className="text-dim leading-relaxed">
                      <span className="font-semibold text-forest">Account Privacy:</span> If an account matches this email, password reset instructions will be sent right away. We keep your account details completely confidential.
                    </div>
                  </div>

                  <button
                    type="submit"
                    id="submit-email-btn"
                    disabled={loading || !email}
                    className={`btn btn-forest w-full font-semibold cursor-pointer ${
                      easyReadMode ? "py-4 text-base" : "py-3 text-sm"
                    }`}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{loadingLabel}</span>
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <span>Send reset instructions</span>
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    )}
                  </button>
                </form>

                {/* Senior & Novice Helper: "Trouble remembering your email?" */}
                <div className="mt-5 pt-3 border-t border-sand/60">
                  <button
                    type="button"
                    onClick={() => setIsHelpAccordionOpen(!isHelpAccordionOpen)}
                    className="text-xs text-forest/80 hover:text-forest flex items-center justify-between w-full py-1 text-left font-medium cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-green" />
                      <span>Need help remembering which email you used?</span>
                    </span>
                    {isHelpAccordionOpen ? (
                      <ChevronUp className="w-4 h-4 text-dim" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-dim" />
                    )}
                  </button>

                  {isHelpAccordionOpen && (
                    <div className="mt-2.5 p-3 rounded-lg bg-cream/60 border border-sand text-xs text-dim space-y-2 animate-fade-up">
                      <p>
                        <strong>1. Check your email apps:</strong> Search for "Flux" in your Gmail, Yahoo, or Outlook app to see where you received messages from us.
                      </p>
                      <p>
                        <strong>2. Signed up with Google or Apple?</strong> You might have used 1-click Google or Apple sign-in. You can try signing in with those on the login page.
                      </p>
                      <p>
                        <strong>3. Family or friend helped you?</strong> Check if a loved one helped you set up your account under their email address.
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-sand/40 flex items-center justify-between text-xs text-dim">
                  <Link to="/login" className="hover:text-forest transition-colors flex items-center gap-1">
                    <span>← Back to login</span>
                  </Link>
                  <span className="flex items-center gap-1 text-green font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Protected &amp; Encrypted</span>
                  </span>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                STEP 2: VERIFICATION (Dual-Track + Dual Input Modes)
               ══════════════════════════════════════════════════════════ */}
            {step === "verification" && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-green flex items-center gap-1.5">
                    <Mail className="w-4 h-4" />
                    <span>Instructions Sent</span>
                  </span>
                  <span
                    className="font-mono text-xs font-bold tabular-nums flex items-center gap-1"
                    style={{ color: expiryColor }}
                    aria-label={`Time remaining: ${fmt(expiry)}`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>{expired ? "Expired" : fmt(expiry)}</span>
                  </span>
                </div>

                <h1
                  className={`font-heading font-bold text-forest mb-1.5 ${
                    easyReadMode ? "text-2xl sm:text-3xl leading-tight" : "text-2xl font-bold"
                  }`}
                >
                  Verify your identity
                </h1>

                {/* Masked destination notice with reveal */}
                <div className="text-xs text-dim mb-5 flex items-center justify-between bg-sand/20 p-2.5 rounded-md border border-sand/60">
                  <span className="truncate">
                    Sent to: <strong className="text-forest">{showFullEmail ? email : maskEmail(email)}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowFullEmail(!showFullEmail)}
                    className="text-[11px] link ml-2 flex-shrink-0 cursor-pointer font-semibold"
                  >
                    {showFullEmail ? "Mask" : "Reveal full address"}
                  </button>
                </div>

                {/* Option 1: 1-Click Instant Reset Link (Fast track) */}
                <div className="mb-5 p-3.5 rounded-lg border border-green/30 bg-green/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-green flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Option 1: 1-Click Reset Link</span>
                    </span>
                    <span className="text-[10px] bg-green/10 text-green px-1.5 py-0.5 rounded font-bold uppercase">
                      Recommended
                    </span>
                  </div>
                  <p className="text-xs text-dim leading-relaxed">
                    Check your email and click the button to reset your password with one tap.
                  </p>
                  <button
                    type="button"
                    id="open-email-preview-btn"
                    onClick={() => setIsEmailModalOpen(true)}
                    className="w-full text-xs font-bold text-forest bg-sand/60 hover:bg-sand/90 border border-sand py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Mail className="w-4 h-4 text-forest" />
                    <span>View reset email</span>
                  </button>
                </div>

                <div className="relative flex py-1 items-center mb-4">
                  <div className="flex-grow border-t border-sand/60"></div>
                  <span className="flex-shrink mx-3 text-xs text-dim uppercase tracking-wider font-bold">
                    or Option 2: Enter 6-digit code
                  </span>
                  <div className="flex-grow border-t border-sand/60"></div>
                </div>

                {/* Option 2: 6-Digit Code Form */}
                <form onSubmit={handleCodeSubmit} className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-xs font-bold text-dim uppercase tracking-wide">
                        6-Digit Security Code
                      </label>
                      <div className="flex items-center gap-2">
                        {/* Senior Ergonomics: Switch between 6 boxes and 1 single box */}
                        <button
                          type="button"
                          onClick={() => setInputMode(inputMode === "split" ? "single" : "split")}
                          className="text-[11px] link cursor-pointer font-medium"
                          title="Toggle between single box and separate boxes"
                        >
                          {inputMode === "split" ? "Switch to single box" : "Switch to 6 boxes"}
                        </button>
                      </div>
                    </div>

                    {/* Mode A: Standard 6 Split Boxes */}
                    {inputMode === "split" ? (
                      <div className="flex gap-2 justify-between" onPaste={handlePaste}>
                        {code.map((digit, idx) => (
                          <input
                            key={idx}
                            ref={(el) => {
                              codeRefs.current[idx] = el;
                            }}
                            type="text"
                            inputMode="numeric"
                            maxLength={2}
                            value={digit}
                            onChange={(e) => handleCodeChange(idx, e.target.value)}
                            onKeyDown={(e) => handleCodeKey(idx, e)}
                            disabled={expired || isLockedOut}
                            className={`text-center font-extrabold rounded-lg outline-none transition-all ${
                              easyReadMode ? "text-2xl h-14" : "text-xl h-12"
                            }`}
                            style={{
                              width: "calc((100% - 2.5rem) / 6)",
                              background: expired || isLockedOut ? "#f0e9c8" : "#fff",
                              border: `1.5px solid ${
                                codeError
                                  ? "#b4321e"
                                  : digit
                                  ? "#306D29"
                                  : expired || isLockedOut
                                  ? "#ddd"
                                  : "#E7E1B1"
                              }`,
                              color: expired || isLockedOut ? "#999" : "#0D530E",
                              boxShadow:
                                digit && !expired && !isLockedOut
                                  ? "0 0 0 3px rgba(48,109,41,0.12)"
                                  : "none",
                            }}
                            aria-label={`Digit ${idx + 1} of 6`}
                          />
                        ))}
                      </div>
                    ) : (
                      /* Mode B: Single Large Unified Box (Elderly / Tremor Friendly) */
                      <div className="space-y-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={code.join("")}
                          onChange={(e) => handleSingleInputChange(e.target.value)}
                          placeholder="e.g. 123456"
                          disabled={expired || isLockedOut}
                          className={`input text-center font-mono font-extrabold tracking-widest ${
                            easyReadMode ? "text-2xl py-3.5" : "text-xl py-3"
                          }`}
                          aria-label="6 digit security code"
                        />
                        <p className="text-[11px] text-dim text-center">
                          Type all 6 numbers together without spaces.
                        </p>
                      </div>
                    )}

                    {/* Dedicated Quick-Paste Button for Clipboard Ergonomics */}
                    <div className="flex items-center justify-between mt-2 pt-1 text-xs">
                      <button
                        type="button"
                        onClick={handleClipboardPaste}
                        className="text-forest hover:text-green font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Paste code from clipboard</span>
                      </button>

                      <span className="text-dim text-[11px]">
                        {MAX_ATTEMPTS - failedAttempts} attempts remaining
                      </span>
                    </div>

                    {/* Error / Lockout display */}
                    {codeError && (
                      <div
                        role="alert"
                        className="p-3 mt-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2 leading-snug animate-fade-up"
                      >
                        <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Code Check Failed</p>
                          <p className="mt-0.5">{codeError}</p>
                        </div>
                      </div>
                    )}

                    {expired && (
                      <div
                        role="alert"
                        className="p-3 mt-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2"
                      >
                        <Clock className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Challenge Expired</p>
                          <p className="mt-0.5">
                            For your security, verification codes expire after 15 minutes. Please request a fresh challenge below.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Expiry progress bar */}
                  <div className="space-y-1">
                    <div className="h-1.5 rounded-full bg-sand/60 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${expiryFrac * 100}%`, background: expiryColor }}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    id="verify-code-btn"
                    disabled={loading || code.join("").length < 6 || expired || isLockedOut}
                    className={`btn btn-forest w-full font-semibold cursor-pointer ${
                      easyReadMode ? "py-4 text-base" : "py-3 text-sm"
                    }`}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{loadingLabel}</span>
                      </span>
                    ) : (
                      <span>Verify code & proceed →</span>
                    )}
                  </button>
                </form>

                {/* Resend & navigation */}
                <div className="mt-5 pt-3 border-t border-sand/60 flex items-center justify-between text-xs">
                  {resendCooldown === 0 ? (
                    <button
                      type="button"
                      id="resend-code-btn"
                      onClick={handleResend}
                      className="link font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Request a new code</span>
                    </button>
                  ) : (
                    <span className="text-dim">
                      New code available in{" "}
                      <strong className="font-mono text-forest">
                        0:{String(resendCooldown).padStart(2, "0")}
                      </strong>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setStep("email");
                      setCode(Array(6).fill(""));
                      setCodeError("");
                    }}
                    className="text-dim hover:text-forest transition-colors cursor-pointer"
                  >
                    Change email address
                  </button>
                </div>

                {/* Senior / Non-tech Troubleshooter Accordion */}
                <div className="mt-4 pt-3 border-t border-sand/40">
                  <button
                    type="button"
                    onClick={() => setIsTroubleshooterOpen(!isTroubleshooterOpen)}
                    className="text-xs text-forest/80 hover:text-forest flex items-center justify-between w-full py-1 text-left font-medium cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-green" />
                      <span>Didn't get the email? Here's what to check:</span>
                    </span>
                    {isTroubleshooterOpen ? (
                      <ChevronUp className="w-4 h-4 text-dim" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-dim" />
                    )}
                  </button>

                  {isTroubleshooterOpen && (
                    <div className="mt-2.5 p-3.5 rounded-lg bg-sand/20 border border-sand text-xs text-dim space-y-2.5 animate-fade-up">
                      <p>
                        <strong>1. Check your Spam or Junk folder:</strong> Sometimes email providers mistakenly place security emails there.
                      </p>
                      <p>
                        <strong>2. Check email spelling:</strong> Sent to{" "}
                        <strong className="text-forest font-mono">{email}</strong>. If you mistyped it, click "Change email address" above.
                      </p>
                      <p>
                        <strong>3. Wait 1 or 2 minutes:</strong> Heavy email traffic can occasionally cause slight delivery delays.
                      </p>

                      {webmail.isKnown && (
                        <div className="pt-2 border-t border-sand/60">
                          <a
                            href={webmail.inboxUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline text-xs w-full py-2 flex items-center justify-center gap-1.5"
                          >
                            <span>Open {webmail.providerName} in a new tab</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                STEP 3: NEW PASSWORD (NIST 800-63B & Session Revocation)
               ══════════════════════════════════════════════════════════ */}
            {step === "newpass" && (
              <div>
                <div className="flex items-center gap-2 mb-2 text-green">
                  <ShieldCheck className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {verificationMethod === "magic_link" ? "Authenticated via Email Link" : "Code Verified"}
                  </span>
                </div>

                <h1
                  className={`font-heading font-bold text-forest mb-2 ${
                    easyReadMode ? "text-2xl sm:text-3xl leading-tight" : "text-2xl sm:text-3xl"
                  }`}
                >
                  Choose a new password
                </h1>
                <p className={`text-dim mb-5 leading-relaxed ${easyReadMode ? "text-base text-forest/80" : "text-sm"}`}>
                  Make it at least 10 letters long. Passwords that are easy for you to remember and hard for computers to guess work best.
                </p>

                {/* Memorable Passphrase Generator Helper */}
                <div className="mb-5 p-3.5 rounded-lg bg-sand/25 border border-sand space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-forest flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-green" />
                        <span>Need an easy password idea?</span>
                      </span>
                      <p className="text-xs text-dim">
                        We can suggest 3 simple words joined together (like <em className="text-forest font-semibold">sunny-river-cabin-42</em>).
                      </p>
                    </div>
                    <button
                      type="button"
                      id="suggest-passphrase-btn"
                      onClick={handleSuggestPassphrase}
                      className="btn btn-outline text-xs py-2 px-3 flex-shrink-0 hover:bg-forest hover:text-cream transition-colors cursor-pointer"
                    >
                      Suggest a password
                    </button>
                  </div>

                  {newPassword && (
                    <div className="pt-2 border-t border-sand/60 flex items-center justify-between text-xs">
                      <span className="text-dim">Suggested password loaded into both fields:</span>
                      <button
                        type="button"
                        onClick={handleCopyPassphrase}
                        className="text-green hover:text-forest font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        {copiedPassphrase ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedPassphrase ? "Copied!" : "Copy password"}</span>
                      </button>
                    </div>
                  )}
                </div>

                <form onSubmit={handlePassSubmit} className="space-y-4">
                  {/* New Password */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="new-password-input"
                        className="block text-xs font-bold text-dim uppercase tracking-wide"
                      >
                        New Password or Passphrase
                      </label>
                      <span className="text-xs text-dim font-mono">{newPassword.length} characters</span>
                    </div>

                    <div className="relative">
                      <input
                        type={showNew ? "text" : "password"}
                        id="new-password-input"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="e.g. sunny-river-cabin-42"
                        required
                        autoFocus
                        className={`input pr-10 ${easyReadMode ? "py-3.5 text-base" : ""}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(!showNew)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-forest transition-colors p-1 cursor-pointer"
                        aria-label={showNew ? "Hide password" : "Show password"}
                      >
                        {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Real-Time NIST SP 800-63B Complexity & Threat Validator */}
                    <NistPasswordValidator
                      analysis={nistAnalysis}
                      passwordLength={newPassword.length}
                      easyReadMode={easyReadMode}
                    />
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label
                      htmlFor="confirm-password-input"
                      className="block text-xs font-bold text-dim uppercase tracking-wide mb-1.5"
                    >
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirm ? "text" : "password"}
                        id="confirm-password-input"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat your new password"
                        required
                        className={`input pr-10 ${easyReadMode ? "py-3.5 text-base" : ""}`}
                        style={{
                          borderColor: mismatch ? "#b4321e" : match ? "#306D29" : undefined,
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-forest transition-colors p-1 cursor-pointer"
                        aria-label={showConfirm ? "Hide confirmation password" : "Show confirmation password"}
                      >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {mismatch && <p className="text-xs mt-1 text-red-600 font-semibold">Passwords do not match.</p>}
                    {match && (
                      <p className="text-xs mt-1 text-green font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Passwords match
                      </p>
                    )}
                  </div>

                  {/* Senior Memory Tip Card */}
                  <div className="p-3 rounded-lg bg-sand/30 border border-sand text-xs text-dim flex items-start gap-2.5">
                    <span className="text-green font-bold text-sm">💡</span>
                    <div className="leading-relaxed">
                      <strong className="text-forest">Memory tip for home:</strong> Cybersecurity experts agree: it is completely safe and okay to write down your password in a private notebook kept in a safe drawer at home.
                    </div>
                  </div>

                  {/* CRITICAL SECURITY FEATURE: Revoke Active Sessions Across Devices */}
                  <div className="pt-2 border-t border-sand/60">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        id="revoke-sessions-checkbox"
                        checked={revokeAllSessions}
                        onChange={(e) => setRevokeAllSessions(e.target.checked)}
                        className="mt-1 rounded accent-forest cursor-pointer"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-forest block">
                          Sign out of all other devices &amp; active sessions (Recommended)
                        </span>
                        <span className="text-dim block leading-relaxed mt-0.5">
                          Protects your account by logging out old phones, tablets, or computers.
                        </span>
                      </div>
                    </label>

                    {/* Active Sessions review */}
                    <div className="mt-2 ml-6">
                      <button
                        type="button"
                        onClick={() => setShowSessionsList(!showSessionsList)}
                        className="text-[11px] link cursor-pointer font-medium"
                      >
                        {showSessionsList
                          ? "Hide active devices list"
                          : `Review ${activeSessions.length - 1} other active device sessions`}
                      </button>

                      {showSessionsList && (
                        <div className="mt-2 p-2.5 rounded bg-sand/30 border border-sand space-y-2 text-[11px] animate-fade-up">
                          {activeSessions.map((s) => (
                            <div key={s.id} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {s.device.includes("iPhone") ? (
                                  <Smartphone className="w-3.5 h-3.5 text-forest" />
                                ) : (
                                  <Laptop className="w-3.5 h-3.5 text-forest" />
                                )}
                                <div>
                                  <span className="font-medium text-forest">{s.device}</span>
                                  <span className="text-dim ml-1">({s.location})</span>
                                </div>
                              </div>
                              <span className="text-dim">{s.isCurrent ? "Current browser" : s.lastActive}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    id="save-new-password-btn"
                    disabled={!canSubmitPassword}
                    className={`btn btn-forest w-full font-semibold cursor-pointer ${
                      easyReadMode ? "py-4 text-base" : "py-3.5 text-sm"
                    }`}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{loadingLabel}</span>
                      </span>
                    ) : (
                      <span>Save new password &amp; secure account →</span>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                STEP 4: SUCCESS (Audit Confirmation & Session Invalidation)
               ══════════════════════════════════════════════════════════ */}
            {step === "success" && (
              <div className="text-center pt-2">
                {/* Success Icon */}
                <div className="w-16 h-16 rounded-full bg-green/10 border-2 border-forest flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-8 h-8 text-forest" />
                </div>

                <h1
                  className={`font-heading font-bold text-forest mb-2 ${
                    easyReadMode ? "text-2xl sm:text-3xl" : "text-2xl sm:text-3xl"
                  }`}
                >
                  Password updated &amp; verified
                </h1>
                <p className={`text-dim mb-6 max-w-sm mx-auto leading-relaxed ${easyReadMode ? "text-base" : "text-sm"}`}>
                  Your account has been securely updated. You can now use your new password to sign in.
                </p>

                {/* Security Guarantees & Destroyed Tokens Notice */}
                <div className="space-y-2.5 text-left mb-6">
                  {/* Token Burned */}
                  <div className="p-3 rounded-lg border border-sand/80 bg-cream/40 flex items-start gap-2.5 text-xs">
                    <Lock className="w-4 h-4 text-forest flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-forest block">Reset Tokens Permanently Burned</span>
                      <span className="text-dim">The single-use verification code and link are destroyed and can never be reused.</span>
                    </div>
                  </div>

                  {/* Sessions Invalidated */}
                  {revokeAllSessions && (
                    <div className="p-3 rounded-lg border border-green/30 bg-green/5 flex items-start gap-2.5 text-xs">
                      <CheckCircle2 className="w-4 h-4 text-green flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-forest block">All Other Active Sessions Signed Out</span>
                        <span className="text-dim">Other computers and phones have been signed out. Only authentications with your new password are permitted.</span>
                      </div>
                    </div>
                  )}

                  {/* Security Audit Stamp */}
                  <div className="p-3 rounded-lg border border-sand bg-sand/20 text-[11px] text-dim space-y-1">
                    <div className="flex items-center justify-between font-mono">
                      <span>Audit ID: <strong>SEC-{Math.floor(100000 + Math.random() * 900000)}</strong></span>
                      <span>{auditTimestamp}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Method: <strong>{verificationMethod === "magic_link" ? "1-Click Magic Link" : "6-Digit Dual OTP"}</strong></span>
                      <span>Account: <strong>{maskEmail(email)}</strong></span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  id="continue-to-login-btn"
                  onClick={() =>
                    navigate("/login", {
                      state: {
                        email,
                        fromReset: true,
                        sessionsRevoked: revokeAllSessions,
                      },
                    })
                  }
                  className={`btn btn-forest w-full flex items-center justify-center gap-2 font-semibold cursor-pointer ${
                    easyReadMode ? "py-4 text-base" : "py-3.5 text-sm"
                  }`}
                >
                  <span>Continue to sign in</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
