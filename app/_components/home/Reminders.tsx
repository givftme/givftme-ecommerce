"use client";

import { useEffect, useRef, useState } from "react";
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

export default function Reminders() {
  const [stage, setStage] = useState(0);
  const [autoOn, setAutoOn] = useState(true);
  const [channel, setChannel] = useState("WhatsApp");
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { toast } = useFeedback();

  const isDesktop = useMediaQuery("(min-width:1025px)");
  const reduce = useReducedMotion();
  const [stickyRef, stickyVisible] = useInView({
    threshold: 0.4,
    rootMargin: "0px",
    once: false,
  });

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
    if (isDesktop || !autoOn || !stickyVisible || reduce) return;
    const id = setInterval(() => {
      if (!document.hidden) setStage((s) => (s + 1) % STEPS.length);
    }, 3600);
    return () => clearInterval(id);
  }, [isDesktop, autoOn, stickyVisible, reduce]);

  return (
    <section id="remember" className="pt-6 pb-24 max-sm:pb-16 rouded-full">
      <Wrap className="grid grid-cols-2 gap-16 max-lg:grid-cols-1 max-lg:gap-6">
        <div
          ref={stickyRef}
          className="sticky top-24 flex h-[calc(100vh-120px)] max-h-[720px] min-h-[560px] items-center justify-center max-lg:relative max-lg:top-0 max-lg:h-[560px] max-lg:min-h-0 max-sm:h-[520px]"
        >
          <div className="absolute inset-x-0 inset-y-[4%] overflow-hidden rounded-card-xl bg-peach before:absolute before:-top-20 before:-right-20 before:size-80 before:rounded-full before:bg-[rgba(255,122,26,0.16)] before:content-[''] after:absolute after:-bottom-[60px] after:-left-[70px] after:size-[260px] after:rounded-full after:bg-[rgba(225,29,46,0.1)] after:content-['']" />
          <PhoneMock
            stage={stage}
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
              className="no-scrollbar hidden gap-2 overflow-x-auto pb-1 max-lg:flex"
            >
              {STEPS.map((step, i) => (
                <button
                  key={step.pill}
                  type="button"
                  role="tab"
                  aria-selected={stage === i}
                  onClick={() => {
                    setAutoOn(false);
                    setStage(i);
                  }}
                  className={cx(
                    "h-10 shrink-0 cursor-pointer rounded-full border-[1.5px] px-4 text-[13px] font-medium",
                    stage === i
                      ? "border-red bg-red text-white"
                      : "border-line bg-white text-ink",
                  )}
                >
                  {step.pill}
                </button>
              ))}
            </div>

            <p className="hidden min-h-6 text-[14.5px] text-muted max-lg:block">
              {STEPS[stage].short}
            </p>

            <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
              <span>Remind me on</span>
              {CHANNELS.map(({ label, icon }) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={channel === label}
                  onClick={() => {
                    setChannel(label);
                    toast("Reminders will come by " + label);
                  }}
                  className={cx(
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-[7px] text-[13px]",
                    channel === label
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-white text-ink",
                  )}
                >
                  <Icon as={icon} size={16} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {STEPS.map((step, i) => (
            <div
              key={step.title}
              data-step={i}
              ref={(el) => {
                stepRefs.current[i] = el;
              }}
              className={cx(
                "flex min-h-[62vh] flex-col justify-center gap-3 transition-opacity duration-400 max-lg:hidden",
                stage === i ? "opacity-100" : "opacity-28",
              )}
            >
              <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-red">
                <Icon as={step.whenIcon} size={16} />
                {step.when}
              </span>
              <h3 className="text-[clamp(28px,3vw,40px)]">{step.title}</h3>
              <p className="max-w-[26em] text-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </Wrap>
    </section>
  );
}
