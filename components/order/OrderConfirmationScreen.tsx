"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Gift } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { buttonVariants } from "@/components/ui/Button";
import { formatPrice, cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

export interface ConfirmedOrderItem {
  id: string;
  product_title: string;
  product_image_url: string | null;
  quantity: number;
  unit_price: number;
}

export interface ConfirmedOrder {
  id: string;
  total_amount: number;
  created_at?: string | null;
  shipping_name?: string | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
  order_items: ConfirmedOrderItem[];
}

interface OrderConfirmationScreenProps {
  order: ConfirmedOrder;
}

export function OrderConfirmationScreen({ order }: OrderConfirmationScreenProps) {
  const iconRef = useRef<SVGSVGElement>(null);

  useGSAP(
    () => {
      if (!iconRef.current) {
        return;
      }

      gsap.from(iconRef.current, {
        scale: 0,
        duration: 0.5,
        ease: "back.out(2)",
      });
    },
    { scope: iconRef }
  );

  return (
    <section className="bg-surface py-10">
      <div className="mx-auto max-w-3xl px-4 md:px-6">
        <div className="rounded-2xl border border-stone-100 bg-white p-6 text-center shadow-sm md:p-8">
          <CheckCircle2 ref={iconRef} className="mx-auto h-16 w-16 text-brand" />
          <h1 className="mt-6 text-3xl font-bold text-ink">Order confirmed</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
            Payment received. Gifvtme will review your order and coordinate
            fulfillment with the supplier.
          </p>
          <p className="mt-5 text-sm font-semibold text-brand">
            Order #{order.id.slice(0, 8)}
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-stone-100 pb-4">
            <h2 className="text-lg font-semibold text-ink">Order Summary</h2>
            <p className="text-xl font-bold text-brand">
              {formatPrice(order.total_amount)}
            </p>
          </div>

          <div className="divide-y divide-stone-100">
            {order.order_items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-4">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface">
                  {item.product_image_url ? (
                    <Image
                      src={item.product_image_url}
                      alt=""
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Gift className="h-6 w-6 text-stone-300" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {item.product_title}
                  </p>
                  <p className="mt-1 text-xs text-muted">Qty {item.quantity}</p>
                </div>
                <p className="text-sm font-semibold text-ink">
                  {formatPrice(item.unit_price * item.quantity)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/shop" className={cn(buttonVariants(), "flex-1")}>
            Continue shopping
          </Link>
          <Link
            href="/account"
            className={cn(buttonVariants({ variant: "ghost" }), "flex-1")}
          >
            Check my orders
          </Link>
        </div>
      </div>
    </section>
  );
}
