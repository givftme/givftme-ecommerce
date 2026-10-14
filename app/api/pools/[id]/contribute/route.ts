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

const PAYMENT_CLAIM_STALE_MS = 2 * 60 * 1000;

function paymentInitializingResponse() {
  return NextResponse.json({
    error: "Your payment link is still being prepared. Try again in a moment.",
    payment_initializing: true,
  }, { status: 409 });
}

function endedAttemptResponse(
  message = "That payment attempt has ended. Start a new contribution to try again.",
  status = 409
) {
  return NextResponse.json({
    error: message,
    attempt_ended: true,
  }, { status });
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

  const service = createServiceClient();
  const { data: currentContribution, error: contributionError } = await service
    .from("pool_contributions")
    .select("status, flutterwave_payment_link")
    .eq("id", reservation.contribution_id)
    .maybeSingle();
  if (contributionError || !currentContribution) {
    console.error("Could not load group pool payment attempt.", contributionError);
    return jsonError("Couldn't load this payment attempt. Try again.", 500);
  }

  if (currentContribution.status === "paid") {
    return NextResponse.json({
      contribution_id: reservation.contribution_id,
      payment_url: null,
      already_paid: true,
    });
  }
  if (currentContribution.flutterwave_payment_link) {
    if (!isAllowedFlutterwavePaymentLink(currentContribution.flutterwave_payment_link)) {
      console.error("Stored Flutterwave pool payment link failed validation.", {
        contributionId: reservation.contribution_id,
      });
      return jsonError("Payment link couldn't be recovered. Try again.", 502);
    }
    return NextResponse.json({
      contribution_id: reservation.contribution_id,
      amount: reservation.amount,
      payment_url: currentContribution.flutterwave_payment_link,
      capped: reservation.amount < parsed.data.amount,
      idempotent_replay: reservation.idempotent_replay === true,
    });
  }
  if (currentContribution.status !== "pending_payment") return endedAttemptResponse();

  const { data: pool, error: poolError } = await service.from("group_gift_pools")
    .select("token, title, status")
    .eq("id", poolId)
    .maybeSingle();
  if (poolError) {
    console.error("Could not load group gift pool before payment initialization.", poolError);
    return jsonError("Couldn't load this pool. Try again.", 500);
  }
  if (!pool || pool.status !== "open") {
    const { error: failError } = await service.rpc("gifvtme_fail_group_pool_contribution", {
      p_contribution_id: reservation.contribution_id,
    });
    if (failError) {
      console.error("Could not end contribution for a closed pool.", failError);
      return jsonError("This pool is no longer accepting contributions.", 500);
    }
    return endedAttemptResponse("This pool is no longer accepting contributions.");
  }

  const { data: profile } = await supabase.from("users").select("full_name, phone").eq("id", user.id).maybeSingle();
  if (!user.email) {
    const { error: failError } = await service.rpc("gifvtme_fail_group_pool_contribution", {
      p_contribution_id: reservation.contribution_id,
    });
    if (failError) {
      console.error("Could not end contribution without an email address.", failError);
      return jsonError("Add an email address to your account before contributing.", 500);
    }
    return endedAttemptResponse("Add an email address to your account before contributing.", 400);
  }

  const claimedAt = new Date();
  const staleClaimBefore = new Date(claimedAt.getTime() - PAYMENT_CLAIM_STALE_MS).toISOString();
  const { data: claim, error: claimError } = await service
    .from("pool_contributions")
    .update({ payment_claimed_at: claimedAt.toISOString() })
    .eq("id", reservation.contribution_id)
    .eq("status", "pending_payment")
    .is("flutterwave_payment_link", null)
    .or(`payment_claimed_at.is.null,payment_claimed_at.lt.${staleClaimBefore}`)
    .select("id")
    .maybeSingle();

  if (claimError) {
    console.error("Could not claim group pool payment initialization.", claimError);
    return jsonError("Couldn't start this contribution. Try again.", 500);
  }
  if (!claim) {
    const { data: latestContribution, error: latestError } = await service
      .from("pool_contributions")
      .select("status, flutterwave_payment_link")
      .eq("id", reservation.contribution_id)
      .maybeSingle();
    if (latestError || !latestContribution) {
      console.error("Could not reload group pool payment attempt.", latestError);
      return jsonError("Couldn't load this payment attempt. Try again.", 500);
    }
    if (latestContribution.status === "paid") {
      return NextResponse.json({
        contribution_id: reservation.contribution_id,
        payment_url: null,
        already_paid: true,
      });
    }
    if (latestContribution.flutterwave_payment_link) {
      if (!isAllowedFlutterwavePaymentLink(latestContribution.flutterwave_payment_link)) {
        console.error("Stored Flutterwave pool payment link failed validation.", {
          contributionId: reservation.contribution_id,
        });
        return jsonError("Payment link couldn't be recovered. Try again.", 502);
      }
      return NextResponse.json({
        contribution_id: reservation.contribution_id,
        amount: reservation.amount,
        payment_url: latestContribution.flutterwave_payment_link,
        capped: reservation.amount < parsed.data.amount,
        idempotent_replay: true,
      });
    }
    if (latestContribution.status !== "pending_payment") return endedAttemptResponse();
    return paymentInitializingResponse();
  }

  let payment: Awaited<ReturnType<typeof initiateFlutterwavePayment>>;
  try {
    payment = await initiateFlutterwavePayment({
      poolContributionId: reservation.contribution_id,
      poolToken: String(pool.token),
      amount: reservation.amount,
      customer: {
        email: user.email,
        name: profile?.full_name || user.user_metadata?.full_name || "Givftme contributor",
        phone: profile?.phone ?? undefined,
      },
    });
  } catch (error) {
    console.error("Flutterwave pool payment initialization failed.", {
      contributionId: reservation.contribution_id,
      error,
    });
    const { error: failError } = await service.rpc("gifvtme_fail_group_pool_contribution", {
      p_contribution_id: reservation.contribution_id,
    });
    if (failError) {
      console.error("Could not release failed pool payment initialization.", failError);
      return paymentInitializingResponse();
    }
    return endedAttemptResponse("Payment couldn't start. Start a new contribution to try again.", 502);
  }

  if (!payment.ok || !payment.paymentLink || !isAllowedFlutterwavePaymentLink(payment.paymentLink)) {
    const { error: failError } = await service.rpc("gifvtme_fail_group_pool_contribution", {
      p_contribution_id: reservation.contribution_id,
    });
    console.error("Flutterwave pool payment initialization failed.", {
      contributionId: reservation.contribution_id,
      error: payment.error ?? "Invalid hosted payment link.",
    });
    if (failError) {
      console.error("Could not release failed pool payment initialization.", failError);
      return paymentInitializingResponse();
    }
    return endedAttemptResponse("Payment couldn't start. Start a new contribution to try again.", 502);
  }

  const { data: savedContribution, error: saveError } = await service
    .from("pool_contributions")
    .update({
      flutterwave_payment_link: payment.paymentLink,
      payment_claimed_at: null,
    })
    .eq("id", reservation.contribution_id)
    .is("flutterwave_payment_link", null)
    .select("id")
    .maybeSingle();

  if (saveError) {
    console.error("Could not save Flutterwave pool payment link.", {
      contributionId: reservation.contribution_id,
      error: saveError,
    });
    return paymentInitializingResponse();
  }
  if (!savedContribution) {
    const { data: latestContribution, error: latestError } = await service
      .from("pool_contributions")
      .select("status, flutterwave_payment_link")
      .eq("id", reservation.contribution_id)
      .maybeSingle();
    if (latestError || !latestContribution) {
      console.error("Could not reload saved Flutterwave pool payment link.", latestError);
      return paymentInitializingResponse();
    }
    if (latestContribution.status === "paid") {
      return NextResponse.json({
        contribution_id: reservation.contribution_id,
        payment_url: null,
        already_paid: true,
      });
    }
    if (!latestContribution.flutterwave_payment_link
      || !isAllowedFlutterwavePaymentLink(latestContribution.flutterwave_payment_link)) {
      return paymentInitializingResponse();
    }
    return NextResponse.json({
      contribution_id: reservation.contribution_id,
      amount: reservation.amount,
      payment_url: latestContribution.flutterwave_payment_link,
      capped: reservation.amount < parsed.data.amount,
      idempotent_replay: true,
    });
  }

  return NextResponse.json({
    contribution_id: reservation.contribution_id,
    amount: reservation.amount,
    payment_url: payment.paymentLink,
    capped: reservation.amount < parsed.data.amount,
    idempotent_replay: reservation.idempotent_replay === true,
  });
}
