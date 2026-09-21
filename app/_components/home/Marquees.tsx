import {
  type LucideIcon,
  Award,
  Baby,
  Cake,
  Church,
  Gem,
  GraduationCap,
  Heart,
  HeartHandshake,
  Home,
  Moon,
  PartyPopper,
  Plane,
} from "lucide-react";
import { Icon, cx } from "@/components/ui/primitives";

interface Occasion {
  icon: LucideIcon;
  label: string;
}

const OCCASIONS: Occasion[] = [
  { icon: Baby, label: "Naming ceremony" },
  { icon: HeartHandshake, label: "Omugwo" },
  { icon: Gem, label: "Introduction" },
  { icon: Church, label: "White wedding" },
  { icon: PartyPopper, label: "Detty December" },
  { icon: Moon, label: "Sallah" },
  { icon: Plane, label: "Japa send-off" },
  { icon: GraduationCap, label: "Convocation" },
  { icon: Award, label: "NYSC passing out" },
  { icon: Home, label: "New house" },
  { icon: Cake, label: "Birthdays" },
  { icon: Heart, label: "Val’s Day" },
];

/**
 * The track holds two copies of the list and slides exactly -50%, so the
 * loop is seamless. Items use a trailing margin rather than flex `gap` so both
 * copies are exactly the same width, which keeps the seam from jumping.
 */
function Track({
  items,
  reversed = false,
}: {
  items: Occasion[];
  reversed?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex w-max group-hover:[animation-play-state:paused] motion-reduce:animate-none",
        reversed ? "animate-scroll-x-rev" : "animate-scroll-x",
      )}
    >
      {[0, 1].map((copy) =>
        items.map(({ icon, label }) => (
          <span
            key={`${copy}-${label}`}
            className={cx(
              "mr-3.5 inline-flex items-center gap-2.5 whitespace-nowrap rounded-full border px-[18px] py-2.5 font-display text-xl max-sm:px-3.5 max-sm:py-2 max-sm:text-[17px]",
              reversed
                ? "border-white/30 bg-transparent text-white"
                : "border-line bg-white text-ink",
            )}
          >
            <Icon as={icon} className={reversed ? "text-brand-light" : "text-brand"} />
            {label}
          </span>
        )),
      )}
    </div>
  );
}

export default function Marquees() {
  return (
    <>
      <div
        aria-label="Occasions we cover"
        className="group overflow-hidden border-y border-line bg-white py-4"
      >
        <Track items={OCCASIONS} />
      </div>
      <div
        aria-hidden="true"
        className="group overflow-hidden border-b border-line bg-brand py-4"
      >
        <Track items={[...OCCASIONS].reverse()} reversed />
      </div>
    </>
  );
}
