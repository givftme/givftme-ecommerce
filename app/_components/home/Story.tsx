import { Quote } from "lucide-react";
import { Eyebrow, Icon, Wrap } from "@/components/ui/primitives";
import { ZoomImage } from "./ZoomImage";

export default function Story() {
  return (
    <section aria-label="Why we exist" className="pb-24 max-sm:pb-16">
      <Wrap>
        <div className="relative flex min-h-115 items-end overflow-hidden rounded-card-xl bg-ink-deep text-white max-sm:min-h-105 after:absolute after:inset-0 after:bg-[linear-gradient(180deg,rgba(0,0,0,0.15),rgba(0,0,0,0.72))] after:content-['']">
          <ZoomImage
            src="/images/hero-carousel-image-01.png"
            alt="A family celebrating a shared meal together"
            sizes="(min-width: 1240px) 1180px, 100vw"
          />
          <figure className="relative z-2 m-0 flex max-w-190 flex-col gap-4 p-12 max-sm:px-5.5 max-sm:py-7">
            <Eyebrow className="text-amber">
              <Icon as={Quote} size={16} />
              Why we exist
            </Eyebrow>
            <blockquote className="m-0 font-display text-[clamp(26px,3.2vw,40px)] leading-[1.2]">
              “I promised my mentor a watch. I kept putting it off. Then he
              died.”
            </blockquote>
            <figcaption className="flex flex-col gap-2">
              <p className="text-[15px] opacity-90">
                Givtme exists so no one finds out too late that they left it too
                long.
              </p>
              <cite className="text-[13px] not-italic opacity-80">
                [Founder name], Founder
              </cite>
            </figcaption>
          </figure>
        </div>
      </Wrap>
    </section>
  );
}
