"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

// The business dashboard's own toast (spec "Toast notifications"): fixed
// bottom-centre, one at a time, 2.6 seconds. A new message replaces the
// current one instead of stacking.

const TOAST_MS = 2600;

const ToastContext = createContext<((message: string) => void) | null>(null);

export function Toast({ message }: { message: string | null }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[80] flex justify-center px-4"
    >
      {message ? (
        <p
          key={message}
          className="max-w-md rounded-full bg-ink px-5 py-3 text-center text-sm font-medium text-background shadow-float transition-[opacity,translate] duration-200 starting:translate-y-2 starting:opacity-0 motion-reduce:transition-none"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const show = useCallback((next: string) => {
    if (timer.current) window.clearTimeout(timer.current);
    setMessage(next);
    timer.current = window.setTimeout(() => setMessage(null), TOAST_MS);
  }, []);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast message={message} />
    </ToastContext.Provider>
  );
}

/** Shows a business dashboard toast. */
export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast must be used within the business dashboard ToastProvider");
  return show;
}
