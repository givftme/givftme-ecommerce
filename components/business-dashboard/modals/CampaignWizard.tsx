"use client";

import { useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { useBizDash, type CampaignWizardOptions } from "@/components/business-dashboard/BizDashContext";
import { Checkbox, Field, Modal, OccasionIcon, Select, Steps } from "@/components/business-dashboard/BizUi";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { saveCampaign, sendForApproval } from "@/lib/business-dashboard/actions";
import { AUDIENCES, DEPARTMENTS, GIFT_TYPES, OCCASIONS, TIGHT_TIMING_DAYS } from "@/lib/business-dashboard/data";
import {
  audienceHeads,
  campaignCost,
  daysTo,
  formatLongDate,
  formatNaira,
  fromIsoDate,
  suggestedDeliveryDate,
  toIsoDate,
} from "@/lib/business-dashboard/utils";
import { campaignSchema } from "@/lib/business-dashboard/validation";
import { cn } from "@/lib/utils";

const STEPS = ["Occasion", "Who & what", "Review"] as const;

function choiceClass(selected: boolean) {
  return cn(
    "flex min-w-0 items-start gap-3 rounded-2xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-brand",
    selected ? "border-brand bg-brand-light" : "border-border bg-card hover:bg-surface",
  );
}

/** New campaign (or edit): occasion → who & what → review. Posts only on the last step. */
export function CampaignWizard({ options, onClose }: { options: CampaignWizardOptions; onClose: () => void }) {
  const { account, people, today, run, toast } = useBizDash();
  const editing = options.campaign;

  const [step, setStep] = useState(0);
  const [occasion, setOccasion] = useState(editing?.occasion ?? options.occasion ?? "");
  const [name, setName] = useState(editing?.name ?? (options.occasion ? `${options.occasion} ${suggestedDeliveryDate(options.occasion, today).getFullYear()}` : ""));
  const [nameTouched, setNameTouched] = useState(Boolean(editing));
  const [audience, setAudience] = useState(editing?.audience ?? options.audience ?? "Everyone");
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [heads, setHeads] = useState(
    String(editing?.heads ?? options.heads ?? (audienceHeads(options.audience ?? "Everyone", people) || 1)),
  );
  const [headsTouched, setHeadsTouched] = useState(Boolean(editing || options.heads));
  const [deliveryDate, setDeliveryDate] = useState(
    editing?.delivery_date ?? toIsoDate(suggestedDeliveryDate(options.occasion ?? "", today)),
  );
  const [dateTouched, setDateTouched] = useState(Boolean(editing));
  const [giftType, setGiftType] = useState(editing?.gift_type ?? GIFT_TYPES[0].label);
  const [perHead, setPerHead] = useState(String(editing?.per_head ?? account.per_head_default));
  const [message, setMessage] = useState(editing?.card_message ?? account.default_message);
  const [toFinance, setToFinance] = useState(!editing || editing.status === "Draft");
  const [saving, setSaving] = useState(false);

  const deliveryFee = editing?.delivery_fee ?? account.delivery_fee;
  const headsNumber = Math.max(0, Math.floor(Number(heads) || 0));
  const perHeadNumber = Math.max(0, Number(perHead) || 0);
  const total = campaignCost({ heads: headsNumber, per_head: perHeadNumber, delivery_fee: deliveryFee });
  const date = deliveryDate ? fromIsoDate(deliveryDate) : null;
  const daysAway = date ? daysTo(date, today) : null;
  const canSendForApproval = !editing || editing.status === "Draft";

  const chooseOccasion = (key: string) => {
    setOccasion(key);
    if (!nameTouched) setName(`${key} ${suggestedDeliveryDate(key, today).getFullYear()}`);
    if (!dateTouched) setDeliveryDate(toIsoDate(suggestedDeliveryDate(key, today)));
    if (!headsTouched) {
      if (key === "Mother's Day") updateAudience("Staff who are mothers");
      else if (key === "Father's Day") updateAudience("Staff who are fathers");
    }
  };

  function updateAudience(next: string, nextDepartment = department) {
    setAudience(next);
    if (!headsTouched) setHeads(String(audienceHeads(next, people, nextDepartment) || 1));
  }

  const step1Error = !occasion ? "Choose an occasion." : !name.trim() ? "Give the campaign a name." : null;
  const step2Error =
    headsNumber < 1
      ? "Add at least one person."
      : !date || daysAway === null || daysAway < 0
        ? "Pick a delivery date from today on."
        : null;

  const submit = async () => {
    const payload = {
      name: name.trim(),
      occasion,
      audience: audience === "One department" ? `${department} department` : audience,
      heads: headsNumber,
      per_head: perHeadNumber,
      delivery_date: deliveryDate,
      gift_type: giftType,
      card_message: message.trim() || undefined,
    };
    const parsed = campaignSchema.safeParse(payload);
    if (!parsed.success) {
      toast(parsed.error.issues[0]?.message || "Check the campaign details.");
      return;
    }

    // Editing a draft and ticking "Send to Finance" is a save, then a send.
    const sendAfterSave = Boolean(editing && toFinance && editing.status === "Draft");
    setSaving(true);
    const result = await run(
      () => saveCampaign(account.id, { ...parsed.data, id: editing?.id, sendForApproval: toFinance }),
      sendAfterSave
        ? undefined
        : editing
          ? "Campaign saved"
          : (data) =>
              data.status === "Approved"
                ? "Campaign created and approved — under your auto-approve amount"
                : data.status === "Pending approval"
                  ? "Campaign created and sent to Finance"
                  : "Campaign saved as a draft",
    );
    if (result.ok && editing && sendAfterSave) {
      await run(
        () => sendForApproval(account.id, editing.id),
        (data) => (data.status === "Approved" ? "Saved and approved — under your auto-approve amount" : "Saved and sent for approval"),
      );
    }
    setSaving(false);
    if (result.ok) onClose();
  };

  const footer = (
    <>
      {step > 0 ? (
        <Button variant="outline" size="sm" onClick={() => setStep(step - 1)} disabled={saving} className="mr-auto">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back
        </Button>
      ) : null}
      {step < 2 ? (
        <Button
          size="sm"
          disabled={Boolean(step === 0 ? step1Error : step2Error)}
          onClick={() => setStep(step + 1)}
        >
          Continue <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Button>
      ) : (
        <Button size="sm" onClick={submit} disabled={saving}>
          {saving ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Check aria-hidden="true" className="h-4 w-4" />}
          {editing ? "Save changes" : "Create campaign"}
        </Button>
      )}
    </>
  );

  return (
    <Modal
      open
      onOpenChange={(open) => !open && !saving && onClose()}
      title={editing ? "Edit campaign" : "New campaign"}
      description={editing ? editing.name : "Three quick steps. Nothing is ordered until it's approved."}
      className="max-w-3xl"
      footer={footer}
    >
      <Steps steps={STEPS} current={step} />

      {step === 0 ? (
        <div className="flex flex-col gap-5">
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-ink">What are you celebrating?</legend>
            <div className="grid grid-cols-1 gap-2 min-[641px]:grid-cols-3">
              {OCCASIONS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={occasion === item.key}
                  onClick={() => chooseOccasion(item.key)}
                  className={choiceClass(occasion === item.key)}
                >
                  <OccasionIcon occasion={item.key} size="sm" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{item.key}</span>
                    <span className="block text-xs text-muted">{item.note}</span>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          <Field label="Campaign name" htmlFor="campaign-name">
            <Input
              id="campaign-name"
              value={name}
              maxLength={200}
              onChange={(event) => {
                setName(event.target.value);
                setNameTouched(true);
              }}
              placeholder="Customer Service Week 2026"
              className="h-11"
            />
          </Field>
          {step1Error && occasion ? <p className="text-xs text-danger">{step1Error}</p> : null}
        </div>
      ) : null}

      {step === 1 ? (
        <div className="flex flex-col gap-5">
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-ink">Who is it for?</legend>
            <div className="grid grid-cols-1 gap-2 min-[641px]:grid-cols-3">
              {AUDIENCES.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  aria-pressed={audience === item.label}
                  onClick={() => updateAudience(item.label)}
                  className={choiceClass(audience === item.label)}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{item.label}</span>
                    <span className="block text-xs text-muted">{item.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 min-[641px]:grid-cols-3">
            {audience === "One department" ? (
              <Field label="Department" htmlFor="campaign-department">
                <Select
                  id="campaign-department"
                  value={department}
                  onChange={(event) => {
                    setDepartment(event.target.value);
                    updateAudience(audience, event.target.value);
                  }}
                >
                  {DEPARTMENTS.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field
              label="How many people"
              htmlFor="campaign-heads"
              hint={
                audience.startsWith("Staff who are") && !headsTouched
                  ? "An estimate from your staff list. Adjust to the real number."
                  : undefined
              }
            >
              <Input
                id="campaign-heads"
                type="number"
                inputMode="numeric"
                min={1}
                value={heads}
                onChange={(event) => {
                  setHeads(event.target.value);
                  setHeadsTouched(true);
                }}
                className="h-11"
              />
            </Field>
            <Field label="Delivery date" htmlFor="campaign-date">
              <Input
                id="campaign-date"
                type="date"
                min={toIsoDate(today)}
                value={deliveryDate}
                onChange={(event) => {
                  setDeliveryDate(event.target.value);
                  setDateTouched(true);
                }}
                className="h-11"
              />
            </Field>
            <Field label="Budget per person (₦)" htmlFor="campaign-per-head" hint={`+ ${formatNaira(deliveryFee)} delivery each`}>
              <Input
                id="campaign-per-head"
                type="number"
                inputMode="numeric"
                min={0}
                step={500}
                value={perHead}
                onChange={(event) => setPerHead(event.target.value)}
                className="h-11"
              />
            </Field>
          </div>

          <fieldset>
            <legend className="mb-2 text-xs font-medium text-ink">What are we sending?</legend>
            <div className="grid grid-cols-1 gap-2 min-[641px]:grid-cols-3">
              {GIFT_TYPES.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  aria-pressed={giftType === item.label}
                  onClick={() => setGiftType(item.label)}
                  className={choiceClass(giftType === item.label)}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{item.label}</span>
                    <span className="block text-xs text-muted">{item.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          {step2Error ? <p className="text-xs text-danger">{step2Error}</p> : null}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-center gap-3">
              <OccasionIcon occasion={occasion} />
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-ink">{name}</p>
                <p className="text-xs text-muted">{occasion}</p>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm min-[641px]:grid-cols-3">
              <div>
                <dt className="text-xs text-muted">Who</dt>
                <dd className="text-ink">{audience === "One department" ? `${department} department` : audience}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">People</dt>
                <dd className="text-ink">{headsNumber}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Delivery</dt>
                <dd className="text-ink">{date ? formatLongDate(date) : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Gift</dt>
                <dd className="text-ink">{giftType}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Per person</dt>
                <dd className="text-ink">{formatNaira(perHeadNumber)} + {formatNaira(deliveryFee)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Estimated total</dt>
                <dd className="text-lg font-bold tabular-nums text-ink">{formatNaira(total)}</dd>
              </div>
            </dl>
          </div>

          {daysAway !== null && daysAway < TIGHT_TIMING_DAYS ? (
            <div role="alert" className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber/30 dark:bg-amber/10 dark:text-amber">
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Tight timing: delivery is {daysAway === 0 ? "today" : `${daysAway} ${daysAway === 1 ? "day" : "days"} away`}. Branded
                gifts usually need {TIGHT_TIMING_DAYS} days. We&apos;ll do our best — approve it quickly.
              </p>
            </div>
          ) : null}

          <Field label="Message on the card" htmlFor="campaign-message" hint={`${message.length}/300`}>
            <Textarea
              id="campaign-message"
              value={message}
              maxLength={300}
              onChange={(event) => setMessage(event.target.value)}
              className="min-h-24"
            />
          </Field>

          {canSendForApproval ? (
            <label className="flex items-center gap-3 text-sm text-ink">
              <Checkbox checked={toFinance} onChange={(event) => setToFinance(event.target.checked)} />
              Send to Finance for approval
            </label>
          ) : editing?.status === "Approved" ? (
            <p className="text-xs text-muted">Saving changes sends this approved campaign back for approval.</p>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
