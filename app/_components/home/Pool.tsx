"use client";

import { useRef, useState } from "react";
import { HandHeart, Heart, Users } from "lucide-react";
import {
  Btn,
  Eyebrow,
  Icon,
  Reveal,
  SmartImage,
  Wrap,
  cx,
} from "@/components/ui/primitives";
import { useInView } from "@/hooks/useInView";
import { formatPrice } from "@/lib/utils";
import { useFeedback } from "@/hooks/useFeedback";

const TARGET = 180000;
const START = 120000;

const AMOUNTS = [5000, 10000, 20000] as const;

interface Giver {
  initials?: string;
  style?: string;
  quiet?: boolean;
}

const SEED_GIVERS: Giver[] = [
  { initials: "KA", style: "bg-brand-light text-brand" },
  { initials: "BO", style: "bg-peach text-orange-800" },
  { initials: "NE", style: "bg-blue-50 text-blue" },
  { initials: "FE", style: "bg-green-50 text-green" },
  { quiet: true },
];

const NEW_NAMES = ["IK", "SO", "DA", "TO", "CH", "YE"];
const NEW_PALETTE = [
  "bg-brand-light text-brand",
  "bg-peach text-orange-800",
  "bg-green-50 text-green",
  "bg-blue-50 text-blue",
];

const STEPS = [
  "Pick a gift, set a target",
  "Drop the link in the group chat",
  "Everyone finds out together",
];

export default function Pool() {
  const [raised, setRaised] = useState(START);
  const [amount, setAmount] = useState<number | "rest">(20000);
  const [givers, setGivers] = useState(SEED_GIVERS);
  const [quiet, setQuiet] = useState(false);
  const nameIndex = useRef(0);
  const { toast } = useFeedback();

  // The meter fills from zero the first time the card is seen, not on load.
  const [seenRef, seen] = useInView<HTMLDivElement>({
    threshold: 0.3,
    rootMargin: "0px",
  });
  const wallRef = useRef<HTMLDivElement | null>(null);
  const setWall = (el: HTMLDivElement | null) => {
    wallRef.current = el;
    seenRef.current = el;
  };

  const remaining = TARGET - raised;
  const complete = remaining <= 0;
  const chipAmount =
    amount === "rest" ? remaining : Math.min(amount, remaining);

  const chipIn = () => {
    if (remaining <= 0) return;
    const next = raised + chipAmount;
    setRaised(next);
    if (typeof amount === "number" && amount > TARGET - next) setAmount("rest");
    const giver: Giver = quiet
      ? { quiet: true }
      : {
          initials: NEW_NAMES[nameIndex.current % NEW_NAMES.length],
          style: NEW_PALETTE[nameIndex.current++ % NEW_PALETTE.length],
        };
    setGivers((prev) => [...prev, giver]);

    if (next >= TARGET) toast("Demo target reached! No money was collected.");
    else
      toast(
        "Demo contribution added. " + formatPrice(TARGET - next) + " to go",
      );
  };

  const replay = () => {
    setRaised(START);
    setGivers(SEED_GIVERS);
    nameIndex.current = 0;
    setAmount(20000);
    setQuiet(false);
  };

  return (
    <section
      id="pool"
      aria-labelledby="pool-heading"
      className="relative scroll-mt-24 overflow-hidden bg-ink py-16 text-white sm:py-24"
    >
      <Wrap className="relative grid grid-cols-2 items-center gap-10 lg:gap-16 max-lg:grid-cols-1">
        <Reveal className="flex min-w-0 flex-col gap-5">
          <Eyebrow tone="brand" className="text-amber-300">
            <Icon as={Users} size={16} />
            Pool a gift
          </Eyebrow>
          <h2
            id="pool-heading"
            className="font-display text-4xl leading-tight sm:text-5xl"
          >
            Six friends. One proper gift.
          </h2>
          <p className="max-w-[30em] text-base text-white/80">
            See how small contributions can come together for one thoughtful
            gift.
          </p>
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {STEPS.map((step, i) => (
              <li key={step} className="flex items-center gap-3 text-sm">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/8 text-sm font-semibold text-amber-300">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <p className="text-sm text-white/70">
            Interactive demo. Try a contribution below. No money is collected.
          </p>
        </Reveal>

        <Reveal delay={0.15} className="min-w-0">
          <div
            ref={setWall}
            className="relative flex flex-col gap-5 rounded-card-xl bg-white p-6 text-ink shadow-float max-sm:rounded-3xl max-sm:p-5"
          >
            <span className="self-start rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue">
              Pool preview
            </span>
            <div className="flex items-center gap-3.5">
              <SmartImage
                src="https://cdn.sanity.io/images/spvd4gp2/production/cf643a20c63cf1e05320c8af8412d563403e4249-1254x1254.png?w=200"
                alt=""
                loading="lazy"
                className="size-16 shrink-0 rounded-2xl bg-soft object-cover"
              />
              <div>
                <span className="text-xs text-muted">For Tunde’s 40th</span>
                <h3 className="font-display text-2xl">The big gift</h3>
              </div>
            </div>

            <div>
              <div
                role="progressbar"
                aria-label="Demo gift funding"
                aria-valuemin={0}
                aria-valuemax={TARGET}
                aria-valuenow={raised}
                aria-valuetext={`${formatPrice(raised)} of ${formatPrice(TARGET)}`}
                className="h-3 overflow-hidden rounded-full bg-soft"
              >
                <i
                  style={{
                    width: seen
                      ? `${Math.min((raised / TARGET) * 100, 100)}%`
                      : "0%",
                  }}
                  className="block h-full rounded-full bg-gradient-to-r from-brand to-orange transition-[width] duration-1000 ease-out motion-reduce:transition-none"
                />
              </div>
              <div
                role="status"
                className="mt-2 flex flex-wrap justify-between gap-2 text-sm text-muted"
              >
                <span>
                  <b className="font-semibold text-ink">
                    {formatPrice(raised)}
                  </b>{" "}
                  of {formatPrice(TARGET)}
                </span>
                <span>
                  {remaining > 0
                    ? formatPrice(remaining) + " to go"
                    : "Target reached"}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {givers.map((giver, i) => (
                <span
                  key={i}
                  title={giver.quiet ? "Gave quietly" : undefined}
                  aria-label={
                    giver.quiet
                      ? "Anonymous demo contributor"
                      : `Demo contributor ${giver.initials}`
                  }
                  className={cx(
                    "grid size-10 place-items-center rounded-full border-2 border-white text-xs font-semibold ring-1 ring-line",
                    giver.quiet ? "bg-soft text-muted" : giver.style,
                  )}
                >
                  {giver.quiet ? <Icon as={Heart} size={16} /> : giver.initials}
                </span>
              ))}
            </div>

            {!complete ? (
              <div className="flex flex-col gap-3">
                <div
                  role="group"
                  aria-label="Choose an amount"
                  className="grid grid-cols-4 gap-2 max-sm:grid-cols-2"
                >
                  {[...AMOUNTS, "rest" as const].map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={amount === value}
                      disabled={typeof value === "number" && value > remaining}
                      onClick={() => setAmount(value)}
                      className={cx(
                        "h-11 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40 rounded-2xl border text-sm font-medium",
                        amount === value
                          ? "border-brand bg-brand-light text-brand"
                          : "border-line bg-white text-ink",
                      )}
                    >
                      {value === "rest" ? "The rest" : formatPrice(value)}
                    </button>
                  ))}
                </div>

                <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={quiet}
                    onChange={(e) => setQuiet(e.target.checked)}
                    className="size-5 accent-brand"
                  />
                  Give quietly
                </label>

                <Btn type="button" tone="brand" onClick={chipIn} className="w-full">
                  <Icon as={HandHeart} size={16} />
                  Try {formatPrice(chipAmount)}
                </Btn>
              </div>
            ) : (
              <div
                role="status"
                tabIndex={-1}
                ref={(node) => node?.focus()}
                className="flex items-center justify-between gap-3 rounded-2xl bg-linear-to-br from-brand to-orange p-4 font-display text-xl leading-snug text-white max-sm:text-lg"
              >
                <span>
                  Target reached! {givers.length} demo contributions made it
                  happen.
                </span>
                <button
                  type="button"
                  onClick={replay}
                  className="min-h-11 cursor-pointer rounded-full border-0 bg-white/20 px-3.5 font-sans text-sm whitespace-nowrap text-white"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        </Reveal>
      </Wrap>
    </section>
  );
}
