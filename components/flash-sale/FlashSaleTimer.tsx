"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { formatCountdown } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

interface FlashSaleTimerProps {
  endTime: string;
  onComplete?: () => void;
  className?: string;
}

function getRemainingSeconds(endTime: string) {
  return Math.max(0, Math.floor((new Date(endTime).getTime() - Date.now()) / 1000));
}

export function FlashSaleTimer({
  endTime,
  onComplete,
  className,
}: FlashSaleTimerProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    getRemainingSeconds(endTime)
  );
  const timerRef = useRef<HTMLSpanElement>(null);
  const hasCompletedRef = useRef(false);
  const isUrgent = remainingSeconds > 0 && remainingSeconds <= 60;

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
    () => formatCountdown(remainingSeconds),
    [remainingSeconds]
  );

  return (
    <span ref={timerRef} className={className}>
      {label}
    </span>
  );
}
