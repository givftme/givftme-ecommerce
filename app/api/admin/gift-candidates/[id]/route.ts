import { NextResponse } from "next/server";
import { getAdminApiUser } from "@/lib/admin/auth";
import { readJson, jsonError } from "@/lib/api/response";
import {
  candidateUpdateSchema,
  updateCandidateForAdmin,
} from "@/lib/gift-museum/admin";
import { createClient, createServiceClient } from "@/lib/supabase/server";

interface CandidateRouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: CandidateRouteContext) {
  const sessionSupabase = await createClient();
  const user = await getAdminApiUser(sessionSupabase);

  if (!user) {
    return jsonError("Admin access required.", 403);
  }

  const body = await readJson(request);
  const parsed = candidateUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Check candidate fields and try again.", 400);
  }

  try {
    const { id } = await context.params;
    const candidate = await updateCandidateForAdmin(
      createServiceClient(),
      id,
      user.id,
      parsed.data
    );

    return NextResponse.json({ candidate });
  } catch (error) {
    console.error("Could not update gift candidate.", error);
    return jsonError("Could not update candidate.", 500);
  }
}
