import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServiceClient } from "@/lib/supabase/server";
import { POST } from "./route";

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(),
}));

const mockedCreateServiceClient = vi.mocked(createServiceClient);
const SECRET_HASH = "test-secret-hash";

function webhookRequest(body: unknown, signature: string | null) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (signature !== null) {
    headers["verif-hash"] = signature;
  }

  return new Request("http://localhost/api/flutterwave/webhook", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

// Confirming and failing an order are now single transactional RPCs
// (gifvtme_confirm_gift_order / gifvtme_fail_gift_order, migration 027),
// so this mock records rpc calls rather than a sequence of table updates.
function mockOrderClient(order: Record<string, unknown> | null) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.maybeSingle = vi.fn().mockResolvedValue({ data: order, error: null });
  builder.update = vi.fn(() => builder);
  builder.then = (resolve: (value: { error: null }) => void) =>
    resolve({ error: null });

  const from = vi.fn(() => builder);
  const rpc = vi.fn().mockResolvedValue({
    data: { outcome: "ok", already_confirmed: false, claim_conflict: false },
    error: null,
  });
  // @ts-expect-error only .from and .rpc are read by this route
  mockedCreateServiceClient.mockReturnValue({ from, rpc });
  return { from, builder, rpc };
}

const successfulChargePayload = {
  event: "charge.completed",
  data: {
    id: 999,
    tx_ref: "gifvtme_order_11111111-1111-1111-1111-111111111111_" +
      "22222222-2222-2222-2222-222222222222",
    status: "successful",
    amount: 5000,
    currency: "NGN",
    meta: { order_id: "11111111-1111-1111-1111-111111111111" },
  },
};

const baseOrder = {
  id: "11111111-1111-1111-1111-111111111111",
  status: "pending_payment",
  total_amount: 5000,
  currency: "NGN",
  flutterwave_tx_ref: null,
  wishlist_item_id: null,
  buyer_id: "user-1",
};

describe("POST /api/flutterwave/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FLUTTERWAVE_SECRET_HASH = SECRET_HASH;
  });

  afterEach(() => {
    delete process.env.FLUTTERWAVE_SECRET_HASH;
  });

  it("rejects a request with a missing signature before touching the database", async () => {
    const response = await POST(webhookRequest(successfulChargePayload, null));

    expect(response.status).toBe(401);
    expect(mockedCreateServiceClient).not.toHaveBeenCalled();
  });

  it("rejects a request with an incorrect signature before touching the database", async () => {
    const response = await POST(webhookRequest(successfulChargePayload, "wrong-hash"));

    expect(response.status).toBe(401);
    expect(mockedCreateServiceClient).not.toHaveBeenCalled();
  });

  it("ignores non charge.completed events without touching the database", async () => {
    const response = await POST(
      webhookRequest({ event: "transfer.completed", data: {} }, SECRET_HASH)
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ received: true });
    expect(mockedCreateServiceClient).not.toHaveBeenCalled();
  });

  it("confirms the order in one transaction when signature, event, and amount all match", async () => {
    const { rpc } = mockOrderClient(baseOrder);

    const response = await POST(webhookRequest(successfulChargePayload, SECRET_HASH));

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      "gifvtme_confirm_gift_order",
      expect.objectContaining({ p_order_id: baseOrder.id })
    );
  });

  it("does not confirm the order when the webhook amount doesn't match", async () => {
    const { rpc } = mockOrderClient(baseOrder);

    const response = await POST(
      webhookRequest(
        {
          ...successfulChargePayload,
          data: { ...successfulChargePayload.data, amount: 1 },
        },
        SECRET_HASH
      )
    );

    expect(response.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not confirm the order when the webhook currency doesn't match", async () => {
    const { rpc } = mockOrderClient(baseOrder);

    const response = await POST(
      webhookRequest(
        {
          ...successfulChargePayload,
          data: { ...successfulChargePayload.data, currency: "USD" },
        },
        SECRET_HASH
      )
    );

    expect(response.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("is idempotent for an order that's already been confirmed", async () => {
    const { rpc } = mockOrderClient({ ...baseOrder, status: "confirmed" });

    const response = await POST(webhookRequest(successfulChargePayload, SECRET_HASH));

    expect(response.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("confirms a successful charge that arrives after an earlier attempt failed", async () => {
    // Flutterwave's hosted page lets a buyer try another card after a
    // decline, and each attempt sends its own charge.completed. The failed
    // one lands first and moves the order to payment_failed; the later
    // success is real money and must still confirm the order.
    const { rpc } = mockOrderClient({ ...baseOrder, status: "payment_failed" });

    const response = await POST(webhookRequest(successfulChargePayload, SECRET_HASH));

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      "gifvtme_confirm_gift_order",
      expect.objectContaining({ p_order_id: baseOrder.id })
    );
  });

  it("does not re-fail an order that is already payment_failed", async () => {
    const { rpc } = mockOrderClient({ ...baseOrder, status: "payment_failed" });

    const response = await POST(
      webhookRequest(
        {
          ...successfulChargePayload,
          data: { ...successfulChargePayload.data, status: "failed" },
        },
        SECRET_HASH
      )
    );

    expect(response.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("marks the order payment_failed for a non-successful charge status", async () => {
    const { rpc } = mockOrderClient(baseOrder);

    const response = await POST(
      webhookRequest(
        {
          ...successfulChargePayload,
          data: { ...successfulChargePayload.data, status: "failed" },
        },
        SECRET_HASH
      )
    );

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      "gifvtme_fail_gift_order",
      expect.objectContaining({ p_order_id: baseOrder.id })
    );
  });
});
