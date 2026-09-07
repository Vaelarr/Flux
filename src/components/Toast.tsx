import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { CheckCircle2, ShieldCheck, X, Sparkles } from "lucide-react";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  title: string;
  message?: string;
  type?: "notice-green" | "success" | "security";
  icon?: React.ReactNode;
  duration?: number;
  action?: ToastAction;
}

export type ToastOptions = Omit<ToastItem, "id">;

interface ToastContextValue {
  showToast: (options: ToastOptions | string) => string;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
  toasts: ToastItem[];
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Global event bus fallback so toast can be triggered anywhere
type ToastListener = (toast: ToastOptions) => void;
const listeners = new Set<ToastListener>();

export const toast = {
  success: (title: string, message?: string, options?: Partial<ToastOptions>) => {
    const payload: ToastOptions = {
      title,
      message,
      type: "notice-green",
      duration: 4500,
      ...options,
    };
    listeners.forEach((listener) => listener(payload));
  },
  security: (title: string, message?: string, options?: Partial<ToastOptions>) => {
    const payload: ToastOptions = {
      title,
      message,
      type: "security",
      duration: 5000,
      ...options,
    };
    listeners.forEach((listener) => listener(payload));
  },
};

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

/**
 * Single Toast Item presentation component styled with 'notice-green'
 */
export interface ToastProps {
  id?: string;
  title: string;
  message?: string;
  type?: "notice-green" | "success" | "security";
  icon?: React.ReactNode;
  duration?: number;
  action?: ToastAction;
  onClose?: () => void;
  className?: string;
}

export function Toast({
  title,
  message,
  type = "notice-green",
  icon,
  duration = 4500,
  action,
  onClose,
  className = "",
}: ToastProps) {
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(100);
  const startTimeRef = useRef<number>(Date.now());
  const remainingRef = useRef<number>(duration);

  useEffect(() => {
    if (!duration || duration <= 0 || !onClose) return;

    let animFrame: number;
    startTimeRef.current = Date.now();

    const tick = () => {
      if (!paused) {
        const elapsed = Date.now() - startTimeRef.current;
        const remaining = Math.max(0, remainingRef.current - elapsed);
        const percent = (remaining / duration) * 100;
        setProgress(percent);

        if (remaining <= 0) {
          onClose();
          return;
        }
      }
      animFrame = requestAnimationFrame(tick);
    };

    animFrame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [duration, onClose, paused]);

  const handleMouseEnter = () => {
    setPaused(true);
    const elapsed = Date.now() - startTimeRef.current;
    remainingRef.current = Math.max(0, remainingRef.current - elapsed);
  };

  const handleMouseLeave = () => {
    startTimeRef.current = Date.now();
    setPaused(false);
  };

  // Render proper icon based on toast intent
  const defaultIcon =
    type === "security" ? (
      <ShieldCheck className="w-5 h-5 text-forest flex-shrink-0" />
    ) : (
      <CheckCircle2 className="w-5 h-5 text-forest flex-shrink-0 stroke-[2.2]" />
    );

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`notice notice-green animate-toast-in relative overflow-hidden shadow-[0_10px_25px_rgba(48,109,41,0.12)] border border-[rgba(48,109,41,0.24)] bg-[#F8FAF7]/98 backdrop-blur-md rounded-xl p-4 flex items-start gap-3 w-full pointer-events-auto transition-all ${className}`}
    >
      {/* Icon */}
      <div className="pt-0.5">{icon || defaultIcon}</div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-1">
        <h4 className="font-heading font-bold text-sm text-forest tracking-tight leading-snug">
          {title}
        </h4>
        {message && (
          <p className="text-xs text-forest/80 mt-0.5 leading-relaxed font-normal">
            {message}
          </p>
        )}
        {action && (
          <div className="mt-2.5">
            <button
              type="button"
              onClick={() => {
                action.onClick();
                onClose?.();
              }}
              className="text-xs font-semibold text-forest underline underline-offset-3 hover:opacity-85 transition-opacity"
            >
              {action.label} →
            </button>
          </div>
        )}
      </div>

      {/* Close button */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close notification"
          className="text-forest/60 hover:text-forest p-1 rounded-md hover:bg-forest/10 transition-colors flex-shrink-0 -mr-1 -mt-1"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Progress countdown indicator bar */}
      {duration > 0 && onClose && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-forest/15 overflow-hidden">
          <div
            className="h-full bg-forest/70 transition-all duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Toast Container for rendering the stack of active toasts
 */
export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="fixed top-4 right-4 sm:top-6 sm:right-6 z-50 flex flex-col gap-2.5 max-w-sm w-[calc(100vw-2rem)] pointer-events-none"
    >
      {toasts.map((item) => (
        <Toast
          key={item.id}
          id={item.id}
          title={item.title}
          message={item.message}
          type={item.type}
          icon={item.icon}
          duration={item.duration}
          action={item.action}
          onClose={() => onDismiss(item.id)}
        />
      ))}
    </div>
  );
}

/**
 * ToastProvider to manage toast state across routes and components
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const showToast = useCallback(
    (options: ToastOptions | string): string => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const normalized: ToastItem =
        typeof options === "string"
          ? {
              id,
              title: options,
              type: "notice-green",
              duration: 4500,
            }
          : {
              ...options,
              id,
              type: options.type || "notice-green",
              duration: options.duration !== undefined ? options.duration : 4500,
            };

      setToasts((prev) => [...prev, normalized]);
      return id;
    },
    []
  );

  // Subscribe to external helper calls (toast.success / toast.security)
  useEffect(() => {
    const handleExternalToast: ToastListener = (toastOpts) => {
      showToast(toastOpts);
    };
    listeners.add(handleExternalToast);
    return () => {
      listeners.delete(handleExternalToast);
    };
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast, clearToasts, toasts }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export default Toast;
