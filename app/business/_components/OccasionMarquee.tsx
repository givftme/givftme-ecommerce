import { Track } from "@/app/_components/home/Marquees";
import { MARQUEE_ITEMS } from "@/app/business/_components/content";

export function OccasionMarquee() {
  return (
    <div
      aria-label="What companies send with Givftme"
      className="group overflow-hidden border-y border-line bg-card py-4"
    >
      <Track items={MARQUEE_ITEMS} />
    </div>
  );
}
