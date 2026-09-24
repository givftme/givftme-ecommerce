"use client";

import { type SubmitEvent, useEffect, useId, useRef, useState } from "react";
import { BellPlus, CalendarPlus, UserPlus } from "lucide-react";
import { Btn, Icon, Reveal, Wrap, cx } from "@/components/ui/primitives";
import { longDate, shortDate } from "../lib/format";
import { type CalendarEvent, downloadIcs } from "../lib/ics";
import { useFeedback } from "@/hooks/useFeedback";

const OCCASIONS = [
  "Birthday",
  "Anniversary",
  "Naming ceremony",
  "Omugwo",
  "Japa send-off",
  "Sallah",
  "Other",
];

/** The occasions that come round again, so they roll forward to the next one. */
const YEARLY = new Set(["Birthday", "Anniversary"]);

/** The nudges we promise, as offsets in days before the date. */
const SCHEDULE: [offset: number, label: string][] = [
  [30, "heads-up"],
  [7, "three gift ideas"],
  [1, "one-tap send"],
  [0, "delivery photo"],
];

const MS_PER_DAY = 86_400_000;

const FIELD =
  "h-12 w-full min-w-0 appearance-none rounded-[14px] border-[1.5px] border-line bg-white px-3.5 text-[15px] text-ink outline-0 focus:border-red";
const LABEL = "flex flex-col gap-1.5 text-[12.5px] font-medium text-muted";

interface Result {
  days: number;
  title: string;
  dateLabel: string;
  schedule: { label: string; when: string; past: boolean }[];
  event: CalendarEvent;
}

interface FieldError {
  field: "name" | "date";
  message: string;
}

/**
 * Works out the next occurrence of an occasion and lays out the nudges leading
 * up to it. Pure, and takes `today` so it can be tested against a fixed date.
 * Returns null when the date has already gone by.
 */
export function planOccasion(
  name: string,
  occasion: string,
  isoDate: string,
  today: Date,
): Result | null {
  const [y, m, d] = isoDate.split("-").map(Number);
  const yearly = YEARLY.has(occasion);

  let target = new Date(y, m - 1, d);
  if (yearly) {
    target = new Date(today.getFullYear(), m - 1, d);
    if (target < today) target.setFullYear(target.getFullYear() + 1);
  }

  const days = Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);
  if (days < 0) return null;

  return {
    days,
    title: `${name}’s ${occasion === "Other" ? "day" : occasion.toLowerCase()}`,
    dateLabel: longDate(target) + (yearly ? " · every year" : ""),
    schedule: SCHEDULE.map(([offset, label]) => {
      const when = new Date(target);
      when.setDate(when.getDate() - offset);
      return { label, when: shortDate(when), past: when < today };
    }),
    event: { name, occasion, date: target, yearly },
  };
}

export default function FinalCta() {
  const [name, setName] = useState("");
  const [occasion, setOccasion] = useState("Birthday");
  const [date, setDate] = useState("");
  const [error, setError] = useState<FieldError | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const formBoxRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const { toast, burst } = useFeedback();
  const errorId = useId();

  // The result replaces the form, so move focus to it rather than leaving it
  // on a button that no longer exists.
  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = name.trim();

    if (!trimmed) {
      setError({ field: "name", message: "Add their name." });
      nameRef.current?.focus();
      return;
    }
    if (!date) {
      setError({ field: "date", message: "Pick the date." });
      dateRef.current?.focus();
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const plan = planOccasion(trimmed, occasion, date, today);
    if (!plan) {
      setError({
        field: "date",
        message: "That date has passed. Pick an upcoming one.",
      });
      dateRef.current?.focus();
      return;
    }

    setError(null);
    setResult(plan);
    burst(formBoxRef.current, 60);
  };

  const startOver = () => {
    setResult(null);
    setName("");
    setDate("");
    setOccasion("Birthday");
    setError(null);
    // The form is not mounted again until after this render commits.
    setTimeout(() => nameRef.current?.focus(), 0);
  };

  return (
    <section
      id="start"
      aria-labelledby="start-heading"
      className="pb-24 max-sm:pb-16"
    >
      <Wrap>
        <Reveal className="relative grid grid-cols-2 items-center gap-10 overflow-hidden rounded-card-xl bg-red p-14 text-white max-lg:grid-cols-1 max-sm:px-4.5 max-sm:py-7.5 before:absolute before:-bottom-50 before:-left-40 before:size-110 before:rounded-full before:bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--color-amber)_45%,transparent),transparent)] before:content-['']">
          <div className="relative flex min-w-0 flex-col gap-3.5">
            <h2
              id="start-heading"
              className="relative text-[clamp(32px,4.4vw,54px)]"
            >
              Whose day are you most afraid of forgetting?
            </h2>
            <p className="relative text-base text-white opacity-92">
              Start there. Takes ten seconds.
            </p>
          </div>

          <div
            ref={formBoxRef}
            className="relative flex min-w-0 flex-col gap-3 rounded-card-lg bg-white p-5.5 text-ink shadow-float max-sm:p-4"
          >
            {!result ? (
              <form noValidate onSubmit={submit} className="flex flex-col gap-3">
                <label className={LABEL}>
                  Their name
                  <input
                    ref={nameRef}
                    type="text"
                    placeholder="e.g. Mummy"
                    autoComplete="off"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    aria-invalid={error?.field === "name"}
                    aria-describedby={error ? errorId : undefined}
                    className={FIELD}
                  />
                </label>

                <div className="grid grid-cols-2 gap-2.5 max-sm:grid-cols-1">
                  <label className={LABEL}>
                    Occasion
                    <select
                      value={occasion}
                      onChange={(e) => setOccasion(e.target.value)}
                      className={cx(FIELD, "select-caret pr-10")}
                    >
                      {OCCASIONS.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </label>
                  <label className={LABEL}>
                    Date
                    <input
                      ref={dateRef}
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      aria-invalid={error?.field === "date"}
                      aria-describedby={error ? errorId : undefined}
                      className={FIELD}
                    />
                  </label>
                </div>

                {error && (
                  <p id={errorId} role="alert" className="text-[13px] text-red">
                    {error.message}
                  </p>
                )}

                <Btn type="submit">
                  <Icon as={BellPlus} size={16} />
                  Remember this for me
                </Btn>
              </form>
            ) : (
              <div
                ref={resultRef}
                role="status"
                tabIndex={-1}
                className="animate-slide-in flex flex-col gap-3.5 outline-none motion-reduce:animate-none"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex size-[76px] shrink-0 flex-col items-center justify-center rounded-[22px] bg-[linear-gradient(145deg,var(--color-red),var(--color-orange))] leading-none text-white">
                    <b className="font-display text-[30px] font-normal">
                      {result.days}
                    </b>
                    <span className="mt-1 text-[10.5px]">days</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[22px]">{result.title}</h3>
                    <span className="text-[11px] text-muted">
                      {result.dateLabel}
                    </span>
                  </div>
                </div>

                <span className="text-[11px] text-muted">
                  We’ll nudge you on:
                </span>

                <ul className="ml-2 flex flex-col border-l-2 border-dashed border-line pl-[18px]">
                  {result.schedule.map(({ when, label, past }) => (
                    <li
                      key={label}
                      className={cx(
                        "relative py-[7px] text-[13.5px] before:absolute before:top-3 before:-left-[26px] before:box-border before:size-3.5 before:rounded-full before:border-[3px] before:bg-white before:content-['']",
                        past
                          ? "text-muted line-through before:border-line"
                          : "before:border-red",
                      )}
                    >
                      <b className="font-semibold">{when}</b> — {label}
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap gap-2">
                  <Btn
                    type="button"
                    size="sm"
                    onClick={() => {
                      downloadIcs(result.event);
                      toast("Calendar file downloaded");
                    }}
                  >
                    <Icon as={CalendarPlus} size={16} />
                    Add to calendar
                  </Btn>
                  <Btn type="button" tone="line" size="sm" onClick={startOver}>
                    <Icon as={UserPlus} size={16} />
                    Add someone else
                  </Btn>
                </div>
              </div>
            )}
          </div>
        </Reveal>
      </Wrap>
    </section>
  );
}
