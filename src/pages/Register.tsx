import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  ShieldCheck,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  KeyRound,
  CheckCircle2,
  UserPlus,
  RefreshCw,
  HelpCircle,
  Zap,
  AlertCircle,
} from "lucide-react";
import { FluxLogo } from "./Landing";
import { analyzeNistPassword, generatePassphrase } from "../utils/security";
import {
  createAccount,
  getRegisteredAccounts,
  signInWithGoogleService,
  signInWithAppleService,
} from "../utils/accounts";
import NistPasswordValidator from "../components/NistPasswordValidator";
import AuthSkeleton from "../components/AuthSkeleton";
import SocialAuthModal from "../components/SocialAuthModal";

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();

  // Form states
  const [name, setName] = useState(location.state?.name ?? "");
  const [email, setEmail] = useState(location.state?.email ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);

  // Flow states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("Creating your account…");
  const [accountCreated, setAccountCreated] = useState<boolean>(false);
  const [createdEmail, setCreatedEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [socialModalState, setSocialModalState] = useState<{
    isOpen: boolean;
    provider: "google" | "apple";
  }>({
    isOpen: false,
    provider: "google",
  });

  // NIST Password analysis in real-time
  const nistAnalysis = analyzeNistPassword(password, email);
  const canSubmit =
    name.trim().length >= 2 &&
    email.includes("@") &&
    nistAnalysis.allCriticalMet &&
    agreeTerms &&
    !isSubmitting;

  const handleGeneratePassphrase = () => {
    const generated = generatePassphrase();
    setPassword(generated);
    setShowPassword(true);
  };

  const handleSocialRegister = async (provider: "Google" | "Apple") => {
    setErrorMsg(null);
    setLoadingMsg(`Setting up account with ${provider}…`);
    setIsSubmitting(true);

    const lowerProvider = provider.toLowerCase() as "google" | "apple";
    const res =
      provider === "Google" ? await signInWithGoogleService() : await signInWithAppleService();
    setIsSubmitting(false);

    if (res.success && res.user) {
      setCreatedEmail(res.user.email);
      setAccountCreated(true);
    } else if (res.needsFallback) {
      setSocialModalState({
        isOpen: true,
        provider: lowerProvider,
      });
    } else {
      setErrorMsg(res.error || `Failed to sign up with ${provider}.`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    // Ensure smooth CSS skeleton screen feedback during registration
    await Promise.all([
      createAccount({
        name,
        email,
        password,
      }),
      new Promise((resolve) => setTimeout(resolve, 850)),
    ]);
    setCreatedEmail(email);
    setIsSubmitting(false);
    setAccountCreated(true);
  };

  return (
    <div className="bg-cream min-h-screen flex flex-col text-forest">
      {/* Header Navigation */}
      <header className="border-b border-sand bg-cream/80 backdrop-blur sticky top-0 z-10">
        <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 md:px-10 h-14">
          <FluxLogo />
          <div className="flex items-center gap-3 text-sm">
            <span className="text-dim hidden sm:inline">Already have an account?</span>
            <Link to="/login" className="btn btn-outline text-xs py-1.5 px-3">
              Sign in
            </Link>
          </div>
        </nav>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-10 md:py-14">
        <div className="w-full max-w-md">

          {accountCreated ? (
            /* Post-Account Creation Success Screen */
            <div className="panel p-6 sm:p-8 space-y-6 animate-fade-up">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-full bg-green/10 border-2 border-green flex items-center justify-center mx-auto text-green mb-1">
                  <CheckCircle2 className="w-8 h-8 stroke-[2.2]" />
                </div>
                <h1 className="font-heading text-2xl font-bold text-forest">
                  Welcome to Flux!
                </h1>
                <p className="text-xs text-dim max-w-xs mx-auto">
                  Your account for <span className="font-semibold text-forest font-mono">{createdEmail}</span> is ready.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    navigate("/login", {
                      state: { email: createdEmail },
                    })
                  }
                  className="btn btn-forest w-full py-3.5 text-sm gap-2 font-medium flex items-center justify-center"
                >
                  <span>Sign in to your account</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="btn btn-outline w-full py-2.5 text-xs text-dim hover:text-forest"
                >
                  Back to homepage
                </button>
              </div>

              {/* Account summary details */}
              <div className="pt-3 border-t border-sand text-xs text-dim flex items-center justify-between">
                <span>Account status: <strong className="text-forest">Active</strong></span>
                <span>Security: <strong className="text-forest">Protected</strong></span>
              </div>
            </div>
          ) : isSubmitting ? (
            /* Elegant CSS Shimmer Skeleton Screen during account registration */
            <AuthSkeleton
              type="register"
              message={loadingMsg}
              submessage="Setting up your secure profile and personal timeline"
            />
          ) : (
            /* Create Account Form */
            <div className="panel p-6 sm:p-8">
              <div className="mb-6">
                <h1 className="font-heading text-3xl font-bold text-forest mb-1.5">
                  Create your account
                </h1>
                <p className="text-sm text-dim">
                  Join millions having calm, meaningful conversations.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 mb-4 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2 animate-fade-up">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>{errorMsg}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-dim tracking-wide uppercase mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    required
                    className="input"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-dim tracking-wide uppercase mb-1.5">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="input font-mono text-sm"
                  />
                  <p className="text-xs text-dim mt-1">
                    We'll never share or sell your email address.
                  </p>
                </div>

                {/* Password with live validation */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-dim tracking-wide uppercase">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={handleGeneratePassphrase}
                      className="text-xs link flex items-center gap-1 text-green font-medium hover:underline"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Suggest an easy password
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 10 letters (e.g. sunny-blue-river)"
                      required
                      className="input pr-10 font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-forest transition-colors p-1"
                      title={showPassword ? "Hide password" : "Show password"}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Password Validator */}
                  <NistPasswordValidator
                    analysis={nistAnalysis}
                    passwordLength={password.length}
                  />
                </div>

                {/* Terms agreement checkbox */}
                <div className="pt-2">
                  <label className="flex items-start gap-2.5 text-xs text-dim cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      className="mt-0.5 accent-green rounded"
                    />
                    <span className="leading-tight">
                      I agree to the Flux Terms of Service and Privacy Policy.
                    </span>
                  </label>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="btn btn-forest w-full py-3.5 text-sm mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Creating account…</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Create Account</span>
                    </>
                  )}
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3 py-1">
                  <hr className="rule flex-1" />
                  <span className="text-xs text-dim">or sign up with</span>
                  <hr className="rule flex-1" />
                </div>

                {/* Social Buttons */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleSocialRegister("Google")}
                    className="btn btn-outline text-xs gap-2 w-full py-2.5"
                  >
                    <GoogleIcon /> Google
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSocialRegister("Apple")}
                    className="btn btn-outline text-xs gap-2 w-full py-2.5"
                  >
                    <AppleIcon /> Apple
                  </button>
                </div>
              </form>

              {/* Standard Sign In Link */}
              <div className="mt-6 pt-5 border-t border-sand text-center">
                <p className="text-xs text-dim">
                  Already have an account?{" "}
                  <Link to="/login" className="link font-semibold text-forest">
                    Sign in here
                  </Link>
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      <SocialAuthModal
        isOpen={socialModalState.isOpen}
        provider={socialModalState.provider}
        initialEmail={email}
        onClose={() => setSocialModalState((prev) => ({ ...prev, isOpen: false }))}
        onSuccess={(account) => {
          setCreatedEmail(account.email);
          setAccountCreated(true);
        }}
      />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.92-2.85-.9.04-2 .6-2.65 1.35-.58.67-1.09 1.74-.95 2.77 1.01.08 2.05-.52 2.68-1.27z" />
    </svg>
  );
}
