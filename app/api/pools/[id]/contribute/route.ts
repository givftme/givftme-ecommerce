import { NextResponse } from "next/server";
import { trackEvent } from "@/lib/analytics";
import { jsonError, readJson } from "@/lib/api/response";
import { initiateFlutterwavePayment } from "@/lib/flutterwave";
import { isAllowedFlutterwavePaymentLink } from "@/lib/flutterwave/paymentLink";
import { poolRpcError } from "@/lib/pools/errors";
import { contributeSchema } from "@/lib/pools/validation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

interface ContributeRouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: ContributeRouteContext) {
  const { id: poolId } = await context.params;
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);
  if (!user) return jsonError("You need to sign in first.", 401);

  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || !/^[0-9a-f-]{36}$/i.test(idempotencyKey)) {
    return jsonError("Send a valid Idempotency-Key header.", 400);
  }

  const parsed = contributeSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError("Enter a valid contribution amount.", 400);

  const { data: reservationValue, error: reserveError } = await supabase.rpc(
    "gifvtme_reserve_group_pool_contribution",
    { p_pool_id: poolId, p_amount: parsed.data.amount, p_idempotency_key: idempotencyKey }
  );
  if (reserveError) {
    const mapped = poolRpcError(reserveError);
    if (mapped.status !== 500) return jsonError(mapped.error, mapped.status);
    console.error("Could not reserve group pool contribution.", reserveError);
    return jsonError(mapped.error, mapped.status);
  }

  const reservation = reservationValue as {
    contribution_id?: string;
    amount?: number;
    status?: string;
    idempotent_replay?: boolean;
  } | null;
  if (!reservation?.contribution_id || typeof reservation.amount !== "number") {
    return jsonError("Couldn't start this contribution. Try again.", 500);
  }

  if (reservation.idempotent_replay !== true) {
    trackEvent("pool.contribution.started", { pool_id: poolId, amount: reservation.amount });
  }

  if (reservation.status === "paid") {
    return NextResponse.json({ contribution_id: reservation.contribution_id, payment_url: null, already_paid: true });
  }
  if (reservation.idempotent_replay && reservation.status === "pending_payment") {
    return NextResponse.json({
      contribution_id: reservation.contribution_id,
      payment_url: null,
      already_started: true,
    });
  }
  if (reservation.status !== "pending_payment") {
    return jsonError("That payment attempt has ended. Start a new contribution to try again.", 409);
  }

  const service = createServiceClient();
  const { data: pool, error: poolError } = await service.from("group_gift_pools")
    .select("token, title, status")
    .eq("id", poolId)
    .maybeSingle();
  if (poolError || !pool || pool.status !== "open") {
    await service.rpc("gifvtme_fail_group_pool_contribution", { p_contribution_id: reservation.contribution_id });
    return jsonError("This pool is no longer accepting contributions.", 409);
  }

  const { data: profile } = await supabase.from("users").select("full_name, phone").eq("id", user.id).maybeSingle();
  if (!user.email) {
    await service.rpc("gifvtme_fail_group_pool_contribution", { p_contribution_id: reservation.contribution_id });
    return jsonError("Add an email address to your account before contributing.", 400);
  }
  const payment = await initiateFlutterwavePayment({
    poolContributionId: reservation.contribution_id,
    poolToken: String(pool.token),
    amount: reservation.amount,
    customer: {
      email: user.email,
      name: profile?.full_name || user.user_metadata?.full_name || "Gifvtme contributor",
      phone: profile?.phone ?? undefined,
    },
  });

  if (!payment.ok || !payment.paymentLink || !isAllowedFlutterwavePaymentLink(payment.paymentLink)) {
    await service.rpc("gifvtme_fail_group_pool_contribution", { p_contribution_id: reservation.contribution_id });
    console.error("Flutterwave pool payment initialization failed.", {
      contributionId: reservation.contribution_id,
      error: payment.error ?? "Invalid hosted payment link.",
    });
    return jsonError("Payment couldn't start - try again.", 502);
  }

  return NextResponse.json({
    contribution_id: reservation.contribution_id,
    amount: reservation.amount,
    payment_url: payment.paymentLink,
    capped: reservation.amount < parsed.data.amount,
    idempotent_replay: reservation.idempotent_replay === true,
  });
}
