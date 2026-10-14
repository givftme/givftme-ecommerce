import { NextResponse } from "next/server";
import { createBusinessEnquiry } from "@/lib/admin/data/moderation";
import { jsonError, readJson } from "@/lib/api/response";
import { businessEnquirySchema } from "@/lib/business/validation";
import { createServiceClient } from "@/lib/supabase/server";

const REFERENCE = /^GXC-[A-Z0-9]{4}$/;

// Public: the /business Experience Centre brief. Rows land in
// business_enquiries for the Enquiries admin screen.
export async function POST(request: Request) {
  const body = await readJson(request);
  const parsed = businessEnquirySchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Check your details and try again.", 400);

  const ref = (body as { ref?: unknown } | null)?.ref;
  try {
    const id = await createBusinessEnquiry(
      createServiceClient(),
      parsed.data,
      typeof ref === "string" && REFERENCE.test(ref) ? ref : null,
    );
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("Could not save business enquiry.", error);
    return jsonError("We couldn't send that. Try again, or reach us on WhatsApp.", 500);
  }
}
