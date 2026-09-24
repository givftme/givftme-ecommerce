"use client";

import { useState } from "react";
import {
  type LucideIcon,
  CreditCard,
  Gift,
  Globe,
  MapPin,
} from "lucide-react";
import { Eyebrow, Icon, Reveal, cx } from "@/components/ui/primitives";

const CURRENCIES = [
  {
    code: "gbp",
    symbol: "£",
    name: "pounds",
    paid: "Paid in pounds",
    city: "From Manchester",
  },
  {
    code: "usd",
    symbol: "$",
    name: "dollars",
    paid: "Paid in dollars",
    city: "From Houston",
  },
  {
    code: "ngn",
    symbol: "₦",
    name: "naira",
    paid: "Paid in naira",
    city: "From Abuja",
  },
] as const;

type CurrencyCode = (typeof CURRENCIES)[number]["code"];

function RouteRow({
  icon,
  iconClass,
  title,
  sub,
}: {
  icon: LucideIcon;
  iconClass: string;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cx(
          "grid size-10 shrink-0 place-items-center rounded-xl",
          iconClass,
        )}
      >
        <Icon as={icon} />
      </span>
      <div className="min-w-0">
        <b className="block text-sm font-semibold">{title}</b>
        <span className="text-[12.5px] text-muted">{sub}</span>
      </div>
    </div>
  );
}

const DashLine = () => (
  <div
    aria-hidden="true"
    className="my-1 ml-[19px] h-[22px] w-0.5 bg-[repeating-linear-gradient(var(--color-line)_0_4px,transparent_4px_8px)]"
  />
);

/** Pay where you are, deliver to Lagos. */
export function DiasporaCard() {
  const [currency, setCurrency] = useState<CurrencyCode>("gbp");
  const active = CURRENCIES.find((c) => c.code === currency) ?? CURRENCIES[0];

  return (
    <Reveal className="relative mt-[72px] grid grid-cols-2 items-center gap-10 overflow-hidden rounded-card-xl bg-[linear-gradient(120deg,var(--color-red),var(--color-orange))] p-12 text-white max-lg:grid-cols-1 max-sm:mt-12 max-sm:px-5 max-sm:py-7 before:absolute before:-right-[100px] before:-bottom-[160px] before:size-[360px] before:rounded-full before:border-[60px] before:border-white/8 before:content-['']">
      <div className="relative z-1 flex min-w-0 flex-col gap-4">
        <Eyebrow className="text-white">
          <Icon as={Globe} size={16} />
          Far from home?
        </Eyebrow>
        <h3 className="text-[clamp(30px,3.6vw,46px)]">
          Pay where you are. Deliver to Lagos.
        </h3>
        <p className="opacity-92">
          Choose, write the note, pay in your currency. See her open it.
        </p>
        <div
          role="group"
          aria-label="Pay in"
          className="inline-flex gap-0.5 self-start rounded-full bg-white/18 p-1"
        >
          {CURRENCIES.map(({ code, symbol, name }) => (
            <button
              key={code}
              type="button"
              // The visible label is a bare symbol, so name the currency too.
              aria-label={`Pay in ${name}`}
              aria-pressed={currency === code}
              onClick={() => setCurrency(code)}
              className={cx(
                "h-[38px] min-w-[54px] cursor-pointer rounded-full border-0 px-3.5 text-sm font-semibold transition-colors motion-reduce:transition-none",
                currency === code
                  ? "bg-white text-red"
                  : "bg-transparent text-white hover:bg-white/15",
              )}
            >
              {symbol}
            </button>
          ))}
        </div>
      </div>

      <div
        // The first row restates the choice made above, so announce the swap.
        aria-live="polite"
        className="relative z-1 flex flex-col rounded-card-lg bg-white p-[22px] text-ink"
      >
        <RouteRow
          icon={CreditCard}
          iconClass="bg-blue-50 text-blue"
          title={active.paid}
          sub={active.city}
        />
        <DashLine />
        <RouteRow
          icon={Gift}
          iconClass="bg-peach text-orange"
          title="Wrapped with your note"
          sub="Packed in Lagos"
        />
        <DashLine />
        <RouteRow
          icon={MapPin}
          iconClass="bg-green-50 text-green"
          title="Delivered to Mum"
          sub="Surulere, Lagos · photo sent"
        />
      </div>
    </Reveal>
  );
}
