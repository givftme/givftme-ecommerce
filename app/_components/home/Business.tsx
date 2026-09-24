import { Briefcase, CalendarCheck } from "lucide-react";
import {
  Btn,
  Eyebrow,
  Icon,
  Pill,
  Reveal,
  Wrap,
  cx,
  type PillTone,
} from "@/components/ui/primitives";

/** Avatar tints, drawn from the theme accents rather than one-off hexes. */
const AVATAR_TONES = {
  brand: "bg-brand-light text-brand",
  peach: "bg-peach text-orange",
  blue: "bg-blue-50 text-blue",
  green: "bg-green-50 text-green",
} as const;

interface TeamMember {
  initials: string;
  tone: keyof typeof AVATAR_TONES;
  name: string;
  meta: string;
  status: { tone: PillTone; label: string };
}

/** The sample month shown in the preview panel. */
const MONTH = "October";

const TEAM: TeamMember[] = [
  {
    initials: "NA",
    tone: "brand",
    name: "Ngozi A.",
    meta: "Birthday · 3 Oct",
    status: { tone: "green", label: "Delivered" },
  },
  {
    initials: "EO",
    tone: "peach",
    name: "Emeka O.",
    meta: "5 years · 11 Oct",
    status: { tone: "blue", label: "Scheduled" },
  },
  {
    initials: "AB",
    tone: "blue",
    name: "Aisha B.",
    meta: "New baby · 18 Oct",
    status: { tone: "blue", label: "Scheduled" },
  },
  {
    initials: "TD",
    tone: "green",
    name: "Tolu D.",
    meta: "Birthday · 27 Oct",
    status: { tone: "orange", label: "Choosing" },
  },
];

export default function Business() {
  return (
    <section
      id="business"
      aria-labelledby="business-heading"
      className="pb-24 max-sm:pb-16"
    >
      <Wrap>
        <Reveal className="grid grid-cols-2 items-center gap-10 rounded-card-xl border border-line bg-white p-10 max-lg:grid-cols-1 max-sm:p-5.5">
          <div className="flex min-w-0 flex-col gap-4.5">
            <Eyebrow>
              <Icon as={Briefcase} size={16} />
              Givtme for Business
            </Eyebrow>
            <h2
              id="business-heading"
              className="text-[clamp(32px,4.2vw,52px)]"
            >
              Every staff birthday. One invoice.
            </h2>
            <p className="max-w-[30em] text-base text-muted">
              Upload your team once. We handle dates, gifts and delivery.
            </p>
            <Btn
              as="a"
              href="/contact-us"
              tone="ink"
              magnetic
              className="self-start"
            >
              <Icon as={CalendarCheck} size={16} />
              Book a demo
            </Btn>
          </div>

          <div className="flex flex-col gap-2 rounded-card-lg bg-soft p-4.5">
            <div className="flex items-center justify-between px-1 pt-0.5 pb-1.5">
              <h3 id="business-month" className="text-sm font-semibold">
                {MONTH}
              </h3>
              <span className="text-[11px] text-muted">
                {TEAM.length} occasions
              </span>
            </div>
            <ul aria-labelledby="business-month" className="flex flex-col gap-2">
              {TEAM.map(({ initials, tone, name, meta, status }) => (
                <li
                  key={name}
                  className="flex items-center gap-3 rounded-[14px] bg-white p-3"
                >
                  <span
                    aria-hidden="true"
                    className={cx(
                      "grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold",
                      AVATAR_TONES[tone],
                    )}
                  >
                    {initials}
                  </span>
                  <div className="min-w-0 flex-1 text-[13px] leading-[1.35]">
                    <b className="block font-semibold">{name}</b>
                    <span className="text-[11px] text-muted">{meta}</span>
                  </div>
                  <Pill tone={status.tone}>{status.label}</Pill>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </Wrap>
    </section>
  );
}
