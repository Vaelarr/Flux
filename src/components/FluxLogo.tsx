import { Link } from "react-router-dom";

export interface FluxLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showWordmark?: boolean;
  to?: string;
  className?: string;
  markClassName?: string;
  textClassName?: string;
}

/**
 * Pure SVG vector mark for Flux.
 * Embodies the concept of calm, continuous chronological flow:
 * An organic squircle containing undulating river current waves that
 * harmonize into an iconic 'F' monogram with a water droplet accent.
 */
export function FluxMark({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <div
      className={`relative inline-flex items-center justify-center flex-shrink-0 select-none ${className}`}
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_1px_2px_rgba(13,83,14,0.18)]"
        aria-hidden="true"
      >
        <defs>
          {/* Deep forest gradient background */}
          <linearGradient id="flux-bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0E5B10" />
            <stop offset="50%" stopColor="#0D530E" />
            <stop offset="100%" stopColor="#083809" />
          </linearGradient>

          {/* Luminous warm cream-to-sand stroke gradient */}
          <linearGradient id="flux-flow-cream" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="55%" stopColor="#FBF5DD" />
            <stop offset="100%" stopColor="#E7E1B1" />
          </linearGradient>

          {/* Golden sand tone for lower ripple stream */}
          <linearGradient id="flux-flow-sand" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#E7E1B1" />
            <stop offset="100%" stopColor="#CFC68B" />
          </linearGradient>
        </defs>

        {/* Squircle container with soft rounded corners */}
        <rect width="32" height="32" rx="8.5" fill="url(#flux-bg-grad)" />

        {/* Subtle high-craft inner perimeter border */}
        <rect
          x="0.75"
          y="0.75"
          width="30.5"
          height="30.5"
          rx="7.75"
          stroke="#FFFFFF"
          strokeOpacity="0.14"
          strokeWidth="0.8"
          fill="none"
        />

        {/* Primary flow: Anchor stem curving into upper organic wave */}
        <path
          d="M 9.5 24 V 12.5 C 9.5 9 12 7.2 15.5 7.2 C 17.8 7.2 20.2 8 22.8 7.4"
          stroke="url(#flux-flow-cream)"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Secondary flow: Harmonic mid-current crossbar */}
        <path
          d="M 9.5 15.5 C 12.5 15.5 15.2 16.2 18.8 15.6"
          stroke="url(#flux-flow-cream)"
          strokeWidth="2.75"
          strokeLinecap="round"
        />

        {/* Tertiary flow: Lower river ripple creating harmonic rhythm */}
        <path
          d="M 14.2 22.2 C 16.6 22.2 18.6 22.8 21.6 22.2"
          stroke="url(#flux-flow-sand)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeOpacity="0.9"
        />

        {/* Thought ripple / droplet accent */}
        <circle
          cx="22.6"
          cy="15.5"
          r="1.3"
          fill="#E7E1B1"
          opacity="0.95"
        />
      </svg>
    </div>
  );
}

/**
 * Main Flux Brand Logo (Emblem + Editorial Fraunces Wordmark).
 */
export default function FluxLogo({
  size = "md",
  showWordmark = true,
  to = "/",
  className = "",
  markClassName = "",
  textClassName = "",
}: FluxLogoProps) {
  const sizeConfig = {
    sm: {
      mark: "w-7 h-7",
      text: "text-lg tracking-tight",
      gap: "gap-2",
    },
    md: {
      mark: "w-8.5 h-8.5",
      text: "text-[1.35rem] tracking-tight",
      gap: "gap-2.5",
    },
    lg: {
      mark: "w-11 h-11",
      text: "text-2xl tracking-tight",
      gap: "gap-3",
    },
    xl: {
      mark: "w-14 h-14",
      text: "text-3xl tracking-tight",
      gap: "gap-3.5",
    },
  }[size];

  const content = (
    <div
      className={`inline-flex items-center ${sizeConfig.gap} flex-shrink-0 group transition-opacity hover:opacity-90 ${className}`}
    >
      <div
        className={`transition-transform duration-200 ease-out group-hover:scale-[1.04] ${sizeConfig.mark} ${markClassName}`}
      >
        <FluxMark className="w-full h-full" />
      </div>

      {showWordmark && (
        <span
          className={`font-heading font-bold text-forest select-none transition-colors group-hover:text-green ${sizeConfig.text} ${textClassName}`}
        >
          Flux
        </span>
      )}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="inline-flex flex-shrink-0" aria-label="Flux Home">
        {content}
      </Link>
    );
  }

  return content;
}
