import { NextResponse } from "next/server";
import { getAdminApiUser } from "@/lib/admin/auth";
import { jsonError } from "@/lib/api/response";
import { publishCandidate } from "@/lib/gift-museum/admin";
import { createClient, createServiceClient } from "@/lib/supabase/server";

interface CandidatePublishRouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: CandidatePublishRouteContext) {
  const sessionSupabase = await createClient();
  const user = await getAdminApiUser(sessionSupabase);

  if (!user) {
    return jsonError("Admin access required.", 403);
  }

  try {
    const { id } = await context.params;
    const candidate = await publishCandidate(createServiceClient(), id, user.id);

    return NextResponse.json({ candidate });
  } catch (error) {
    console.error("Could not publish gift candidate.", error);
    return jsonError(
      error instanceof Error ? error.message : "Could not publish candidate.",
      400
    );
  }
}
