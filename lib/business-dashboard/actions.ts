"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { checkBusinessMember } from "@/lib/business-dashboard/auth";
import { type GiftTier, TIERS } from "@/lib/business-dashboard/data";
import { NO_PERMISSION_MESSAGE, SAVE_FAILED_MESSAGE, type BusinessPermission } from "@/lib/business-dashboard/permissions";
import { getBusinessAccount, listBusinessPeople } from "@/lib/business-dashboard/queries";
import type { ActionResult, BusinessMember, PersonKind } from "@/lib/business-dashboard/types";
import { campaignCost, daysTo, nextOccurrence } from "@/lib/business-dashboard/utils";
import {
  brandSchema,
  budgetSchema,
  campaignSchema,
  importRequestSchema,
  personKindSchema,
  personSchema,
  reminderSettingsSchema,
  ruleKeySchema,
  teamMemberUpdateSchema,
  type BrandValues,
  type CampaignValues,
  type PersonValues,
  type ReminderSettingsValues,
} from "@/lib/business-dashboard/validation";
import { currentRequestEventFields, recordRequestEvent } from "@/lib/events/server";
import { createServiceClient } from "@/lib/supabase/server";

// Every server action for /business-dashboard (spec "Server Actions"). Each
// one resolves the session, checks the caller is a business_user of
// `accountId` with the needed permission, then writes with the service role,
// always filtered by account_id. Callers refresh the router on success.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const INSERT_CHUNK = 500;
const fail = (error: string) => ({ ok: false, error }) as const;

async function authorize(accountId: string, permission?: BusinessPermission) {
  if (typeof accountId !== "string" || !accountId) return { member: null, error: NO_PERMISSION_MESSAGE } as const;
  const check = await checkBusinessMember(accountId, permission);
  return check.ok ? ({ member: check.member, error: null } as const) : ({ member: null, error: check.error } as const);
}

type PersonRow = {
  id: string;
  kind: PersonKind;
  bday: string;
  start_date: string | null;
};

/**
 * Business birthdays and start dates count as saved dates for the admin
 * Growth and Calendar screens, attributed to the company via props.account_id.
 * Inserted in bulk because an import can carry thousands of rows; a lost
 * analytics row never fails the import.
 */
async function recordDateSavedEvents(service: SupabaseClient, member: BusinessMember, people: PersonRow[]) {
  if (!people.length) return;
  try {
    const fields = await currentRequestEventFields();
    const base = {
      event: "date_saved",
      user_id: member.user_id,
      anon_id: fields.anonId ?? null,
      session_id: fields.sessionId ?? null,
      device: fields.context?.device ?? null,
      platform: "web",
      city: fields.context?.city ?? null,
      ...(fields.context?.country ? { country: fields.context.country } : {}),
    };
    const rows = people.flatMap((person) => {
      const birthday = {
        ...base,
        props: {
          account_id: member.account_id,
          source: "business",
          person_id: person.id,
          kind: person.kind,
          occasion: "birthday",
          relationship: person.kind === "staff" ? "colleague" : "client",
          days_until: daysTo(nextOccurrence(person.bday)),
        },
      };
      if (!person.start_date) return [birthday];
      return [
        birthday,
        {
          ...base,
          props: {
            account_id: member.account_id,
            source: "business",
            person_id: person.id,
            kind: person.kind,
            occasion: "work_anniversary",
            relationship: "colleague",
            start_date: person.start_date,
          },
        },
      ];
    });
    for (let index = 0; index < rows.length; index += INSERT_CHUNK) {
      const { error } = await service.from("events").insert(rows.slice(index, index + INSERT_CHUNK));
      if (error) {
        console.error("Could not record business date_saved events.", error);
        return;
      }
    }
  } catch (error) {
    console.error("Could not record business date_saved events.", error);
  }
}

/** Kind-specific columns; the other kind's columns are always cleared. */
function personColumns(person: PersonValues, kind: PersonKind) {
  const startDate = person.start_date && ISO_DATE.test(person.start_date) ? person.start_date : null;
  return {
    name: person.name.trim().replace(/\s+/g, " "),
    bday: person.bday,
    tier: person.tier,
    department: kind === "staff" ? person.department?.trim() || "Unassigned" : null,
    role_title: kind === "staff" ? person.role_title?.trim() || null : null,
    start_date: kind === "staff" ? startDate : null,
    company: kind === "client" ? person.company?.trim() || null : null,
    relationship: kind === "client" ? person.relationship?.trim() || "Client" : null,
    account_owner: kind === "client" ? person.account_owner?.trim() || null : null,
  };
}

function validMmdd(mmdd: string) {
  const [month, day] = mmdd.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(2000, month, 0).getDate();
}

// --- People -----------------------------------------------------------------

/** Bulk insert into business_people, skipping names already on file. */
export async function importPeople(
  accountId: string,
  people: unknown[],
  kind: PersonKind,
): Promise<ActionResult<{ inserted: number; skipped: number }>> {
  const { member, error } = await authorize(accountId, "edit_people");
  if (!member) return fail(error);

  const parsed = importRequestSchema.safeParse({ kind, people });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Check the rows and try again.");
  if (parsed.data.people.some((person) => !validMmdd(person.bday))) return fail("One of the birthdays isn't a real date.");

  try {
    const service = createServiceClient();
    const existing = await listBusinessPeople(service, accountId);
    const seen = new Set(
      existing.filter((row) => row.kind === parsed.data.kind).map((row) => row.name.trim().toLowerCase()),
    );
    const rows = [];
    for (const person of parsed.data.people) {
      const key = person.name.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        account_id: accountId,
        kind: parsed.data.kind,
        ...personColumns(
          {
            ...person,
            department: person.department ?? undefined,
            role_title: person.role_title ?? undefined,
            start_date: person.start_date ?? undefined,
            company: person.company ?? undefined,
            relationship: person.relationship ?? undefined,
            account_owner: person.account_owner ?? undefined,
          },
          parsed.data.kind,
        ),
      });
    }

    const inserted: PersonRow[] = [];
    for (let index = 0; index < rows.length; index += INSERT_CHUNK) {
      const { data, error: insertError } = await service
        .from("business_people")
        .insert(rows.slice(index, index + INSERT_CHUNK))
        .select("id, kind, bday, start_date");
      if (insertError) throw new Error(insertError.message);
      inserted.push(...((data || []) as PersonRow[]));
    }

    await recordRequestEvent({
      event: "business.people.imported",
      userId: member.user_id,
      props: { account_id: accountId, count: inserted.length, kind: parsed.data.kind },
    });
    await recordDateSavedEvents(service, member, inserted);

    return { ok: true, data: { inserted: inserted.length, skipped: parsed.data.people.length - inserted.length } };
  } catch (cause) {
    console.error("Could not import business people.", cause);
    return fail(SAVE_FAILED_MESSAGE);
  }
}

/** Adds a person (no id) or updates one (with id) in business_people. */
export async function upsertPerson(
  accountId: string,
  person: PersonValues & { id?: string; kind: PersonKind },
): Promise<ActionResult<{ id: string }>> {
  const { member, error } = await authorize(accountId, "edit_people");
  if (!member) return fail(error);

  const kind = personKindSchema.safeParse(person?.kind);
  const parsed = personSchema.safeParse(person);
  if (!kind.success || !parsed.success) return fail(parsed.error?.issues[0]?.message || "Check the details and try again.");
  if (!validMmdd(parsed.data.bday)) return fail("That birthday isn't a real date.");
  if (parsed.data.start_date && !ISO_DATE.test(parsed.data.start_date)) return fail("Pick a valid start date.");

  try {
    const service = createServiceClient();
    const columns = personColumns(parsed.data, kind.data);

    if (person.id) {
      const { data, error: updateError } = await service
        .from("business_people")
        .update(columns)
        .eq("id", person.id)
        .eq("account_id", accountId)
        .eq("active", true)
        .select("id")
        .maybeSingle();
      if (updateError) throw new Error(updateError.message);
      if (!data) return fail("That person is no longer on file.");
      return { ok: true, data: { id: data.id } };
    }

    const { data, error: insertError } = await service
      .from("business_people")
      .insert({ account_id: accountId, kind: kind.data, ...columns })
      .select("id, kind, bday, start_date")
      .single();
    if (insertError) throw new Error(insertError.message);
    await recordDateSavedEvents(service, member, [data as PersonRow]);
    return { ok: true, data: { id: data.id } };
  } catch (cause) {
    console.error("Could not save business person.", cause);
    return fail(SAVE_FAILED_MESSAGE);
  }
}

/** Soft delete: sets active=false on one person or several. */
export async function deletePerson(accountId: string, personId: string | string[]): Promise<ActionResult<{ removed: number }>> {
  const { member, error } = await authorize(accountId, "edit_people");
  if (!member) return fail(error);

  const ids = (Array.isArray(personId) ? personId : [personId]).filter((id) => typeof id === "string" && id);
  if (!ids.length) return fail("Choose someone to remove.");

  try {
    const { data, error: updateError } = await createServiceClient()
      .from("business_people")
      .update({ active: false })
      .eq("account_id", accountId)
      .in("id", ids)
      .select("id");
    if (updateError) throw new Error(updateError.message);
    return { ok: true, data: { removed: (data || []).length } };
  } catch (cause) {
    console.error("Could not remove business people.", cause);
    return fail(SAVE_FAILED_MESSAGE);
  }
}

/** The Staff table's bulk "Set gift tier". */
export async function setPeopleTier(accountId: string, personIds: string[], tier: GiftTier): Promise<ActionResult<{ updated: number }>> {
  const { member, error } = await authorize(accountId, "edit_people");
  if (!member) return fail(error);
  if (!TIERS.includes(tier)) return fail("Choose a gift tier.");
  const ids = (Array.isArray(personIds) ? personIds : []).filter((id) => typeof id === "string" && id);
  if (!ids.length) return fail("Choose someone first.");

  try {
    const { data, error: updateError } = await createServiceClient()
      .from("business_people")
      .update({ tier })
      .eq("account_id", accountId)
      .eq("active", true)
      .in("id", ids)
      .select("id");
    if (updateError) throw new Error(updateError.message);
    return { ok: true, data: { updated: (data || []).length } };
  } catch (cause) {
    console.error("Could not set business gift tier.", cause);
    return fail(SAVE_FAILED_MESSAGE);
  }
}

// --- Campaigns --------------------------------------------------------------

/**
 * A campaign sent for approval whose total is under the account's
 * "Auto-approve under" amount skips the queue.
 */
function submittedStatus(cost: number, autoApproveUnder: number) {
  return autoApproveUnder > 0 && cost < autoApproveUnder ? "Approved" : "Pending approval";
}

async function recordApproved(member: BusinessMember, campaignId: string, value: number, auto: boolean) {
  await recordRequestEvent({
    event: "business.campaign.approved",
    userId: member.user_id,
    props: { account_id: member.account_id, campaign_id: campaignId, value, auto },
  });
}

/**
 * Creates a campaign (no id) or edits one. New campaigns start as Draft, or
 * go for approval when `sendForApproval` is set. Editing an approved
 * campaign sends it back for approval, since its cost may have changed.
 */
export async function saveCampaign(
  accountId: string,
  campaign: CampaignValues & { id?: string; sendForApproval?: boolean },
): Promise<ActionResult<{ id: string; status: string }>> {
  const { member, error } = await authorize(accountId, "edit_campaigns");
  if (!member) return fail(error);

  const parsed = campaignSchema.safeParse(campaign);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Check the campaign details and try again.");
  if (!ISO_DATE.test(parsed.data.delivery_date.slice(0, 10))) return fail("Pick a delivery date.");

  try {
    const service = createServiceClient();
    const account = await getBusinessAccount(service, accountId);
    const columns = {
      name: parsed.data.name,
      occasion: parsed.data.occasion,
      audience: parsed.data.audience,
      heads: parsed.data.heads,
      per_head: parsed.data.per_head,
      delivery_date: parsed.data.delivery_date.slice(0, 10),
      gift_type: parsed.data.gift_type,
      card_message: parsed.data.card_message?.trim() || null,
    };

    if (campaign.id) {
      const { data: current, error: currentError } = await service
        .from("business_campaigns")
        .select("id, status, delivery_fee, owner")
        .eq("id", campaign.id)
        .eq("account_id", accountId)
        .maybeSingle();
      if (currentError) throw new Error(currentError.message);
      if (!current) return fail("That campaign no longer exists.");
      if (current.status === "Delivered") return fail("Delivered campaigns can't be edited.");
      if (member.role === "limited" && current.owner !== member.full_name) return fail(NO_PERMISSION_MESSAGE);

      const cost = campaignCost({ ...columns, delivery_fee: Number(current.delivery_fee) });
      const status = current.status === "Approved"
        ? submittedStatus(cost, account.auto_approve_under)
        : current.status;
      const { error: updateError } = await service
        .from("business_campaigns")
        .update({ ...columns, status })
        .eq("id", campaign.id)
        .eq("account_id", accountId);
      if (updateError) throw new Error(updateError.message);
      return { ok: true, data: { id: campaign.id, status } };
    }

    const cost = campaignCost({ ...columns, delivery_fee: account.delivery_fee });
    const status = campaign.sendForApproval ? submittedStatus(cost, account.auto_approve_under) : "Draft";
    const { data, error: insertError } = await service
      .from("business_campaigns")
      .insert({
        account_id: accountId,
        ...columns,
        delivery_fee: account.delivery_fee,
        status,
        owner: member.full_name,
      })
      .select("id")
      .single();
    if (insertError) throw new Error(insertError.message);

    await recordRequestEvent({
      event: "business.campaign.created",
      userId: member.user_id,
      props: {
        account_id: accountId,
        campaign_id: data.id,
        occasion: columns.occasion,
        heads: columns.heads,
        value: cost,
        status,
      },
    });
    if (status === "Approved") await recordApproved(member, data.id, cost, true);
    return { ok: true, data: { id: data.id, status } };
  } catch (cause) {
    console.error("Could not save business campaign.", cause);
    return fail(SAVE_FAILED_MESSAGE);
  }
}

export async function deleteCampaign(accountId: string, campaignId: string): Promise<ActionResult> {
  const { member, error } = await authorize(accountId, "edit_campaigns");
  if (!member) return fail(error);

  try {
    let query = createServiceClient()
      .from("business_campaigns")
      .delete()
      .eq("id", campaignId)
      .eq("account_id", accountId);
    if (member.role === "limited") query = query.eq("owner", member.full_name);
    const { error: deleteError } = await query;
    if (deleteError) throw new Error(deleteError.message);
    return { ok: true, data: null };
  } catch (cause) {
    console.error("Could not delete business campaign.", cause);
    return fail(SAVE_FAILED_MESSAGE);
  }
}

/** Pending approval → Approved. */
export async function approveCampaign(accountId: string, campaignId: string): Promise<ActionResult> {
  const { member, error } = await authorize(accountId, "approve_campaigns");
  if (!member) return fail(error);

  try {
    const { data, error: updateError } = await createServiceClient()
      .from("business_campaigns")
      .update({ status: "Approved" })
      .eq("id", campaignId)
      .eq("account_id", accountId)
      .eq("status", "Pending approval")
      .select("id, heads, per_head, delivery_fee")
      .maybeSingle();
    if (updateError) throw new Error(updateError.message);
    if (!data) return fail("That campaign isn't waiting for approval any more.");
    await recordApproved(member, data.id, campaignCost({
      heads: Number(data.heads),
      per_head: Number(data.per_head),
      delivery_fee: Number(data.delivery_fee),
    }), false);
    return { ok: true, data: null };
  } catch (cause) {
    console.error("Could not approve business campaign.", cause);
    return fail(SAVE_FAILED_MESSAGE);
  }
}

/** Draft → Pending approval (or straight to Approved under the auto-approve amount). */
export async function sendForApproval(accountId: string, campaignId: string): Promise<ActionResult<{ status: string }>> {
  const { member, error } = await authorize(accountId, "edit_campaigns");
  if (!member) return fail(error);

  try {
    const service = createServiceClient();
    const account = await getBusinessAccount(service, accountId);
    const { data: current, error: currentError } = await service
      .from("business_campaigns")
      .select("id, heads, per_head, delivery_fee, owner")
      .eq("id", campaignId)
      .eq("account_id", accountId)
      .eq("status", "Draft")
      .maybeSingle();
    if (currentError) throw new Error(currentError.message);
    if (!current) return fail("Only draft campaigns can be sent for approval.");
    if (member.role === "limited" && current.owner !== member.full_name) return fail(NO_PERMISSION_MESSAGE);

    const cost = campaignCost({
      heads: Number(current.heads),
      per_head: Number(current.per_head),
      delivery_fee: Number(current.delivery_fee),
    });
    const status = submittedStatus(cost, account.auto_approve_under);
    const { error: updateError } = await service
      .from("business_campaigns")
      .update({ status })
      .eq("id", campaignId)
      .eq("account_id", accountId)
      .eq("status", "Draft");
    if (updateError) throw new Error(updateError.message);
    if (status === "Approved") await recordApproved(member, campaignId, cost, true);
    return { ok: true, data: { status } };
  } catch (cause) {
    console.error("Could not send business campaign for approval.", cause);
    return fail(SAVE_FAILED_MESSAGE);
  }
}

// --- Rules, brand, reminders, budget, team -----------------------------------

/** Upserts one automatic rule's on/off state. */
export async function toggleRule(accountId: string, ruleKey: string, enabled: boolean): Promise<ActionResult> {
  const { member, error } = await authorize(accountId, "edit_campaigns");
  if (!member) return fail(error);
  const key = ruleKeySchema.safeParse(ruleKey);
  if (!key.success || typeof enabled !== "boolean") return fail("That rule doesn't exist.");

  try {
    const { error: upsertError } = await createServiceClient()
      .from("business_rules")
      .upsert({ account_id: accountId, rule_key: key.data, enabled }, { onConflict: "account_id,rule_key" });
    if (upsertError) throw new Error(upsertError.message);
    return { ok: true, data: null };
  } catch (cause) {
    console.error("Could not toggle business rule.", cause);
    return fail(SAVE_FAILED_MESSAGE);
  }
}

/** Company name, brand colour, logo and default card message. */
export async function saveBrand(accountId: string, brand: BrandValues): Promise<ActionResult> {
  const { member, error } = await authorize(accountId, "edit_brand");
  if (!member) return fail(error);
  const parsed = brandSchema.safeParse(brand);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Check the brand kit and try again.");

  try {
    const { error: updateError } = await createServiceClient()
      .from("business_accounts")
      .update({
        company_name: parsed.data.company_name,
        brand_color: parsed.data.brand_color.toUpperCase(),
        logo_url: parsed.data.logo_url || null,
        default_message: parsed.data.default_message,
      })
      .eq("id", accountId);
    if (updateError) throw new Error(updateError.message);
    await recordRequestEvent({
      event: "business.brand_kit.saved",
      userId: member.user_id,
      props: { account_id: accountId, has_logo: Boolean(parsed.data.logo_url) },
    });
    return { ok: true, data: null };
  } catch (cause) {
    console.error("Could not save business brand kit.", cause);
    return fail(SAVE_FAILED_MESSAGE);
  }
}

/**
 * "Who gets the reminders". Admin only, because the auto-approve amount
 * decides which campaigns skip Finance.
 */
export async function saveReminderSettings(accountId: string, settings: ReminderSettingsValues): Promise<ActionResult> {
  const { member, error } = await authorize(accountId, "manage_team");
  if (!member) return fail(error);
  const parsed = reminderSettingsSchema.safeParse(settings);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Check the reminder settings and try again.");

  try {
    const { error: updateError } = await createServiceClient()
      .from("business_accounts")
      .update({
        reminder_contact: parsed.data.reminder_contact || null,
        reminder_cc_email: parsed.data.reminder_cc_email || null,
        reminder_channel: parsed.data.reminder_channel,
        auto_approve_under: parsed.data.auto_approve_under,
      })
      .eq("id", accountId);
    if (updateError) throw new Error(updateError.message);
    return { ok: true, data: null };
  } catch (cause) {
    console.error("Could not save business reminder settings.", cause);
    return fail(SAVE_FAILED_MESSAGE);
  }
}

/** Spent so far, and optionally the approved annual budget. Admins and approvers. */
export async function updateBudget(accountId: string, used: number, annualBudget?: number): Promise<ActionResult> {
  const { member, error } = await authorize(accountId, "approve_campaigns");
  if (!member) return fail(error);
  const parsed = budgetSchema.safeParse({ used, annual_budget: annualBudget });
  if (!parsed.success) return fail("Budgets can't be negative.");

  try {
    const { error: updateError } = await createServiceClient()
      .from("business_accounts")
      .update({
        budget_used: parsed.data.used,
        ...(parsed.data.annual_budget !== undefined ? { annual_budget: parsed.data.annual_budget } : {}),
      })
      .eq("id", accountId);
    if (updateError) throw new Error(updateError.message);
    return { ok: true, data: null };
  } catch (cause) {
    console.error("Could not update business budget.", cause);
    return fail(SAVE_FAILED_MESSAGE);
  }
}

/** Team & approvals "Edit": a colleague's permission level and department. */
export async function updateTeamMember(
  accountId: string,
  memberId: string,
  update: { role: string; department?: string },
): Promise<ActionResult> {
  const { member, error } = await authorize(accountId, "manage_team");
  if (!member) return fail(error);
  const parsed = teamMemberUpdateSchema.safeParse(update);
  if (!parsed.success) return fail("Choose a permission level.");

  try {
    const service = createServiceClient();
    if (parsed.data.role !== "admin") {
      const { data: admins, error: adminsError } = await service
        .from("business_users")
        .select("id")
        .eq("account_id", accountId)
        .eq("role", "admin");
      if (adminsError) throw new Error(adminsError.message);
      if ((admins || []).every((row) => row.id === memberId)) return fail("Keep at least one admin on the account.");
    }
    const { data, error: updateError } = await service
      .from("business_users")
      .update({ role: parsed.data.role, department: parsed.data.department?.trim() || null })
      .eq("id", memberId)
      .eq("account_id", accountId)
      .select("id")
      .maybeSingle();
    if (updateError) throw new Error(updateError.message);
    if (!data) return fail("That colleague is no longer on the team.");
    return { ok: true, data: null };
  } catch (cause) {
    console.error("Could not update business team member.", cause);
    return fail(SAVE_FAILED_MESSAGE);
  }
}
