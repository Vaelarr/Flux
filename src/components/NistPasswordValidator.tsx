import { Check, X, ShieldCheck, HelpCircle, AlertCircle, Lightbulb, CheckCircle2 } from "lucide-react";
import { PasswordAnalysis } from "../types";

interface NistPasswordValidatorProps {
  analysis: PasswordAnalysis;
  passwordLength: number;
}

export default function NistPasswordValidator({
  analysis,
  passwordLength,
}: NistPasswordValidatorProps) {
  const { score, label, color, requirements, tip, isBreached, allCriticalMet } = analysis;

  return (
    <div className="space-y-3 pt-1 text-forest">
      {/* Strength Header */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <span className="text-dim">Strength:</span>
            <span className="font-bold" style={{ color: passwordLength === 0 ? "#6B655B" : color }}>
              {passwordLength === 0 ? "Not entered yet" : label}
            </span>
          </div>
          <span className="text-xs text-dim font-medium">
            {passwordLength > 0
              ? `${passwordLength} characters ${passwordLength < 10 ? "(need 10+)" : "✓"}`
              : "10 characters minimum"}
          </span>
        </div>

        {/* 4-segment clear strength meter */}
        <div className="flex gap-1.5 h-2" role="progressbar" aria-valuenow={score} aria-valuemin={0} aria-valuemax={4}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-full transition-all duration-300"
              style={{
                background:
                  passwordLength === 0
                    ? "#E7E1B1"
                    : isBreached
                    ? i === 0
                      ? "#b4321e"
                      : "#E7E1B1"
                    : i < score
                    ? color
                    : "#E7E1B1",
              }}
            />
          ))}
        </div>
      </div>

      {/* Helpful Guidance Notice */}
      {passwordLength > 0 && (
        <div
          className={`p-3 rounded-lg text-xs sm:text-sm flex items-start gap-2.5 border transition-colors ${
            isBreached
              ? "bg-red-50 border-red-200 text-red-800"
              : allCriticalMet && score >= 3
              ? "bg-green/10 border-green/30 text-forest"
              : "bg-sand/30 border-sand text-forest"
          }`}
        >
          {isBreached ? (
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          ) : allCriticalMet && score >= 3 ? (
            <CheckCircle2 className="w-4 h-4 text-green flex-shrink-0 mt-0.5" />
          ) : (
            <Lightbulb className="w-4 h-4 text-dim flex-shrink-0 mt-0.5" />
          )}
          <span className="leading-relaxed">{tip}</span>
        </div>
      )}

      {/* Simple Checklist */}
      <div className="p-3.5 rounded-lg border border-sand bg-cream/40 space-y-2.5">
        <div className="flex items-center justify-between pb-1.5 border-b border-sand/60">
          <div className="flex items-center gap-1.5 text-forest">
            <ShieldCheck className="w-4 h-4 text-green" />
            <span className="text-xs font-bold tracking-wide">
              Password Checklist
            </span>
          </div>
          <span className="text-[11px] text-dim">
            {allCriticalMet ? "✓ Ready to use" : "A few steps left"}
          </span>
        </div>

        <div className="space-y-2 pt-0.5">
          {requirements.map((req) => {
            const isPass = req.status === "pass";
            const isFail = req.status === "fail";

            return (
              <div
                key={req.id}
                className="flex items-start gap-2.5 text-xs sm:text-sm leading-snug"
              >
                {/* Status icon bullet */}
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                    isPass
                      ? "bg-green text-cream"
                      : isFail
                      ? "bg-red-600 text-white"
                      : "border border-sand bg-white text-transparent"
                  }`}
                  aria-label={isPass ? "Passed" : isFail ? "Needs attention" : "Pending"}
                >
                  {isPass ? (
                    <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                  ) : isFail ? (
                    <X className="w-2.5 h-2.5 stroke-[2.5]" />
                  ) : null}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${isPass ? "text-forest" : isFail ? "text-red-700" : "text-dim"}`}>
                      {req.label}
                    </span>
                    {req.critical && !isPass && passwordLength > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-semibold uppercase">
                        Required
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-dim mt-0.5 leading-normal">
                    {req.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Helpful Footnote for General Users / Seniors */}
        <div className="pt-2 border-t border-sand/60 text-xs text-dim leading-relaxed flex items-start gap-2">
          <span className="text-green font-bold">💡</span>
          <span>
            <strong>Easy tip:</strong> You do not need confusing symbols like !@#$. Simply joining 3 or 4 everyday words (like <em className="text-forest font-medium">sunny-blue-river</em>) is easy to remember and very safe.
          </span>
        </div>
      </div>
    </div>
  );
}
