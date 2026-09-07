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
} from "lucide-react";
import { FluxLogo } from "./Landing";
import { analyzeNistPassword, generatePassphrase } from "../utils/security";
import { createAccount, getRegisteredAccounts } from "../utils/accounts";
import NistPasswordValidator from "../components/NistPasswordValidator";
import AuthSkeleton from "../components/AuthSkeleton";

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
  const [accountCreated, setAccountCreated] = useState<boolean>(false);
  const [createdEmail, setCreatedEmail] = useState("");

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
              message="Creating your account…"
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
                    placeholder="Alex Tupaen"
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
    </div>
  );
}
