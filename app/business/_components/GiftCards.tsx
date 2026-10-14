"use client";

import { useState } from "react";
import {
  type LucideIcon,
  CreditCard,
  Mail,
  MessageCircle,
  Minus,
  Plus,
  Printer,
  QrCode,
  Send,
} from "lucide-react";
import { Eyebrow, Icon, Reveal, Wrap, cx } from "@/components/ui/primitives";
import { formatPrice } from "@/lib/utils";
import { BriefLink } from "@/app/business/_components/BriefLink";
import { useBusiness } from "@/app/business/_components/BusinessContext";
import { GIFT_CARD_MAX_QUANTITY, GIFT_CARD_VALUES } from "@/app/business/_components/content";
import { inkFor, shade } from "@/app/business/_components/color";
import { LogoMark } from "@/app/business/_components/LogoMark";

type Channel = "email" | "whatsapp" | "printed";

const CHANNELS: { value: Channel; label: string; icon: LucideIcon }[] = [
  { value: "email", label: "Email", icon: Mail },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "printed", label: "Printed card", icon: Printer },
];

const STEP = 5;

const clampQuantity = (n: number) => Math.max(1, Math.min(GIFT_CARD_MAX_QUANTITY, n));

const shortNaira = (value: number) => `₦${value / 1000}k`;

const fieldClass = "flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted";

export function GiftCards() {
  const { displayName, brandColor, giftCardValue, setGiftCardValue } = useBusiness();
  // Kept as typed text so the field can be cleared mid-edit; totals use the clamped count.
  const [quantityText, setQuantityText] = useState("50");
  const [flipped, setFlipped] = useState(false);
  const [channels, setChannels] = useState<Record<Channel, boolean>>({
    email: true,
    whatsapp: true,
    printed: false,
  });

  const quantity = clampQuantity(parseInt(quantityText, 10) || 1);
  const step = (delta: number) =>
    setQuantityText(String(clampQuantity((parseInt(quantityText, 10) || 0) + delta)));

  const faceInk = inkFor(shade(brandColor, -0.17));

  return (
    <section id="giftcards" aria-labelledby="giftcards-heading" className="py-24 max-sm:py-16">
      <Wrap className="grid grid-cols-2 items-center gap-14 max-lg:grid-cols-1">
        <Reveal className="flex justify-center perspective-[1200px]">
          <button
            type="button"
            aria-label={flipped ? "Show the front of the gift card" : "Show how to redeem the gift card"}
            onClick={() => setFlipped(!flipped)}
            className={cx(
              "relative aspect-[1.6] w-full max-w-105 cursor-pointer text-left transition-transform duration-800 ease-[cubic-bezier(0.2,0.8,0.2,1)] transform-3d",
              flipped && "rotate-y-180",
            )}
          >
            <span
              style={{
                background: `linear-gradient(135deg, ${brandColor}, ${shade(brandColor, -0.35)})`,
                color: faceInk,
              }}
              className="absolute inset-0 flex flex-col justify-between overflow-hidden rounded-3xl p-6 shadow-float backface-hidden"
            >
              <span
                aria-hidden="true"
                className="absolute -top-22.5 -right-20 size-65 rounded-full border-40 border-white/8"
              />
              <span className="relative flex items-start justify-between gap-3">
                <span className="max-w-[70%] font-display text-2xl leading-[1.1] wrap-anywhere">
                  {displayName}
                </span>
                <span className="text-[11px] tracking-[0.08em] opacity-85">GIFT CARD</span>
              </span>
              <span className="relative flex items-end justify-between gap-3">
                <span className="font-display text-[clamp(34px,6vw,46px)] leading-none">
                  {formatPrice(giftCardValue)}
                </span>
                <LogoMark height={18} className="shrink-0" />
              </span>
            </span>

            <span className="absolute inset-0 flex rotate-y-180 flex-col justify-between overflow-hidden rounded-3xl border border-line bg-card p-6 text-foreground shadow-float backface-hidden">
              <span className="flex items-start justify-between gap-3">
                <LogoMark height={18} />
                <Icon as={QrCode} size={26} />
              </span>
              <span className="text-[13px] leading-[1.6] text-muted">
                <b className="font-semibold text-foreground">How to redeem</b>
                <br />
                1. Open the link we send by email or WhatsApp
                <br />
                2. Pick from the Givftme store or your wishlist
                <br />
                3. We deliver it, wrapped
              </span>
              <span className="flex justify-between gap-3 text-xs text-muted">
                <span>Code: GVT-XXXX-XXXX</span>
                <span>Tap to flip</span>
              </span>
            </span>
          </button>
        </Reveal>

        <Reveal delay={0.1} className="flex min-w-0 flex-col gap-4.5">
          <Eyebrow tone="brand">
            <Icon as={CreditCard} size={16} />
            Corporate gift cards
          </Eyebrow>
          <h2 id="giftcards-heading" className="font-display text-[clamp(32px,4.2vw,52px)] leading-[1.08]">
            Let them choose. Keep your brand on it.
          </h2>
          <p className="max-w-[30em] text-base text-muted">
            Send branded gift cards to one person or the whole company. They redeem on Givftme.
          </p>

          <div className="flex flex-col gap-3.5">
            <div className={fieldClass}>
              <span id="gc-value">Value per card</span>
              <div
                role="group"
                aria-labelledby="gc-value"
                className="grid grid-cols-4 gap-2 max-sm:grid-cols-2"
              >
                {GIFT_CARD_VALUES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={giftCardValue === value}
                    onClick={() => setGiftCardValue(value)}
                    className={cx(
                      "h-11 rounded-[14px] border-[1.5px] text-[13.5px] font-medium",
                      giftCardValue === value
                        ? "border-brand bg-brand-light text-brand"
                        : "border-line bg-card text-foreground",
                    )}
                  >
                    {shortNaira(value)}
                  </button>
                ))}
              </div>
            </div>

            <div className={fieldClass}>
              <label htmlFor="gc-quantity">Number of staff</label>
              <div className="flex h-11.5 items-center overflow-hidden rounded-[14px] border-[1.5px] border-line bg-card">
                <button
                  type="button"
                  aria-label="Fewer"
                  onClick={() => step(-STEP)}
                  className="grid h-full w-11.5 place-items-center bg-soft text-foreground"
                >
                  <Icon as={Minus} size={16} />
                </button>
                <input
                  id="gc-quantity"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={GIFT_CARD_MAX_QUANTITY}
                  value={quantityText}
                  onChange={(e) => setQuantityText(e.target.value)}
                  onBlur={() => setQuantityText(String(quantity))}
                  className="h-full min-w-0 flex-1 bg-transparent text-center text-[15px] font-semibold text-foreground outline-none"
                />
                <button
                  type="button"
                  aria-label="More"
                  onClick={() => step(STEP)}
                  className="grid h-full w-11.5 place-items-center bg-soft text-foreground"
                >
                  <Icon as={Plus} size={16} />
                </button>
              </div>
            </div>

            <div className={fieldClass}>
              <span id="gc-send">Send by</span>
              <div role="group" aria-labelledby="gc-send" className="flex flex-wrap gap-2">
                {CHANNELS.map(({ value, label, icon }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={channels[value]}
                    onClick={() => setChannels((c) => ({ ...c, [value]: !c[value] }))}
                    className={cx(
                      "inline-flex h-9.5 items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-[13px] font-medium",
                      channels[value]
                        ? "border-ink-deep bg-ink-deep text-white"
                        : "border-line bg-card text-foreground",
                    )}
                  >
                    <Icon as={icon} size={16} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div
              aria-live="polite"
              className="flex items-center justify-between gap-3 rounded-[18px] bg-ink-deep px-4.5 py-4 text-white"
            >
              <span>Card value total</span>
              <b className="text-2xl font-semibold tabular-nums">
                {formatPrice(giftCardValue * quantity)}
              </b>
            </div>

            <BriefLink
              brief={{
                occasions: ["Gift cards"],
                note: `Gift cards: ${quantity} × ${formatPrice(giftCardValue)}. `,
              }}
            >
              <Icon as={Send} size={16} />
              Order gift cards
            </BriefLink>
          </div>
        </Reveal>
      </Wrap>
    </section>
  );
}
