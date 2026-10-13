"use client";

import { useState } from "react";
import { CalendarHeart, Check, ChevronRight, Headset, Palette } from "lucide-react";
import { Eyebrow, Icon, Reveal, SectionHead, Wrap, cx } from "@/components/ui/primitives";
import { BriefLink } from "@/app/business/_components/BriefLink";
import { MOMENTS } from "@/app/business/_components/content";

export function Moments() {
  const [selected, setSelected] = useState(0);
  const moment = MOMENTS[selected];

  return (
    <section id="moments" aria-labelledby="moments-heading" className="py-24 max-sm:py-16">
      <Wrap>
        <Reveal>
          <SectionHead className="mb-10">
            <Eyebrow tone="brand">
              <Icon as={CalendarHeart} size={16} />
              Occasions
            </Eyebrow>
            <h2 id="moments-heading" className="font-display text-[clamp(32px,4.4vw,54px)] leading-[1.08]">
              Every moment your company should show up for
            </h2>
            <p className="text-base text-muted">Pick one to see what we send and how we brand it.</p>
          </SectionHead>
        </Reveal>

        <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-start gap-6 max-lg:grid-cols-1">
          <ul aria-label="Corporate occasions" className="flex flex-col gap-2">
            {MOMENTS.map(({ icon, title, when }, i) => {
              const active = i === selected;
              return (
                <li key={title}>
                  <button
                    type="button"
                    aria-pressed={active}
                    aria-controls="moment-detail"
                    onClick={() => setSelected(i)}
                    className={cx(
                      "flex w-full items-center gap-3.5 rounded-[18px] border-[1.5px] px-4 py-3.5 text-left text-foreground transition-[border-color,background-color,transform] duration-200 hover:translate-x-1",
                      active ? "border-brand bg-brand-light" : "border-line bg-card",
                    )}
                  >
                    <span
                      className={cx(
                        "grid size-[42px] shrink-0 place-items-center rounded-xl",
                        active ? "bg-primary text-primary-foreground" : "bg-soft text-brand",
                      )}
                    >
                      <Icon as={icon} />
                    </span>
                    <span>
                      <b className="block text-[14.5px] leading-[1.3] font-semibold">{title}</b>
                      <span className="text-[12.5px] text-muted">{when}</span>
                    </span>
                    <Icon
                      as={ChevronRight}
                      size={16}
                      className={cx("ml-auto", active ? "text-brand" : "text-muted")}
                    />
                  </button>
                </li>
              );
            })}
          </ul>

          <div
            id="moment-detail"
            aria-live="polite"
            className="relative flex min-h-[520px] flex-col overflow-hidden rounded-card-xl bg-ink-deep p-[34px] text-white lg:sticky lg:top-24 max-lg:min-h-0 max-sm:px-5 max-sm:py-6"
          >
            <div
              aria-hidden="true"
              className="absolute -top-40 -right-36 size-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(255,122,26,0.3),transparent)]"
            />
            {/* Keyed so each occasion replays the entrance. */}
            <div key={selected} className="relative flex flex-1 animate-slide-in flex-col gap-[18px]">
              <div className="flex items-center gap-3.5">
                <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary">
                  <Icon as={moment.icon} size={26} />
                </span>
                <div>
                  <h3 className="font-display text-[clamp(28px,3vw,38px)] leading-[1.08]">{moment.title}</h3>
                  <span className="text-[13.5px] text-white/75">{moment.who}</span>
                </div>
              </div>

              <p className="max-w-[34em] text-[15px] text-white/90">{moment.blurb}</p>

              <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                <DetailList title="What we send" icon={Check} items={moment.inside} />
                <DetailList title="How we brand it" icon={Palette} items={moment.brand} />
              </div>

              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-white/12 pt-[18px]">
                <span className="text-[13px] text-white/75">
                  Best on <b className="font-semibold text-white">{moment.plan}</b>
                </span>
                <BriefLink brief={{ occasions: [moment.occasion] }} className="max-sm:w-full">
                  <Icon as={Headset} size={16} />
                  Plan this with us
                </BriefLink>
              </div>
            </div>
          </div>
        </div>
      </Wrap>
    </section>
  );
}

function DetailList({
  title,
  icon,
  items,
}: {
  title: string;
  icon: typeof Check;
  items: string[];
}) {
  return (
    <div>
      <h4 className="mb-2 text-[12.5px] font-semibold text-amber">{title}</h4>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-[13.5px] leading-[1.45]">
            <Icon as={icon} size={16} className="mt-0.5 text-amber" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
