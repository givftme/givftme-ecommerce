import { beforeEach, describe, expect, it, vi } from "vitest";
import { initiateFlutterwavePayment } from "@/lib/flutterwave";
import { beginGiftCheckout } from "@/lib/gift/server";
import { reinitiateOrderPayment, type ReinitiatableOrder } from "./reinitiatePayment";

vi.mock("@/lib/flutterwave", () => ({
  initiateFlutterwavePayment: vi.fn(),
}));

vi.mock("@/lib/gift/server", () => ({
  beginGiftCheckout: vi.fn(),
}));

const mockedInitiate = vi.mocked(initiateFlutterwavePayment);
const mockedBeginGiftCheckout = vi.mocked(beginGiftCheckout);
const PAYMENT_LINK = "https://checkout.flutterwave.com/v3/hosted/pay/abc123";

function mockSupabase() {
  const builder: Record<string, unknown> = {};
  for (const method of ["update", "eq", "in", "or"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.select = vi.fn().mockResolvedValue({ data: [{ id: "order-1" }], error: null });
  builder.then = (resolve: (value: { error: null }) => void) => resolve({ error: null });

  const from = vi.fn(() => builder);
  return { client: { from } as never, from };
}

const selfOrder: ReinitiatableOrder = {
  id: "order-1",
  buyer_id: "user-1",
  total_amount: 5000,
  currency: "NGN",
  status: "payment_failed",
  shipping_email: "buyer@example.com",
  shipping_name: "Ada Obi",
  shipping_phone: "08012345678",
  order_source: "self",
  wishlist_item_id: null,
};

const giftOrder: ReinitiatableOrder = {
  ...selfOrder,
  order_source: "wishlist",
  wishlist_item_id: "item-1",
};

describe("reinitiateOrderPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedInitiate.mockResolvedValue({ ok: true, paymentLink: PAYMENT_LINK });
    mockedBeginGiftCheckout.mockResolvedValue({
      ok: true,
      claim: { outcome: "ok", state: "checking_out" },
    });
  });

  it("does not touch gift claims when retrying a self purchase", async () => {
    const { client } = mockSupabase();

    const result = await reinitiateOrderPayment(client, selfOrder);

    expect(result).toEqual({ ok: true, paymentLink: PAYMENT_LINK });
    expect(mockedBeginGiftCheckout).not.toHaveBeenCalled();
  });

  it("puts the gift claim back into checkout before a retry, so the paid order can mark the gift purchased", async () => {
    const { client } = mockSupabase();

    const result = await reinitiateOrderPayment(client, giftOrder);

    expect(result).toEqual({ ok: true, paymentLink: PAYMENT_LINK });
    expect(mockedBeginGiftCheckout).toHaveBeenCalledWith(client, "item-1");
  });

  it("refuses to start payment when the gift reservation has run out", async () => {
    const { client, from } = mockSupabase();
    mockedBeginGiftCheckout.mockResolvedValue({
      ok: false,
      status: 409,
      error: "Your reservation ran out. Reserve it again to keep going.",
    });

    const result = await reinitiateOrderPayment(client, giftOrder);

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: "Your reservation ran out. Reserve it again to keep going.",
    });
    expect(from).not.toHaveBeenCalled();
    expect(mockedInitiate).not.toHaveBeenCalled();
  });
});
