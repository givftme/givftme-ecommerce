import Link from "next/link";
import {
  Camera,
  CalendarHeart,
  HeartHandshake,
  ListPlus,
  MessageCircle,
  Users,
} from "lucide-react";
import { Badge, Icon, Reveal, Wrap } from "@/components/ui/primitives";
import HeroStage from "@/app/_components/home/HeroStage";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const TRUST = [
  { icon: MessageCircle, label: "WhatsApp reminders" },
  { icon: Users, label: "Gift with friends" },
  { icon: Camera, label: "Delivery photo" },
];

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative overflow-hidden pt-12 pb-10 max-sm:pt-7 max-sm:pb-4"
    >
      <Wrap className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] items-center gap-6 max-lg:grid-cols-[minmax(0,1fr)]">
        {/* The badge and headline render without Reveal: they are the first
            paint and the LCP element, so they must not wait for hydration. */}
        <div className="relative z-2 flex min-w-0 flex-col gap-5.5">
          <Badge className="self-start">
            <Icon as={HeartHandshake} size={16} />
            Because love has a deadline
          </Badge>

          <h1
            id="hero-title"
            className="text-[clamp(40px,6.4vw,82px)] leading-none tracking-tighter text-balance"
          >
            Never miss the{" "}
            <span className="font-display italic text-brand font-bold">moments</span>{" "}
            that matter.
          </h1>

          <Reveal
            as="p"
            delay={0.15}
            className="max-w-[30em] text-[16.5px] text-pretty text-muted max-sm:text-[15px]"
          >
            Save the dates. Share your wishlist. Gift together. We make sure it
            lands on the day.
          </Reveal>

          <Reveal delay={0.25} className="flex flex-wrap gap-3">
            <Link
              href="/dates"
              className={cn(
                buttonVariants({ size: "lg" }),
                "max-sm:flex-[1_1_100%]",
              )}
            >
              <Icon as={CalendarHeart} />
              Save a date
            </Link>
            <Link
              href="/wishlists"
              className={cn(
                buttonVariants({ variant: "ghost", size: "lg" }),
                "max-sm:flex-[1_1_100%]",
              )}
            >
              <Icon as={ListPlus} />
              Make a wishlist
            </Link>
          </Reveal>

          <Reveal
            as="ul"
            delay={0.35}
            aria-label="What you get"
            className="flex flex-wrap gap-x-[18px] gap-y-2.5 text-[13px] text-muted"
          >
            {TRUST.map(({ icon, label }) => (
              <li key={label} className="inline-flex items-center gap-1.5">
                <Icon as={icon} size={16} className="text-green" />
                {label}
              </li>
            ))}
          </Reveal>
        </div>

        <HeroStage />
      </Wrap>
    </section>
  );
}
