"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Loader2, XCircle } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Button } from "@/components/ui/Button";
import { trackEvent } from "@/lib/analytics";

gsap.registerPlugin(useGSAP);

interface PaymentFailedScreenProps {
  orderId?: string;
  reason?: string;
}

interface RetryResponse {
  order_id?: string;
  payment_link?: string;
  error?: string;
}

export function PaymentFailedScreen({ orderId, reason }: PaymentFailedScreenProps) {
  const iconRef = useRef<SVGSVGElement>(null);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState("");

  useGSAP(
    () => {
      if (!iconRef.current) {
        return;
      }

      gsap.from(iconRef.current, {
        scale: 0,
        opacity: 0,
        duration: 0.4,
        ease: "back.out(1.5)",
      });
    },
    { scope: iconRef }
  );

  const retry = async () => {
    if (!orderId) {
      setError("Order not found.");
      return;
    }

    setRetrying(true);
    setError("");

    try {
      const response = await fetch(`/api/checkout/retry?order=${orderId}`);
      const data = (await response.json()) as RetryResponse;

      if (!response.ok || !data.payment_link) {
        throw new Error(data.error || "Payment couldn't start - try again.");
      }

      trackEvent("checkout.payment_retried", { order_id: orderId });
      window.location.assign(data.payment_link);
    } catch (retryError) {
      setError(
        retryError instanceof Error
          ? retryError.message
          : "Payment couldn't start - try again."
      );
    } finally {
      setRetrying(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-white px-4">
      <div className="max-w-sm text-center">
        <XCircle ref={iconRef} className="mx-auto h-16 w-16 text-brand" />
        <h1 className="mt-6 text-2xl font-bold text-ink">
          Payment did not go through
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          {reason || "Your payment was not completed. You can try again safely."}
        </p>

        {error ? (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            {error}
          </p>
        ) : null}

        <Button
          type="button"
          fullWidth
          className="mt-6"
          disabled={retrying || !orderId}
          onClick={() => void retry()}
        >
          {retrying ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Retrying...
            </>
          ) : (
            "Try again"
          )}
        </Button>
        <Link
          href="/contact-us"
          className="mt-5 inline-block text-sm font-medium text-muted hover:text-brand"
        >
          Contact support
        </Link>
      </div>
    </main>
  );
}
