"use client";

import { useState } from "react";
import { CalendarDays, Info } from "lucide-react";
import { Btn, Eyebrow, Icon, Reveal, SectionHead, Wrap, cx } from "@/components/ui/primitives";
import { EXPERIENCE_CENTRE_HREF } from "@/app/business/_components/BriefLink";
import { CALENDAR } from "@/app/business/_components/content";

/** `currentMonth` (0–11) comes from the server so the first render matches hydration. */
export function CorporateCalendar({ currentMonth }: { currentMonth: number }) {
  const [selected, setSelected] = useState(currentMonth);

  return (
    <section id="calendar" aria-labelledby="calendar-heading" className="pb-24 max-sm:pb-16">
      <Wrap>
        <Reveal>
          <SectionHead className="mb-10">
            <Eyebrow tone="brand">
              <Icon as={CalendarDays} size={16} />
              Corporate gifting calendar
            </Eyebrow>
            <h2 id="calendar-heading" className="font-display text-[clamp(32px,4.4vw,54px)] leading-[1.08]">
              Never miss a company moment
            </h2>
            <p className="text-base text-muted">
              Tap a month. We’ll remind you early enough to brand it properly.
            </p>
          </SectionHead>
        </Reveal>

        <Reveal
          role="group"
          aria-label="Months"
          className="mb-5 grid grid-cols-12 gap-1.5 max-lg:grid-cols-6 max-sm:grid-cols-4"
        >
          {CALENDAR.map(({ month, events }, i) => {
            const active = i === selected;
            return (
              <button
                key={month}
                type="button"
                aria-pressed={active}
                aria-label={`${month}, ${events.length} moments${i === currentMonth ? ", this month" : ""}`}
                onClick={() => setSelected(i)}
                className={cx(
                  "flex h-16 flex-col items-center justify-center gap-1 rounded-[14px] border-[1.5px] text-[13px] font-medium transition-colors duration-200 max-sm:h-14",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : i === currentMonth
                      ? "border-orange bg-card text-foreground"
                      : "border-line bg-card text-foreground",
                )}
              >
                {month}
                <span aria-hidden="true" className="flex gap-0.75">
                  {events.map((event) => (
                    <i
                      key={event.title}
                      className={cx("size-1.25 rounded-full", active ? "bg-white" : "bg-brand")}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </Reveal>

        <div aria-live="polite" className="grid grid-cols-3 gap-3.5 max-lg:grid-cols-1">
          {CALENDAR[selected].events.map(({ icon, title, detail, date }, j) => (
            <div
              key={`${selected}-${title}`}
              style={{ animationDelay: `${j * 60}ms` }}
              className="flex animate-slide-in flex-col gap-2.5 rounded-[20px] border border-line bg-card p-5"
            >
              <span className="grid size-10.5 place-items-center rounded-xl bg-brand-light text-brand">
                <Icon as={icon} />
              </span>
              <span className="text-xs font-semibold text-orange">{date}</span>
              <b className="text-[15px] font-semibold">{title}</b>
              <span className="text-[13px] text-muted">{detail}</span>
              <Btn as="a" href={EXPERIENCE_CENTRE_HREF} tone="line" size="sm" className="mt-1 self-start">
                Plan it
              </Btn>
            </div>
          ))}
        </div>

        <p className="mt-3.5 flex items-center gap-1.5 text-[12.5px] text-muted">
          <Icon as={Info} size={16} />
          Sallah and Easter dates change each year. Team birthdays run all year on Pulse.
        </p>
      </Wrap>
    </section>
  );
}
