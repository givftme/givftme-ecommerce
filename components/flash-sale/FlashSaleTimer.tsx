"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

interface FlashSaleTimerProps {
  endTime: string;
  onComplete?: () => void;
  className?: string;
  /** Disable the built-in amber/red urgency coloring — for callers already
   * placing the timer on a brand-red background (FlashSaleBanner,
   * FlashSaleNavbarStrip), where red-on-red would be invisible. */
  disableUrgencyColor?: boolean;
}

function getRemainingSeconds(endTime: string) {
  return Math.max(0, Math.floor((new Date(endTime).getTime() - Date.now()) / 1000));
}

// Flash-sale-specific countdown formatting: drops the hours segment under
// an hour, unlike the shared formatCountdown() in lib/utils.ts (also used
// by VerifyOtpScreen's OTP resend countdown, which must keep its own
// fixed HH:MM:SS shape).
function formatFlashSaleCountdown(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  const paddedSeconds = seconds.toString().padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${paddedSeconds}`;
  }

  return `${minutes}:${paddedSeconds}`;
}

export function FlashSaleTimer({
  endTime,
  onComplete,
  className,
  disableUrgencyColor,
}: FlashSaleTimerProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    getRemainingSeconds(endTime)
  );
  const timerRef = useRef<HTMLSpanElement>(null);
  const hasCompletedRef = useRef(false);
  const isUrgent = remainingSeconds > 0 && remainingSeconds <= 60;
  const isWarning = remainingSeconds > 60 && remainingSeconds < 3600;

  useEffect(() => {
    hasCompletedRef.current = false;

    const tick = () => setRemainingSeconds(getRemainingSeconds(endTime));
    const timeoutId = window.setTimeout(tick, 0);
    const interval = window.setInterval(() => {
      tick();
    }, 1000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(interval);
    };
  }, [endTime]);

  useEffect(() => {
    if (remainingSeconds === 0 && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      onComplete?.();
    }
  }, [onComplete, remainingSeconds]);

  useGSAP(
    () => {
      if (!timerRef.current || !isUrgent) {
        return;
      }

      gsap.to(timerRef.current, {
        scale: 1.05,
        duration: 0.5,
        yoyo: true,
        repeat: -1,
        ease: "power1.out",
      });
    },
    { dependencies: [isUrgent], scope: timerRef }
  );

  const label = useMemo(
    () => formatFlashSaleCountdown(remainingSeconds),
    [remainingSeconds]
  );

  return (
    <span
      ref={timerRef}
      className={cn(
        !disableUrgencyColor &&
          (isUrgent ? "text-red-600" : isWarning ? "text-amber-600" : undefined),
        className
      )}
    >
      {label}
    </span>
  );
}
