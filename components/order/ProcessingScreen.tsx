"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { buttonVariants } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

interface ProcessingScreenProps {
  orderId?: string;
}

interface OrderStatusRow {
  status: string;
  total_amount?: number | null;
}

export function ProcessingScreen({ orderId }: ProcessingScreenProps) {
  const router = useRouter();
  const ringRef = useRef<HTMLDivElement>(null);
  const [timedOut, setTimedOut] = useState(false);

  useGSAP(
    () => {
      if (!ringRef.current) {
        return;
      }

      gsap.to(ringRef.current, {
        rotation: 360,
        duration: 1,
        ease: "none",
        repeat: -1,
      });
    },
    { scope: ringRef }
  );

  useEffect(() => {
    if (!orderId) {
      return;
    }

    const supabase = createClient();
    const interval = window.setInterval(async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("status, total_amount")
        .eq("id", orderId)
        .maybeSingle();
      if (error) {
        console.error("Order status poll failed.", error);
        return;
      }

      const order = data as OrderStatusRow | null;

      if (order?.status === "confirmed") {
        window.clearInterval(interval);
        trackEvent("checkout.payment_succeeded", {
          order_id: orderId,
          total_value: order.total_amount ?? null,
        });
        router.push(`/account/orders/${orderId}`);
      }

      if (order?.status === "payment_failed") {
        window.clearInterval(interval);
        trackEvent("checkout.payment_failed", {
          order_id: orderId,
          reason: "payment_failed",
        });
        router.push(`/checkout/failed?order=${orderId}`);
      }
    }, 2000);

    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
      setTimedOut(true);
    }, 180000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [orderId, router]);

  if (!orderId) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-white px-4">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-bold text-ink">Order not found</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            We could not find an order to process.
          </p>
          <Link href="/account" className={cn(buttonVariants(), "mt-6")}>
            Check my orders
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-white px-4">
      <div className="max-w-sm text-center">
        <div
          ref={ringRef}
          className="mx-auto h-20 w-20 rounded-full border-4 border-brand-light border-t-brand"
        />
        <h1 className="mt-8 text-2xl font-bold text-ink">
          {timedOut ? "Taking longer than expected" : "Processing your payment..."}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          {timedOut
            ? "Your payment may still be confirming in the background."
            : "Please don't close this tab"}
        </p>
        {timedOut ? (
          <Link href="/account" className={cn(buttonVariants(), "mt-6")}>
            Check my orders
          </Link>
        ) : null}
      </div>
    </main>
  );
}
