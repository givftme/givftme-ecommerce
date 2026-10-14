"use client";

import { Camera, HeartHandshake, Palette, Receipt, ShieldCheck } from "lucide-react";
import { useInView } from "@/hooks/useInView";
import { Eyebrow, Icon, Pill, Reveal, Wrap, cx, type PillTone } from "@/components/ui/primitives";

const STATS = [
  { label: "This month", value: "12 moments", fill: "66%", caption: "8 delivered · 4 scheduled" },
  { label: "Q4 budget used", value: "48%", fill: "48%", caption: "On track" },
];

const AVATAR_TONES = {
  brand: "bg-brand-light text-brand",
  peach: "bg-peach text-accent-foreground",
  purple: "bg-purple-light text-purple",
  green: "bg-success/10 text-success",
} as const;

const ROWS: {
  initials: string;
  tone: keyof typeof AVATAR_TONES;
  name: string;
  meta: string;
  status: { tone: PillTone; label: string };
}[] = [
  { initials: "NA", tone: "brand", name: "Ngozi A. · Finance", meta: "Birthday · branded cake", status: { tone: "green", label: "Delivered" } },
  { initials: "CS", tone: "peach", name: "Customer Service team", meta: "CSW · 40 treat packs", status: { tone: "blue", label: "Mon" } },
  { initials: "MD", tone: "purple", name: "The MD", meta: "Signature · birthday", status: { tone: "orange", label: "Curating" } },
  { initials: "EO", tone: "green", name: "Emeka O. · Sales", meta: "5 years · gift card", status: { tone: "blue", label: "Scheduled" } },
];

const REASONS = [
  { icon: Palette, title: "On-brand, every time", detail: "Your logo, colours and message on cakes, packs and cards." },
  { icon: Receipt, title: "One invoice", detail: "Every gift, every office, one bill." },
  { icon: Camera, title: "Proof of delivery", detail: "A photo for every gift delivered." },
  { icon: HeartHandshake, title: "Handled with care", detail: "Quiet, careful sympathy packages when a colleague loses someone." },
];

export function HrDashboard() {
  const [ref, inView] = useInView<HTMLDivElement>();

  return (
    <section aria-labelledby="why-heading" className="py-24 max-sm:py-16">
      <Wrap className="grid grid-cols-2 items-center gap-14 max-lg:grid-cols-1">
        <Reveal>
          {/* A static illustration of the HR dashboard, not live data. */}
          <div
            ref={ref}
            aria-hidden="true"
            className="rounded-card-xl bg-ink-deep p-3.5 shadow-float"
          >
            <div className="overflow-hidden rounded-[26px] bg-card">
              <div className="flex items-center justify-between gap-2.5 border-b border-line px-4.5 py-3.5">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((dot) => (
                    <i key={dot} className="block size-2.5 rounded-full bg-line" />
                  ))}
                </div>
                <b className="text-[13.5px] font-semibold">HR dashboard</b>
                <Pill tone="green">Live</Pill>
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3.5 p-4.5 max-lg:grid-cols-1">
                <div className="flex flex-col gap-3">
                  {STATS.map(({ label, value, fill, caption }) => (
                    <div key={label} className="flex flex-col gap-1.5 rounded-[18px] bg-soft p-4">
                      <span className="text-xs text-muted">{label}</span>
                      <b className="text-[26px] leading-none font-semibold tracking-tight">{value}</b>
                      <div className="h-2 overflow-hidden rounded-full bg-card">
                        <i
                          style={{ width: inView ? fill : 0 }}
                          className="block h-full rounded-full bg-brand-gradient transition-[width] duration-1400 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
                        />
                      </div>
                      <span className="text-xs text-muted">{caption}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-2">
                  {ROWS.map(({ initials, tone, name, meta, status }) => (
                    <div
                      key={name}
                      className="flex items-center gap-3 rounded-[14px] border border-line px-3 py-2.5"
                    >
                      <span
                        className={cx(
                          "grid size-8.5 shrink-0 place-items-center rounded-full text-xs font-semibold",
                          AVATAR_TONES[tone],
                        )}
                      >
                        {initials}
                      </span>
                      <div className="min-w-0 flex-1 text-[13px] leading-[1.35]">
                        <b className="block truncate font-semibold">{name}</b>
                        <small className="text-[11.5px] text-muted">{meta}</small>
                      </div>
                      <Pill tone={status.tone}>{status.label}</Pill>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1} className="flex min-w-0 flex-col gap-4.5">
          <Eyebrow tone="brand">
            <Icon as={ShieldCheck} size={16} />
            Why companies choose Givftme
          </Eyebrow>
          <h2 id="why-heading" className="font-display text-[clamp(32px,4.2vw,52px)] leading-[1.08]">
            Less admin for HR. More moments for your people.
          </h2>
          <ul className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            {REASONS.map(({ icon, title, detail }) => (
              <li key={title} className="flex flex-col gap-2 rounded-[18px] border border-line p-4">
                <Icon as={icon} className="text-brand" />
                <b className="text-sm font-semibold">{title}</b>
                <span className="text-[13px] leading-[1.45] text-muted">{detail}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </Wrap>
    </section>
  );
}
