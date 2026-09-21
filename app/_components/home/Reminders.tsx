"use client";

import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  BellRing,
  Calendar,
  Camera,
  Mail,
  MessageCircle,
  Smartphone,
  Sparkles,
  Zap,
} from "lucide-react";
import { Eyebrow, Icon, Wrap, cx } from "@/components/ui/primitives";
import PhoneMock from "./PhoneMock";
import { useInView } from "@/hooks/useInView";
import { useMediaQuery, useReducedMotion } from "@/hooks/useMediaQuery";
import { useFeedback } from "@/hooks/useFeedback";

const STEPS = [
  {
    when: "30 days before",
    whenIcon: Calendar,
    title: "A quiet heads-up",
    body: "For the big ones. Time to plan something proper.",
    pill: "30 days",
    short: "A quiet heads-up for the big ones.",
  },
  {
    when: "7 days before",
    whenIcon: Sparkles,
    title: "Real ideas, not alerts",
    body: "Three picks based on who they are — and their wishlist.",
    pill: "7 days",
    short: "Three real picks, not a bare alert.",
  },
  {
    when: "1 day before",
    whenIcon: Zap,
    title: "One tap. Done.",
    body: "Same-day options only. No browsing.",
    pill: "1 day",
    short: "One tap. Same-day options only.",
  },
  {
    when: "On the day",
    whenIcon: Camera,
    title: "You see the moment",
    body: "Delivered, wrapped, with your note — and a photo from the door.",
    pill: "On the day",
    short: "Delivered — with a photo from the door.",
  },
];

const CHANNELS = [
  { label: "WhatsApp", icon: MessageCircle },
  { label: "Push", icon: Smartphone },
  { label: "Email", icon: Mail },
];

/** How long each stage shows on mobile before the demo advances. */
const CYCLE_MS = 3600;

export default function Reminders() {
  const [stage, setStage] = useState(0);
  const [autoOn, setAutoOn] = useState(true);
  const [channel, setChannel] = useState("WhatsApp");
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabListRef = useRef<HTMLDivElement>(null);
  const { toast } = useFeedback();

  const isDesktop = useMediaQuery("(min-width:1025px)");
  const reduce = useReducedMotion();
  const [stickyRef, stickyVisible] = useInView({
    threshold: 0.4,
    rootMargin: "0px",
    once: false,
  });
  const cycling = !isDesktop && autoOn && stickyVisible && !reduce;

  // Desktop: the phone follows whichever step is in the middle of the viewport.
  useEffect(() => {
    if (!isDesktop) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setStage(Number((entry.target as HTMLElement).dataset.step));
          }
        });
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    stepRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [isDesktop]);

  // Mobile: there is no step column to scroll through, so cycle on a timer
  // until the visitor picks a stage themselves.
  useEffect(() => {
    if (!cycling) return;
    const id = setInterval(() => {
      if (!document.hidden) setStage((s) => (s + 1) % STEPS.length);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, [cycling]);

  // Mobile: keep the active pill in view as the demo cycles. Scrolls only the
  // pill row — scrollIntoView would also yank the page vertically.
  useEffect(() => {
    const list = tabListRef.current;
    const tab = tabRefs.current[stage];
    if (isDesktop || !list || !tab) return;
    const centred = tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2;
    list.scrollTo({ left: centred, behavior: reduce ? "auto" : "smooth" });
  }, [stage, isDesktop, reduce]);

  const pickStage = (i: number) => {
    setAutoOn(false);
    setStage(i);
  };

  // Roving focus across the mobile tabs, per the WAI-ARIA tabs pattern.
  const onTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const n = STEPS.length;
    const next = {
      ArrowRight: (stage + 1) % n,
      ArrowLeft: (stage - 1 + n) % n,
      Home: 0,
      End: n - 1,
    }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    pickStage(next);
    tabRefs.current[next]?.focus();
  };

  const scrollToStep = (i: number) =>
    stepRefs.current[i]?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "center",
    });

  return (
    <section id="remember" className="pt-6 pb-24 max-sm:pb-16">
      <Wrap className="grid grid-cols-2 gap-16 max-lg:grid-cols-1 max-lg:gap-6">
        <div
          ref={stickyRef}
          id="reminders-demo"
          role={isDesktop ? undefined : "tabpanel"}
          aria-labelledby={isDesktop ? undefined : `reminders-tab-${stage}`}
          className="sticky top-24 flex h-[calc(100vh-120px)] max-h-[720px] min-h-[560px] items-center justify-center max-lg:relative max-lg:top-0 max-lg:h-[560px] max-lg:min-h-0 max-sm:h-[520px]"
        >
          <div className="absolute inset-x-0 inset-y-[4%] overflow-hidden rounded-card-xl bg-peach before:absolute before:-top-20 before:-right-20 before:size-80 before:rounded-full before:bg-[rgba(255,122,26,0.16)] before:content-[''] after:absolute after:-bottom-[60px] after:-left-[70px] after:size-[260px] after:rounded-full after:bg-[rgba(225,29,46,0.1)] after:content-['']" />

          <span className="absolute top-[calc(4%+18px)] left-5 z-2 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-red backdrop-blur max-lg:hidden">
            <Icon as={STEPS[stage].whenIcon} size={14} />
            {STEPS[stage].when}
          </span>

          <PhoneMock
            stage={stage}
            channel={channel}
            className="z-2 w-[min(280px,70%)] max-sm:w-[min(240px,74%)]"
          />
        </div>

        <div className="flex min-w-0 flex-col max-lg:order-first">
          <div className="flex flex-col gap-[18px] pb-[30px] max-lg:pb-0">
            <Eyebrow>
              <Icon as={BellRing} size={16} />
              Reminders
            </Eyebrow>
            <h2 className="text-[clamp(32px,4.2vw,52px)]">
              Tell us once. We’ll handle the rest.
            </h2>
            <p className="max-w-[30em] text-base text-muted">
              Birthdays, naming ceremonies, send-offs. Max three nudges per
              occasion.
            </p>

            <div
              role="tablist"
              aria-label="Reminder timeline"
              ref={tabListRef}
              // Bleeds to the screen edges so pills slide under a soft fade
              // instead of being clipped at the page gutter.
              className="no-scrollbar relative -mx-5.5 hidden snap-x snap-proximity scroll-px-5.5 gap-2 overflow-x-auto overscroll-x-contain scroll-smooth px-5.5 py-0.5 [mask-image:linear-gradient(90deg,transparent,#000_20px,#000_calc(100%-20px),transparent)] motion-reduce:scroll-auto max-lg:flex max-sm:-mx-4.5 max-sm:scroll-px-4.5 max-sm:px-4.5"
            >
              {STEPS.map((step, i) => (
                <button
                  key={step.pill}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  id={`reminders-tab-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={stage === i}
                  aria-controls="reminders-demo"
                  tabIndex={stage === i ? 0 : -1}
                  onClick={() => pickStage(i)}
                  onKeyDown={onTabKeyDown}
                  className={cx(
                    "relative h-10 shrink-0 snap-center cursor-pointer overflow-hidden rounded-full border-[1.5px] px-4 text-[13px] font-medium transition-colors",
                    stage === i
                      ? "border-red bg-red text-white"
                      : "border-line bg-white text-ink hover:border-ink/40",
                  )}
                >
                  {stage === i && cycling && (
                    // Restarts each stage (keyed) so visitors can see the demo is advancing.
                    <span
                      key={stage}
                      aria-hidden="true"
                      className="absolute inset-0 origin-left animate-fill-x bg-white/20"
                      style={{ animationDuration: `${CYCLE_MS}ms` }}
                    />
                  )}
                  <span className="relative">{step.pill}</span>
                </button>
              ))}
            </div>

            <p className="hidden min-h-6 text-[14.5px] text-muted max-lg:block">
              {STEPS[stage].short}
            </p>

            <div
              role="group"
              aria-label="Reminder channel"
              className="flex flex-wrap items-center gap-2 text-[13px] text-muted"
            >
              <span>Remind me on</span>
              {CHANNELS.map(({ label, icon }) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={channel === label}
                  onClick={() => {
                    if (channel === label) return;
                    setChannel(label);
                    toast("Reminders will come by " + label);
                  }}
                  className={cx(
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-[7px] text-[13px] transition-colors",
                    channel === label
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-white text-ink hover:border-ink/40",
                  )}
                >
                  <Icon as={icon} size={16} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <ol className="relative max-lg:hidden">
            {/* The rail, with a red fill that tracks progress through the steps. */}
            <span
              aria-hidden="true"
              className="absolute top-[31vh] bottom-[31vh] left-[7px] w-0.5 rounded-full bg-line"
            >
              <span
                className="absolute inset-x-0 top-0 origin-top rounded-full bg-red transition-transform duration-500 motion-reduce:transition-none"
                style={{
                  height: "100%",
                  transform: `scaleY(${stage / (STEPS.length - 1)})`,
                }}
              />
            </span>

            {STEPS.map((step, i) => (
              <li
                key={step.title}
                aria-current={stage === i ? "step" : undefined}
              >
                <div
                  data-step={i}
                  ref={(el) => {
                    stepRefs.current[i] = el;
                  }}
                  className={cx(
                    "relative flex min-h-[62vh] flex-col justify-center gap-3 pl-10 transition-opacity duration-400 motion-reduce:transition-none",
                    stage === i ? "opacity-100" : "opacity-28",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cx(
                      "absolute top-1/2 left-0 size-4 -translate-y-1/2 rounded-full border-2 transition-colors duration-300",
                      i <= stage
                        ? "border-red bg-red"
                        : "border-line bg-white",
                      stage === i && "ring-4 ring-red/15",
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => scrollToStep(i)}
                    className="inline-flex w-fit cursor-pointer items-center gap-2 text-[13px] font-semibold text-red"
                  >
                    <Icon as={step.whenIcon} size={16} />
                    {step.when}
                  </button>
                  <h3 className="text-[clamp(28px,3vw,40px)]">{step.title}</h3>
                  <p className="max-w-[26em] text-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Wrap>
    </section>
  );
}
