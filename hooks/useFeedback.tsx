"use client";

import {
  type CSSProperties,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Check } from "lucide-react";
import { useReducedMotion } from "@/hooks/useMediaQuery";

interface Feedback {
  toast: (text: string) => void;
  burst: (el: Element | null, count?: number) => void;
}

const FeedbackContext = createContext<Feedback | null>(null);

/** `toast(message)` and `burst(element, count)` — the page's two bits of celebration. */
export const useFeedback = () => {
  const feedback = useContext(FeedbackContext);
  if (!feedback)
    throw new Error("useFeedback must be used inside <FeedbackProvider>");
  return feedback;
};

const CONFETTI_COLORS = ["#E11D2E", "#FF7A1A", "#FFB020", "#FFD6DA", "#16161A"];

type ConfettiPiece = CSSProperties & {
  id: number;
  "--cf-x": string;
  "--cf-y": string;
  "--cf-r": string;
};

let pieceId = 0;

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const [showing, setShowing] = useState(false);
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reduce = useReducedMotion();

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  const toast = useCallback((text: string) => {
    setMessage(text);
    setShowing(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowing(false), 2200);
  }, []);

  const burst = useCallback(
    (el: Element | null, count = 70) => {
      if (reduce || !el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const batch = Array.from({ length: count }, (_, i): ConfettiPiece => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 120 + Math.random() * 260;
        return {
          id: pieceId++,
          left: cx,
          top: cy,
          background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          "--cf-x": Math.cos(angle) * dist + "px",
          "--cf-y":
            Math.sin(angle) * dist * 0.6 + 160 + Math.random() * 120 + "px",
          "--cf-r": Math.random() * 720 - 360 + "deg",
          animationDelay: Math.random() * 0.08 + "s",
        };
      });
      setPieces((prev) => prev.concat(batch));
      const ids = new Set(batch.map((p) => p.id));
      setTimeout(
        () => setPieces((prev) => prev.filter((p) => !ids.has(p.id))),
        1600,
      );
    },
    [reduce],
  );

  return (
    <FeedbackContext.Provider value={{ toast, burst }}>
      {children}

      <div
        role="status"
        className={`fixed bottom-6 left-1/2 z-80 flex max-w-[calc(100vw-32px)] items-center gap-2 rounded-full bg-ink px-4.5 py-3 text-sm text-white transition-all duration-350 pointer-events-none ${
          showing
            ? "translate-x-[-50%] translate-y-0 opacity-100"
            : "translate-x-[-50%] translate-y-5 opacity-0"
        }`}
      >
        <Check size={16} strokeWidth={1.9} />
        <span>{message}</span>
      </div>

      {pieces.map(({ id, ...style }) => (
        <span
          key={id}
          aria-hidden="true"
          style={style}
          className="animate-confetti pointer-events-none fixed z-90 h-3.5 w-2.25 rounded-xs"
        />
      ))}
    </FeedbackContext.Provider>
  );
}
