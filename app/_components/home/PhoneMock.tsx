import {
  Bell,
  ChevronRight,
  CircleCheck,
  Clock,
  Gift,
  ListChecks,
  Send,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import Image from "next/image";
import type { ComponentType } from "react";
import { Icon, Pill, SmartImage, cx } from "@/components/ui/primitives";

const BOX_SWEET_HOME =
  "https://cdn.sanity.io/images/spvd4gp2/production/fd6619ed68739f5077ca122eb99f07370ed591b4-1254x1254.png";
const BOX_NEW_CHAPTER =
  "https://cdn.sanity.io/images/spvd4gp2/production/cf643a20c63cf1e05320c8af8412d563403e4249-1254x1254.png";
const PHOTO_KITCHEN =
  "https://givftme.vercel.app/_next/image?url=%2Fimages%2Fhero-carousel-image-02.png";

type ScreenProps = { channel: string };

const TINY = "text-[11px] text-muted";
const BUBBLE =
  "max-w-[92%] rounded-[4px_16px_16px_16px] bg-white px-3 py-2.5 text-[12.5px] leading-[1.45] shadow-[0_1px_1px_rgba(0,0,0,0.05)]";
const APP_BAR = "flex items-center justify-between px-[18px] pt-[52px] pb-3";
const APP_BODY = "flex min-h-0 flex-1 flex-col gap-3 px-4 pt-1 pb-4";
const CTA_BAR =
  "flex h-[42px] items-center justify-center gap-1.5 rounded-full bg-red text-[13px] font-medium text-white";

const UPCOMING = [
  {
    initials: "TA",
    tone: "bg-[#fff1e4] text-[#c4520a]",
    name: "Tunde & Ada",
    meta: "Anniversary · 12 Oct",
  },
  {
    initials: "BO",
    tone: "bg-blue-50 text-blue",
    name: "Bola",
    meta: "Birthday · 19 Oct",
  },
  {
    initials: "KE",
    tone: "bg-green-50 text-green",
    name: "Kemi’s baby",
    meta: "Naming ceremony · 2 Nov",
  },
];

/** 30 days out: the countdown home screen. */
function ScreenCountdown() {
  return (
    <>
      <div className={APP_BAR}>
        <Image src="/logo.png" alt="Gifvtme" width={66} height={22} className="h-[22px] w-auto" />
        <Icon as={Bell} />
      </div>
      <div className={APP_BODY}>
        <div className="flex items-center gap-3.5 rounded-[22px] bg-[linear-gradient(145deg,var(--color-red),var(--color-orange))] p-[18px] text-white">
          <div className="relative size-[66px] shrink-0">
            <svg viewBox="0 0 36 36" className="size-full -rotate-90">
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="rgba(255,255,255,.3)"
                strokeWidth="3"
              />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="#fff"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="97.4"
                strokeDashoffset="24"
              />
            </svg>
            <b className="absolute inset-0 grid place-items-center font-display text-2xl font-normal">
              30
            </b>
          </div>
          <div>
            <h4 className="text-[19px]">Mum turns 60</h4>
            <p className="text-xs opacity-92">Big one. Plan it properly.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <span className="flex h-[38px] items-center justify-center gap-1.5 rounded-full bg-ink text-xs font-medium text-white">
            <Icon as={Sparkles} size={16} />
            Get ideas
          </span>
          <span className="flex h-[38px] items-center justify-center gap-1.5 rounded-full bg-soft text-xs font-medium">
            <Icon as={Users} size={16} />
            Pool it
          </span>
        </div>

        <span className={cx(TINY, "mt-1")}>Also coming up</span>

        {UPCOMING.map(({ initials, tone, name, meta }) => (
          <div
            key={name}
            className="flex items-center gap-2.5 rounded-[14px] border border-line px-3 py-2.5 text-xs"
          >
            <span
              className={cx(
                "grid size-[30px] shrink-0 place-items-center rounded-full text-[11px] font-semibold",
                tone,
              )}
            >
              {initials}
            </span>
            <div className="min-w-0 flex-1 leading-[1.35]">
              <b className="block text-[12.5px] font-semibold">{name}</b>
              <span className={TINY}>{meta}</span>
            </div>
            <Icon as={ChevronRight} size={16} />
          </div>
        ))}
      </div>
    </>
  );
}

/** 7 days out: the nudge with three real picks, on whichever channel was chosen. */
function ScreenIdeas({ channel }: ScreenProps) {
  return (
    <>
      <div className="flex items-center gap-2.5 border-b border-line bg-white px-4 pt-12 pb-3">
        <span className="grid size-[34px] place-items-center rounded-full bg-red text-white">
          <Icon as={Gift} size={16} />
        </span>
        <div>
          <b className="block text-[13.5px] leading-tight font-semibold">
            Givtme
          </b>
          <span className={TINY}>{channel} · now</span>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 bg-[#f4f1ec] px-3 py-3.5">
        <div className={BUBBLE}>
          Chidinma turns 30 next Friday. Want to do something proper?
        </div>
        <div className={cx(BUBBLE, "p-2")}>
          <div className="grid grid-cols-3 gap-1.5">
            <div className="overflow-hidden rounded-xl border border-line bg-white text-[10.5px] leading-tight">
              <span className="grid aspect-square w-full place-items-center bg-red-50 text-red">
                <Icon as={ListChecks} />
              </span>
              <div className="p-1.5">
                <b className="block font-semibold">Her list</b>She asked
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-line bg-white text-[10.5px] leading-tight">
              <SmartImage
                src={`${BOX_SWEET_HOME}?w=200`}
                alt="Sweet Home Box"
                className="aspect-square w-full object-cover"
              />
              <div className="p-1.5">
                <b className="block font-semibold">Sweet Home</b>₦30,000
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-line bg-white text-[10.5px] leading-tight">
              <SmartImage
                src={`${BOX_NEW_CHAPTER}?w=200`}
                alt="The New Chapter Box"
                className="aspect-square w-full object-cover"
              />
              <div className="p-1.5">
                <b className="block font-semibold">New Chapter</b>₦25,000
              </div>
            </div>
          </div>
        </div>
        <div className={cx(CTA_BAR, "mt-auto")}>
          <Icon as={Gift} size={16} />
          Pick one
        </div>
      </div>
    </>
  );
}

/** 1 day out: one same-day option, one tap. */
function ScreenOneTap() {
  return (
    <>
      <div className={APP_BAR}>
        <Image src="/logo.png" alt="Gifvtme" width={66} height={22} className="h-[22px] w-auto" />
        <Pill tone="orange">
          <Icon as={Clock} size={16} />1 day left
        </Pill>
      </div>
      <div className={APP_BODY}>
        <h4 className="text-[21px]">Bola’s birthday is tomorrow</h4>
        <div className="relative aspect-[1.1] overflow-hidden rounded-[20px] bg-soft">
          <SmartImage
            src={`${BOX_SWEET_HOME}?w=500`}
            alt="Sweet Home Box"
            className="size-full object-cover"
          />
          <Pill tone="red" className="absolute top-2.5 left-2.5">
            <Icon as={Zap} size={16} />
            Same-day
          </Pill>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div>
            <b className="text-sm font-semibold">Sweet Home Box</b>
            <div className={TINY}>Wrapped, with your note</div>
          </div>
          <b className="font-semibold text-red">₦30,000</b>
        </div>
        <div className={cx(CTA_BAR, "mt-auto h-12")}>
          <Icon as={Send} size={16} />
          Send it · one tap
        </div>
      </div>
    </>
  );
}

/** On the day: the photo from the door. */
function ScreenDelivered() {
  return (
    <>
      <div className="absolute inset-0 after:absolute after:inset-0 after:bg-[linear-gradient(180deg,rgba(0,0,0,0.05)_40%,rgba(0,0,0,0.6))] after:content-['']">
        <SmartImage
          src={`${PHOTO_KITCHEN}&w=828&q=75`}
          alt="Family embracing after receiving a gift"
          className="size-full object-cover"
        />
      </div>
      <div className="absolute top-12 right-3 left-3 z-2 flex justify-between">
        <Pill tone="green" className="bg-white">
          <Icon as={CircleCheck} size={16} />
          Delivered 10:42
        </Pill>
      </div>
      <div className="absolute right-3 bottom-3.5 left-3 z-2 flex flex-col gap-2">
        <div className={cx(BUBBLE, "max-w-full")}>
          <b className="font-semibold">It’s with her.</b> Here’s the photo from
          the door.
        </div>
        <div className={cx(BUBBLE, "max-w-full text-muted italic")}>
          “Happy 30th, Chidi. Thirty looks good on you.”
        </div>
      </div>
    </>
  );
}

const SCREENS: ComponentType<ScreenProps>[] = [
  ScreenCountdown,
  ScreenIdeas,
  ScreenOneTap,
  ScreenDelivered,
];

/** The handset frame. `stage` picks which of the four screens is showing. */
export default function PhoneMock({
  stage = 0,
  channel = "WhatsApp",
  className,
}: {
  stage?: number;
  channel?: string;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "relative aspect-[300/610] w-[300px] max-w-full rounded-[46px] bg-[#101014] p-2.5 shadow-[var(--shadow-float),inset_0_0_0_2px_#2a2a31]",
        "before:absolute before:top-[18px] before:left-1/2 before:z-3 before:-ml-[45px] before:h-6 before:w-[90px] before:rounded-full before:bg-[#101014] before:content-['']",
        className,
      )}
    >
      <div className="relative size-full overflow-hidden rounded-[37px] bg-white">
        {SCREENS.map((Screen, i) => (
          <div
            key={i}
            aria-hidden={stage !== i}
            className={cx(
              "absolute inset-0 flex flex-col transition-[opacity,transform] duration-500 motion-reduce:transition-opacity ease-[cubic-bezier(0.2,0.8,0.2,1)]",
              stage === i
                ? "translate-y-0 scale-100 opacity-100"
                : "pointer-events-none translate-y-4 scale-[0.98] opacity-0",
            )}
          >
            <Screen channel={channel} />
          </div>
        ))}
      </div>
    </div>
  );
}
