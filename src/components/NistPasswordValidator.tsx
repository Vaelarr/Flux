import { Check, X, ShieldCheck, HelpCircle, AlertCircle, Lightbulb, CheckCircle2 } from "lucide-react";
import { PasswordAnalysis } from "../types";

interface NistPasswordValidatorProps {
  analysis: PasswordAnalysis;
  passwordLength: number;
  easyReadMode?: boolean;
}

export default function NistPasswordValidator({
  analysis,
  passwordLength,
  easyReadMode = false,
}: NistPasswordValidatorProps) {
  const { score, label, color, requirements, tip, isBreached, allCriticalMet } = analysis;

  return (
    <div className={`space-y-3 pt-1 text-forest ${easyReadMode ? "text-base" : "text-sm"}`}>
      {/* Strength Header */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <span className={easyReadMode ? "text-forest font-semibold" : "text-dim"}>Password Strength:</span>
            <span
              className={`font-bold ${easyReadMode ? "text-sm sm:text-base" : ""}`}
              style={{ color: passwordLength === 0 ? "#6B655B" : color }}
            >
              {passwordLength === 0 ? "Not entered yet" : label}
            </span>
          </div>
          <span className={`${easyReadMode ? "text-xs font-semibold text-forest" : "text-xs text-dim"} font-medium`}>
            {passwordLength > 0
              ? `${passwordLength} characters ${passwordLength < 10 ? "(need 10+)" : "✓"}`
              : "10 characters minimum"}
          </span>
        </div>

        {/* 4-segment clear strength meter */}
        <div
          className={`flex gap-1.5 ${easyReadMode ? "h-3" : "h-2"}`}
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={4}
        >
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
          className={`p-3 rounded-lg flex items-start gap-2.5 border transition-colors ${
            easyReadMode ? "text-sm leading-relaxed" : "text-xs sm:text-sm"
          } ${
            isBreached
              ? "bg-red-50 border-red-200 text-red-800"
              : allCriticalMet && score >= 3
              ? "bg-green/10 border-green/30 text-forest"
              : "bg-sand/30 border-sand text-forest"
          }`}
        >
          {isBreached ? (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          ) : allCriticalMet && score >= 3 ? (
            <CheckCircle2 className="w-5 h-5 text-green flex-shrink-0 mt-0.5" />
          ) : (
            <Lightbulb className="w-5 h-5 text-dim flex-shrink-0 mt-0.5" />
          )}
          <span className="leading-relaxed">{tip}</span>
        </div>
      )}

      {/* Simple Checklist */}
      <div className={`rounded-lg border border-sand bg-cream/40 space-y-2.5 ${easyReadMode ? "p-4" : "p-3.5"}`}>
        <div className="flex items-center justify-between pb-1.5 border-b border-sand/60">
          <div className="flex items-center gap-1.5 text-forest">
            <ShieldCheck className={`${easyReadMode ? "w-5 h-5" : "w-4 h-4"} text-green`} />
            <span className={`${easyReadMode ? "text-sm" : "text-xs"} font-bold tracking-wide`}>
              Simple Checklist
            </span>
          </div>
          <span className={`${easyReadMode ? "text-xs font-semibold text-forest" : "text-[11px] text-dim"}`}>
            {allCriticalMet ? "✓ Ready to use" : "A few steps left"}
          </span>
        </div>

        <div className="space-y-2.5 pt-0.5">
          {requirements.map((req) => {
            const isPass = req.status === "pass";
            const isFail = req.status === "fail";

            return (
              <div
                key={req.id}
                className={`flex items-start gap-2.5 leading-snug ${easyReadMode ? "text-sm sm:text-base" : "text-xs sm:text-sm"}`}
              >
                {/* Status icon bullet */}
                <div
                  className={`rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                    easyReadMode ? "w-5 h-5" : "w-4 h-4"
                  } ${
                    isPass
                      ? "bg-green text-cream"
                      : isFail
                      ? "bg-red-600 text-white"
                      : "border border-sand bg-white text-transparent"
                  }`}
                  aria-label={isPass ? "Passed" : isFail ? "Needs attention" : "Pending"}
                >
                  {isPass ? (
                    <Check className={`${easyReadMode ? "w-3 h-3 stroke-[3]" : "w-2.5 h-2.5 stroke-[2.5]"}`} />
                  ) : isFail ? (
                    <X className={`${easyReadMode ? "w-3 h-3 stroke-[3]" : "w-2.5 h-2.5 stroke-[2.5]"}`} />
                  ) : null}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${isPass ? "text-forest" : isFail ? "text-red-700" : "text-dim"}`}>
                      {req.label}
                    </span>
                    {req.critical && !isPass && passwordLength > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-semibold uppercase">
                        Required
                      </span>
                    )}
                  </div>
                  <p className={`mt-0.5 leading-normal ${easyReadMode ? "text-xs sm:text-sm text-forest/70" : "text-xs text-dim"}`}>
                    {req.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Helpful Footnote for General Users / Seniors */}
        <div className="pt-2.5 border-t border-sand/60 text-xs text-dim leading-relaxed flex items-start gap-2">
          <span className="text-green font-bold text-sm">💡</span>
          <span className={easyReadMode ? "text-xs sm:text-sm text-forest/80 leading-relaxed" : ""}>
            <strong>Easy tip:</strong> You do not need confusing symbols like !@#$. Simply joining 3 or 4 everyday words (like <em className="text-forest font-semibold">sunny-blue-river</em>) is easy to remember and very safe.
          </span>
        </div>
      </div>
    </div>
  );
}
