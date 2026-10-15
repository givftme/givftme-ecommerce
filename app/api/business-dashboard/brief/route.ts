import { NextResponse } from "next/server";
import { jsonError, readJson } from "@/lib/api/response";
import { requireBusinessApi } from "@/lib/business-dashboard/auth";
import { getBusinessAccount } from "@/lib/business-dashboard/queries";
import { businessBriefSchema } from "@/lib/business-dashboard/validation";
import { teamSizeFor } from "@/lib/business/validation";
import { createServiceClient } from "@/lib/supabase/server";

// "Send a brief" from the dashboard: one business_enquiries row, so it shows
// on the admin Enquiries screen beside briefs from the /business page.
export async function POST(request: Request) {
  const { member, response } = await requireBusinessApi();
  if (!member) return response;

  const parsed = businessBriefSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Check the brief and try again.", 400);
  if (!member.email && !parsed.data.phone) return jsonError("Add a phone number so we can reach you.", 400);

  try {
    const service = createServiceClient();
    const account = await getBusinessAccount(service, member.account_id);
    const heads = parsed.data.heads;
    const { data, error } = await service
      .from("business_enquiries")
      .insert({
        company_name: account.company_name,
        contact_name: member.full_name,
        email: member.email || null,
        phone: parsed.data.phone || null,
        occasions: [parsed.data.occasion],
        team_size: heads > 0 ? teamSizeFor(heads) : null,
        needed_by: parsed.data.neededBy || null,
        notes: `${parsed.data.notes}\n\nSent from the business dashboard (${account.plan} plan${heads ? `, ${heads} people` : ""}).`,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    console.error("Could not send business dashboard brief.", error);
    return jsonError("We couldn't send that. Please try again.", 500);
  }
}
