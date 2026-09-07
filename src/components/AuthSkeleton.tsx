import { RefreshCw, Shield } from "lucide-react";

export interface AuthSkeletonProps {
  type?: "login" | "register" | "generic";
  message?: string;
  submessage?: string;
  className?: string;
}

/**
 * High-craft skeleton screen component for authentication and registration flows.
 * Uses warm cream/sand CSS shimmer animations matching Flux's visual identity.
 */
export default function AuthSkeleton({
  type = "login",
  message = "Authenticating securely…",
  submessage = "Verifying credentials and preparing your session",
  className = "",
}: AuthSkeletonProps) {
  const isRegister = type === "register";

  return (
    <div
      className={`panel p-6 sm:p-8 animate-fade-up relative overflow-hidden ${className}`}
      aria-busy="true"
      aria-live="polite"
    >
      {/* Top indeterminate loading accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-sand/40 overflow-hidden">
        <div className="h-full bg-forest w-1/3 rounded-full loading-bar-indicator" />
      </div>

      {/* Header Skeleton */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <div className="skeleton h-7 w-44 rounded-md" />
          <div className="skeleton h-5 w-16 rounded-full opacity-60" />
        </div>
        <div className="skeleton h-4 w-60 rounded-md" />
      </div>

      {/* Live Status Badge */}
      {message && (
        <div className="mb-6 p-3 rounded-lg border border-sand bg-sand/20 flex items-center gap-2.5">
          <RefreshCw className="w-4 h-4 text-forest animate-spin flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-forest leading-none">{message}</p>
            {submessage && (
              <p className="text-[11px] text-dim mt-1 leading-tight">{submessage}</p>
            )}
          </div>
        </div>
      )}

      {/* Input Fields Skeleton */}
      <div className="space-y-4">
        {isRegister && (
          <div>
            <div className="skeleton h-3.5 w-20 mb-2 rounded" />
            <div className="skeleton h-11 w-full rounded-md" />
          </div>
        )}

        {/* Email Field */}
        <div>
          <div className="skeleton h-3.5 w-24 mb-2 rounded" />
          <div className="skeleton h-11 w-full rounded-md" />
        </div>

        {/* Password Field */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="skeleton h-3.5 w-16 rounded" />
            <div className="skeleton h-3 w-28 rounded" />
          </div>
          <div className="skeleton h-11 w-full rounded-md" />
        </div>

        {/* Extra register checklist skeleton lines */}
        {isRegister ? (
          <div className="pt-2 space-y-2">
            <div className="skeleton h-3.5 w-4/5 rounded" />
            <div className="skeleton h-3 w-3/4 rounded" />
          </div>
        ) : (
          /* Remember Me checkbox skeleton */
          <div className="flex items-center gap-2.5 pt-1">
            <div className="skeleton w-4 h-4 rounded-[3px]" />
            <div className="skeleton h-3.5 w-44 rounded" />
          </div>
        )}

        {/* Primary Action Button Skeleton */}
        <div className="pt-2">
          <div className="skeleton h-12 w-full rounded-md" />
        </div>

        {/* Divider & Social Buttons Skeleton (for Login) */}
        {!isRegister && (
          <>
            <div className="flex items-center gap-3 py-1">
              <div className="skeleton h-px flex-1" />
              <div className="skeleton h-3 w-4 rounded" />
              <div className="skeleton h-px flex-1" />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="skeleton h-9 rounded-md" />
              <div className="skeleton h-9 rounded-md" />
            </div>
          </>
        )}
      </div>

      {/* Footer subtle text skeleton */}
      <div className="mt-6 pt-4 border-t border-sand/60 flex items-center justify-center gap-1.5">
        <Shield className="w-3.5 h-3.5 text-dim/60" />
        <div className="skeleton h-3 w-40 rounded" />
      </div>
    </div>
  );
}
