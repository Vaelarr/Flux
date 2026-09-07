import { RefreshCw, Shield, Lock } from "lucide-react";

export interface AuthSkeletonProps {
  type?: "login" | "register" | "generic";
  variant?: "panel" | "plain";
  showHeader?: boolean;
  message?: string;
  submessage?: string;
  className?: string;
}

/**
 * High-craft skeleton screen component for authentication and registration flows.
 * Uses warm cream/sand CSS shimmer animations matching Flux's visual identity
 * to improve perceived performance during network requests.
 */
export default function AuthSkeleton({
  type = "login",
  variant = "plain",
  showHeader = false,
  message = "Authenticating securely…",
  submessage = "Verifying credentials and preparing your session",
  className = "",
}: AuthSkeletonProps) {
  const isRegister = type === "register";
  const isPanel = variant === "panel";

  const containerClasses = isPanel
    ? `panel p-6 sm:p-8 animate-fade-up relative overflow-hidden ${className}`
    : `animate-fade-up relative overflow-hidden ${className}`;

  return (
    <div
      className={containerClasses}
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      {/* Top indeterminate loading accent bar */}
      <div className="h-1 bg-sand/30 overflow-hidden rounded-full mb-4">
        <div className="h-full bg-forest/80 w-1/3 rounded-full loading-bar-indicator" />
      </div>

      {/* Header Skeleton (optional for standalone screens or full replacement) */}
      {showHeader && (
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between">
            <div className="skeleton h-7 w-44 rounded-md" />
            <div className="skeleton h-5 w-16 rounded-full opacity-60" />
          </div>
          <div className="skeleton h-4 w-60 rounded-md" />
        </div>
      )}

      {/* Live Status Badge */}
      {message && (
        <div className="mb-5 p-3 rounded-lg border border-sand bg-sand/25 flex items-center gap-2.5">
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
        {/* Full Name (Register only) */}
        {isRegister && (
          <div>
            <div className="skeleton h-3 w-16 mb-1.5 rounded" />
            <div className="skeleton h-11 w-full rounded-md border border-sand/40" />
          </div>
        )}

        {/* Email Field */}
        <div>
          <div className="skeleton h-3 w-20 mb-1.5 rounded" />
          <div className="skeleton h-11 w-full rounded-md border border-sand/40" />
        </div>

        {/* Password Field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="skeleton h-3 w-16 rounded" />
            {isRegister ? (
              <div className="skeleton h-3 w-28 rounded" />
            ) : (
              <div className="skeleton h-3 w-24 rounded" />
            )}
          </div>
          <div className="skeleton h-11 w-full rounded-md border border-sand/40" />
        </div>

        {/* Extra register password checklist skeleton */}
        {isRegister ? (
          <div className="p-3 rounded-lg border border-sand/60 bg-sand/15 space-y-2">
            <div className="skeleton h-3 w-32 rounded mb-2" />
            <div className="flex items-center gap-2">
              <div className="skeleton w-3 h-3 rounded-full flex-shrink-0" />
              <div className="skeleton h-2.5 w-48 rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="skeleton w-3 h-3 rounded-full flex-shrink-0" />
              <div className="skeleton h-2.5 w-40 rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="skeleton w-3 h-3 rounded-full flex-shrink-0" />
              <div className="skeleton h-2.5 w-52 rounded" />
            </div>
          </div>
        ) : null}

        {/* Checkbox row */}
        {isRegister ? (
          <div className="flex items-start gap-2.5 pt-1">
            <div className="skeleton w-4 h-4 rounded-[3px] border border-sand/50 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="skeleton h-3 w-56 rounded" />
              <div className="skeleton h-2.5 w-40 rounded" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 pt-0.5">
            <div className="skeleton w-4 h-4 rounded-[3px] border border-sand/50 flex-shrink-0" />
            <div className="skeleton h-3.5 w-44 rounded" />
          </div>
        )}

        {/* Primary Action Button Skeleton */}
        <div className="pt-1">
          <div className="skeleton h-11 w-full rounded-md opacity-90" />
        </div>

        {/* Divider Skeleton */}
        <div className="flex items-center gap-3 py-1">
          <div className="skeleton h-px flex-1 opacity-50" />
          <div className="skeleton h-3 w-4 rounded opacity-50" />
          <div className="skeleton h-px flex-1 opacity-50" />
        </div>

        {/* Social Buttons Skeleton (Google & Apple) */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="skeleton h-10 w-full rounded-md border border-sand/40" />
          <div className="skeleton h-10 w-full rounded-md border border-sand/40" />
        </div>
      </div>

      {/* Footer subtle security note skeleton */}
      <div className="mt-5 pt-3 border-t border-sand/50 flex items-center justify-center gap-1.5 opacity-70">
        {isRegister ? (
          <Shield className="w-3.5 h-3.5 text-dim" />
        ) : (
          <Lock className="w-3.5 h-3.5 text-dim" />
        )}
        <div className="skeleton h-2.5 w-44 rounded" />
      </div>
    </div>
  );
}

