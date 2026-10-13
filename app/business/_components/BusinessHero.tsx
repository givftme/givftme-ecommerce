import { Building2, CakeSlice, CreditCard, Gift, Headset, Layers, Package } from "lucide-react";
import { Badge, Btn, Icon, Reveal, Wrap } from "@/components/ui/primitives";
import { BrandStudio } from "@/app/business/_components/BrandStudio";
import { EXPERIENCE_CENTRE_HREF } from "@/app/business/_components/BriefLink";

const PRODUCT_CHIPS = [
  { icon: CakeSlice, label: "Branded cakes" },
  { icon: Package, label: "Custom cake packs" },
  { icon: CreditCard, label: "Gift cards" },
  { icon: Gift, label: "Hampers" },
];

export function BusinessHero() {
  return (
    <section
      id="studio"
      aria-labelledby="business-hero-title"
      className="relative overflow-hidden pt-11 pb-14 max-sm:pt-6.5 max-sm:pb-10"
    >
      <Wrap className="grid grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] items-center gap-9 max-lg:grid-cols-1">
        <div className="flex min-w-0 flex-col gap-5.5">
          <Badge className="self-start">
            <Icon as={Building2} size={16} />
            Givftme for Business
          </Badge>

          {/* Each line slides up from behind its own mask. CSS-only, so the
              headline animates before hydration. */}
          <h1
            id="business-hero-title"
            className="text-[clamp(40px,5.8vw,76px)] leading-[1.02] tracking-tighter"
          >
            <span className="block overflow-hidden pb-[0.08em]">
              <span className="block animate-line-up">
                Your <span className="font-display font-bold text-brand italic">brand</span> on every
              </span>
            </span>
            <span className="block overflow-hidden pb-[0.08em]">
              <span className="block animate-line-up [animation-delay:120ms]">
                cake, box and card.
              </span>
            </span>
          </h1>

          <Reveal
            as="p"
            delay={0.3}
            className="max-w-[30em] text-[16.5px] text-muted max-sm:text-[15px]"
          >
            Team birthdays, Customer Service Week, executive gifts, end-of-year packages. Branded,
            delivered on the day, one invoice.
          </Reveal>

          <Reveal delay={0.4} className="flex flex-wrap gap-3">
            <Btn as="a" href={EXPERIENCE_CENTRE_HREF} tone="brand" magnetic className="max-sm:flex-[1_1_100%]">
              <Icon as={Headset} />
              Talk to the Experience Centre
            </Btn>
            <Btn as="a" href="#plans" tone="line" magnetic className="max-sm:flex-[1_1_100%]">
              <Icon as={Layers} />
              See plans
            </Btn>
          </Reveal>

          <Reveal as="ul" delay={0.5} aria-label="What we brand" className="flex flex-wrap gap-2">
            {PRODUCT_CHIPS.map(({ icon, label }) => (
              <li
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-[7px] text-[12.5px] text-muted"
              >
                <Icon as={icon} size={15} className="text-brand" />
                {label}
              </li>
            ))}
          </Reveal>
        </div>

        <Reveal delay={0.2} className="min-w-0">
          <BrandStudio />
        </Reveal>
      </Wrap>
    </section>
  );
}
