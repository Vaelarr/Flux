import { Check, AlertCircle } from "lucide-react"
import type { PasswordAnalysis } from "../types"

interface NistPasswordValidatorProps {
  analysis: PasswordAnalysis
  passwordLength: number
  easyReadMode?: boolean
}

const REQUIREMENT_LABELS: Record<string, string> = {
  length: "At least 15 characters",
  breach: "Avoid common passwords",
  context: "Avoid your email and ‘Flux’",
  patterns: "Avoid repeated or sequential characters",
}

export default function NistPasswordValidator({
  analysis,
  passwordLength,
  easyReadMode = false,
}: NistPasswordValidatorProps) {
  const { score, label, color, requirements, allCriticalMet } = analysis
  const hasPassword = passwordLength > 0
  const issues = requirements.filter(
    (requirement) => requirement.status === "fail",
  )

  return (
    <div
      id="password-guidance"
      className={`mt-2 space-y-2 ${easyReadMode ? "text-sm" : "text-xs"}`}
    >
      {hasPassword ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium" style={{ color }}>
              Strength: {label}
            </span>
            <span className="text-dim">
              {allCriticalMet ? "Meets requirements" : "Needs attention"}
            </span>
          </div>
          <div
            className="flex gap-1 h-1.5"
            role="progressbar"
            aria-label="Password strength"
            aria-valuenow={score}
            aria-valuemin={0}
            aria-valuemax={4}
            aria-valuetext={label}
          >
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="flex-1 rounded-full"
                style={{ background: index < score ? color : "#E7E1B1" }}
              />
            ))}
          </div>
          {issues.length > 0 && (
            <ul className="space-y-1" aria-live="polite">
              {issues.map((requirement) => (
                <li
                  key={requirement.id}
                  className={`flex items-start gap-1.5 ${
                    requirement.critical ? "text-red-700" : "text-dim"
                  }`}
                >
                  <AlertCircle
                    className="w-3.5 h-3.5 mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    {requirement.id === "length"
                      ? "Use at least 15 characters."
                      : requirement.id === "breach"
                        ? "This password is too common. Choose another."
                        : requirement.id === "context"
                          ? "Tip: avoid your email and ‘Flux’."
                          : "Tip: avoid repeated or sequential characters."}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="text-dim">
          Use at least 15 characters. Avoid common passwords.
        </p>
      )}

      <details className="text-dim">
        <summary className="cursor-pointer w-fit py-1 link">
          Password requirements
        </summary>
        <div className="mt-1 rounded-md border border-sand p-3 space-y-2">
          <ul className="space-y-2">
            {requirements.map((requirement) => (
              <li key={requirement.id} className="flex items-start gap-2">
                <span
                  className="w-3.5 h-3.5 shrink-0 mt-0.5"
                  aria-hidden="true"
                >
                  {hasPassword && requirement.status === "pass" ? (
                    <Check className="w-3.5 h-3.5 text-green" />
                  ) : (
                    <span className="block w-1 h-1 rounded-full bg-current m-1" />
                  )}
                </span>
                <span>
                  {REQUIREMENT_LABELS[requirement.id] ?? requirement.label}
                  <span className="ml-1 text-dim">
                    ({requirement.critical ? "required" : "recommended"})
                  </span>
                  <span className="sr-only">
                    {hasPassword
                      ? `: ${requirement.status === "pass" ? "met" : "not met"}`
                      : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="border-t border-sand pt-2 leading-relaxed">
            Try several unrelated words. Use a unique password for Flux.
          </p>
        </div>
      </details>
    </div>
  )
}
