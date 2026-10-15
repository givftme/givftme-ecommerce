"use client";

import { useState } from "react";
import { Info, Loader2 } from "lucide-react";
import { useBizDash } from "@/components/business-dashboard/BizDashContext";
import { Card, Field, Select, ViewHeader } from "@/components/business-dashboard/BizUi";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { saveReminderSettings, toggleRule } from "@/lib/business-dashboard/actions";
import { REMINDER_CHANNELS, REMINDER_LEAD_DAYS, RULES, type ReminderChannel } from "@/lib/business-dashboard/data";
import { reminderSettingsSchema } from "@/lib/business-dashboard/validation";

/** Automatic gifting rules and who gets the reminders. */
export function BizRules() {
  const { account, rules, member, can, run, toast } = useBizDash();
  const canToggle = can("edit_campaigns");
  const canSettings = can("manage_team");

  // Optimistic: the switch moves at once and snaps back if the save fails.
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const state = (key: string) => optimistic[key] ?? rules[key];

  const [contact, setContact] = useState(account.reminder_contact ?? member.full_name);
  const [ccEmail, setCcEmail] = useState(account.reminder_cc_email ?? "");
  const [channel, setChannel] = useState<ReminderChannel>(account.reminder_channel);
  const [autoApprove, setAutoApprove] = useState(String(account.auto_approve_under || ""));
  const [saving, setSaving] = useState(false);

  const toggle = async (key: string, enabled: boolean) => {
    setOptimistic((current) => ({ ...current, [key]: enabled }));
    const result = await run(() => toggleRule(account.id, key, enabled), enabled ? "Rule on" : "Rule off");
    setOptimistic((current) => {
      const next = { ...current };
      delete next[key];
      if (!result.ok) return next;
      return { ...next, [key]: enabled };
    });
  };

  const saveSettings = async () => {
    const parsed = reminderSettingsSchema.safeParse({
      reminder_contact: contact,
      reminder_cc_email: ccEmail,
      reminder_channel: channel,
      auto_approve_under: Number(autoApprove) || 0,
    });
    if (!parsed.success) {
      toast(parsed.error.issues[0]?.message || "Check the reminder settings.");
      return;
    }
    setSaving(true);
    await run(() => saveReminderSettings(account.id, parsed.data), "Reminder settings saved");
    setSaving(false);
  };

  return (
    <>
      <ViewHeader title="Automatic rules" description="Set it once. We'll plan the gift and ask before anything goes out." />

      <div className="grid gap-4 md:gap-6 min-[1001px]:grid-cols-[1.4fr_1fr]">
        <Card bodyClassName="p-0">
          <ul className="divide-y divide-border">
            {RULES.map((rule) => (
              <li key={rule.key} className="flex items-start gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p id={`rule-${rule.key}`} className="text-sm font-semibold text-ink">{rule.title}</p>
                  <p className="mt-0.5 text-xs text-muted">{rule.desc}</p>
                </div>
                <Switch
                  checked={state(rule.key)}
                  disabled={!canToggle}
                  aria-labelledby={`rule-${rule.key}`}
                  onCheckedChange={(enabled) => toggle(rule.key, enabled)}
                  className="mt-0.5 shrink-0 duration-200 [&>span]:duration-200"
                />
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Who gets the reminders">
          <div className="flex flex-col gap-4">
            <Field label="Main contact" htmlFor="rules-contact">
              <Input id="rules-contact" value={contact} onChange={(event) => setContact(event.target.value)} disabled={!canSettings} className="h-11" />
            </Field>
            <Field label="Copy on everything" htmlFor="rules-cc">
              <Input
                id="rules-cc"
                type="email"
                value={ccEmail}
                onChange={(event) => setCcEmail(event.target.value)}
                placeholder="finance@company.com"
                disabled={!canSettings}
                className="h-11"
              />
            </Field>
            <Field label="How we reach you" htmlFor="rules-channel">
              <Select id="rules-channel" value={channel} onChange={(event) => setChannel(event.target.value as ReminderChannel)} disabled={!canSettings}>
                {REMINDER_CHANNELS.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </Field>
            <Field label="Auto-approve under (₦)" htmlFor="rules-auto" hint="Campaigns below this total skip Finance. Leave empty to approve everything by hand.">
              <Input
                id="rules-auto"
                type="number"
                inputMode="numeric"
                min={0}
                step={1000}
                value={autoApprove}
                onChange={(event) => setAutoApprove(event.target.value)}
                disabled={!canSettings}
                className="h-11"
              />
            </Field>
            <p className="flex gap-2 rounded-xl bg-surface p-3 text-xs text-muted">
              <Info aria-hidden="true" className="h-4 w-4 shrink-0" />
              Reminders go out {REMINDER_LEAD_DAYS.slice(0, -1).join(", ")} and {REMINDER_LEAD_DAYS.at(-1)} days before anything branded.
            </p>
            {canSettings ? (
              <Button size="sm" className="w-fit" onClick={saveSettings} disabled={saving}>
                {saving ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            ) : (
              <p className="text-xs text-muted">Only an admin can change these.</p>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
