import { Camera, Clock, Gift, PackageCheck, PenLine } from "lucide-react";
import { Eyebrow, Icon, Reveal, Wrap } from "@/components/ui/primitives";
import { DiasporaCard } from "./DiasporaCard";
import { MomentPhoto } from "./MomentPhoto";

const PROMISES = [
  { icon: Clock, title: "On the day", body: "Never the day after." },
  { icon: Gift, title: "Wrapped properly", body: "First impressions count." },
  { icon: PenLine, title: "Your words", body: "Your note goes with it." },
  {
    icon: Camera,
    title: "A photo back",
    body: "See their face, wherever you are.",
  },
];

export default function Moments() {
  return (
    <section aria-labelledby="moment-heading" className="py-24 max-sm:py-16">
      <Wrap>
        <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] items-center gap-14 max-lg:grid-cols-1">
          <MomentPhoto />

          <Reveal delay={0.1} className="flex min-w-0 flex-col gap-[18px]">
            <Eyebrow>
              <Icon as={PackageCheck} size={16} />
              The moment
            </Eyebrow>
            <h2 id="moment-heading" className="text-[clamp(32px,4.2vw,52px)]">
              The gift is the object. The moment is the point.
            </h2>
            <ul className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              {PROMISES.map(({ icon, title, body }) => (
                <li
                  key={title}
                  className="flex flex-col gap-2 rounded-[18px] border border-line p-4"
                >
                  <Icon as={icon} className="text-red" />
                  <b className="text-sm font-semibold">{title}</b>
                  <span className="text-[13px] leading-[1.45] text-muted">
                    {body}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <DiasporaCard />
      </Wrap>
    </section>
  );
}
