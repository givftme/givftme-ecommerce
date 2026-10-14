"use client";

import { useState } from "react";
import { Calculator, Headset, Sparkles } from "lucide-react";
import { Eyebrow, Icon, Reveal, Wrap } from "@/components/ui/primitives";
import { estimateGiftingYear, type PlannerOccasion } from "@/lib/business/planner";
import { teamSizeFor } from "@/lib/business/validation";
import { formatPrice } from "@/lib/utils";
import { BriefLink } from "@/app/business/_components/BriefLink";
import { PLANNER_CHOICES } from "@/app/business/_components/content";

const statClass = "rounded-2xl bg-soft p-3.5";
const statValueClass = "block text-[22px] leading-[1.2] font-semibold tracking-tight tabular-nums wrap-anywhere";

export function BudgetPlanner() {
  const [team, setTeam] = useState(60);
  const [budget, setBudget] = useState(20000);
  const [occasions, setOccasions] = useState<PlannerOccasion[]>(() =>
    PLANNER_CHOICES.filter((choice) => choice.checked).map((choice) => choice.value),
  );

  const estimate = estimateGiftingYear(team, budget, occasions);

  const toggle = (value: PlannerOccasion, checked: boolean) =>
    setOccasions((current) =>
      checked ? [...current, value] : current.filter((occasion) => occasion !== value),
    );

  return (
    <section aria-labelledby="planner-heading" className="pb-24 max-sm:pb-16">
      <Wrap>
        <Reveal className="relative grid grid-cols-2 gap-9 overflow-hidden rounded-card-xl bg-brand-gradient p-11 text-white max-lg:grid-cols-1 max-sm:px-4.5 max-sm:py-6.5">
          <div
            aria-hidden="true"
            className="absolute -right-30 -bottom-45 size-95 rounded-full border-60 border-white/8"
          />
          <div className="relative z-1 flex min-w-0 flex-col gap-4.5">
            <Eyebrow tone="white">
              <Icon as={Calculator} size={16} />
              Budget planner
            </Eyebrow>
            <h2 id="planner-heading" className="font-display text-[clamp(30px,3.6vw,46px)] leading-[1.08]">
              What will a year of gifting cost?
            </h2>
            <p className="opacity-90">
              Move the sliders. Tick your occasions. Get a rough budget in seconds.
            </p>
          </div>

          <div className="relative z-1 flex flex-col gap-4 rounded-card-lg bg-card p-5.5 text-foreground max-sm:p-4">
            <Range
              id="planner-team"
              label="Team size"
              display={String(team)}
              min={5}
              max={1000}
              step={5}
              value={team}
              onChange={setTeam}
            />
            <Range
              id="planner-budget"
              label="Budget per gift"
              display={formatPrice(budget)}
              min={5000}
              max={150000}
              step={2500}
              value={budget}
              onChange={setBudget}
            />

            <fieldset className="flex flex-wrap gap-2">
              <legend className="sr-only">Occasions</legend>
              {PLANNER_CHOICES.map(({ value, label }) => (
                <label
                  key={value}
                  className="inline-flex h-9.5 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-line px-3 text-[12.5px] font-medium select-none has-checked:border-brand has-checked:bg-brand-light has-checked:text-brand"
                >
                  <input
                    type="checkbox"
                    checked={occasions.includes(value)}
                    onChange={(e) => toggle(value, e.target.checked)}
                    className="size-4 accent-brand"
                  />
                  {label}
                </label>
              ))}
            </fieldset>

            <div aria-live="polite" className="grid grid-cols-2 gap-2.5">
              <div className={statClass}>
                <span className="block text-xs text-muted">Gifts a year</span>
                <b className={statValueClass}>{estimate.gifts.toLocaleString("en-NG")}</b>
              </div>
              <div className={statClass}>
                <span className="block text-xs text-muted">Estimated budget</span>
                <b className={statValueClass}>{formatPrice(estimate.total)}</b>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-[14px] bg-ink-deep px-3.5 py-3 text-[13.5px] text-white">
              <Icon as={Sparkles} size={16} />
              <span>
                Best fit: <b className="font-semibold">{estimate.plan}</b>
              </span>
            </div>

            <p className="text-[11.5px] text-muted">
              Rough estimate from your inputs. Your final quote comes from the Experience Centre.
            </p>

            <BriefLink
              brief={{
                note: `Budget planner: team of ${team}, about ${formatPrice(budget)} per gift, ${estimate.plan}. `,
                teamSize: teamSizeFor(team),
              }}
            >
              <Icon as={Headset} size={16} />
              Get my quote
            </BriefLink>
          </div>
        </Reveal>
      </Wrap>
    </section>
  );
}

function Range({
  id,
  label,
  display,
  value,
  onChange,
  ...bounds
}: {
  id: string;
  label: string;
  display: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px] text-muted">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
          {display}
        </output>
      </div>
      <input
        id={id}
        type="range"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-7 w-full accent-brand"
        {...bounds}
      />
    </div>
  );
}
