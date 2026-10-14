import { Check, CreditCard, Layers } from "lucide-react";
import { Btn, Eyebrow, Icon, Reveal, SectionHead, Wrap, cx } from "@/components/ui/primitives";
import { BriefLink } from "@/app/business/_components/BriefLink";
import { PLANS } from "@/app/business/_components/content";

export function Plans() {
  return (
    <section id="plans" aria-labelledby="plans-heading" className="bg-soft py-24 max-sm:py-16">
      <Wrap>
        <Reveal>
          <SectionHead center className="mb-10">
            <Eyebrow tone="brand">
              <Icon as={Layers} size={16} />
              Plans
            </Eyebrow>
            <h2 id="plans-heading" className="font-display text-[clamp(32px,4.4vw,54px)] leading-[1.08]">
              Three ways to work with us
            </h2>
            <p className="text-base text-muted">Start with one. Most companies grow into all three.</p>
          </SectionHead>
        </Reveal>

        <div className="grid grid-cols-3 gap-5 max-lg:grid-cols-1">
          {PLANS.map(({ icon, name, audience, price, perks, cta, featured, occasions }, i) => (
            <Reveal key={name} delay={i * 0.1} className="flex">
            <article
              className={cx(
                "relative flex w-full flex-col gap-4 overflow-hidden rounded-card-lg border-[1.5px] px-[26px] py-[30px] transition-[transform,box-shadow,border-color] duration-250 hover:-translate-y-1.5 hover:border-transparent hover:shadow-float",
                featured
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-line bg-card",
              )}
            >
              {featured && (
                <span className="absolute top-[18px] right-[18px] rounded-full bg-white px-2.5 py-1 text-[11.5px] font-medium text-primary">
                  {featured}
                </span>
              )}
              <span
                className={cx(
                  "grid size-[52px] place-items-center rounded-2xl",
                  featured ? "bg-white/18 text-white" : "bg-brand-light text-brand",
                )}
              >
                <Icon as={icon} size={26} />
              </span>
              <div>
                <h3 className="font-display text-[32px] leading-[1.08]">{name}</h3>
                <p className={cx("text-[13.5px]", featured ? "text-white/85" : "text-muted")}>
                  {audience}
                </p>
              </div>
              <div
                className={cx(
                  "rounded-xl px-3 py-2.5 text-[13px] font-medium",
                  featured ? "bg-white/14" : "bg-soft",
                )}
              >
                {price}
              </div>
              <ul className="flex flex-col gap-2.5">
                {perks.map((perk) => (
                  <li key={perk} className="flex gap-2.5 text-sm leading-[1.45]">
                    <Icon
                      as={Check}
                      size={18}
                      className={cx("mt-px", featured ? "text-white" : "text-success")}
                    />
                    {perk}
                  </li>
                ))}
              </ul>
              <BriefLink
                tone={featured ? "white" : "line"}
                brief={{ occasions, note: `Interested in the ${name} plan. ` }}
                className="mt-auto w-full"
              >
                {cta}
              </BriefLink>
            </article>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-5 flex flex-wrap items-center gap-4 rounded-card-lg border-[1.5px] border-dashed border-brand/25 bg-card px-6 py-5">
          <span className="grid size-[46px] shrink-0 place-items-center rounded-[14px] bg-peach text-orange">
            <Icon as={CreditCard} />
          </span>
          <div className="min-w-[220px] flex-1">
            <b className="block font-semibold">Add gift cards to any plan</b>
            <span className="text-[13.5px] text-muted">
              Let staff pick what they want. Branded with your logo.
            </span>
          </div>
          <Btn as="a" href="#giftcards" tone="ink" size="sm">
            See gift cards
          </Btn>
        </Reveal>
      </Wrap>
    </section>
  );
}
