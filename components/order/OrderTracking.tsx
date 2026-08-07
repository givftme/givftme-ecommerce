"use client";

import { Fragment, useRef } from "react";
import { Check } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { cn } from "@/lib/utils";
import { trackerStepOf, type OrderStatus, type TrackerStep } from "@/lib/orders/types";

gsap.registerPlugin(useGSAP);

const STEPS: { id: TrackerStep; label: string }[] = [
  { id: "placed", label: "Order Placed" },
  { id: "processing", label: "Processing" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered" },
];

export function OrderTracking({ status }: { status: OrderStatus }) {
  const currentStep = trackerStepOf(status);
  const currentRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!currentRef.current) return;

      const tween = gsap.to(currentRef.current, {
        opacity: 0.35,
        duration: 0.9,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });

      return () => {
        tween.kill();
      };
    },
    { scope: currentRef, dependencies: [currentStep] },
  );

  if (!currentStep) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-600">
        {status === "refunded" ? "Refunded" : "Cancelled"}
      </div>
    );
  }

  const currentIndex = STEPS.findIndex((step) => step.id === currentStep);

  return (
    <div className="flex items-start">
      {STEPS.map((step, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <Fragment key={step.id}>
            <div className="flex w-16 shrink-0 flex-col items-center gap-2 sm:w-24">
              <div
                ref={isCurrent ? currentRef : undefined}
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold",
                  isComplete && "border-brand bg-brand text-white",
                  isCurrent && "border-brand bg-white text-brand",
                  !isComplete && !isCurrent && "border-stone-200 bg-white text-stone-300",
                )}
              >
                {isComplete ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  "text-center text-xs font-medium leading-4",
                  isComplete || isCurrent ? "text-ink" : "text-stone-300",
                )}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  "mt-4.5 h-0.5 flex-1",
                  index < currentIndex ? "bg-brand" : "bg-stone-200",
                )}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
