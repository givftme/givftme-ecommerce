import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";
import { initiateFlutterwavePayment } from "@/lib/flutterwave";
import { sanityFetch } from "@/lib/sanity/fetch";
import { POST } from "./route";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/wishlist/server", () => ({
  getAuthenticatedApiUser: vi.fn(),
}));

vi.mock("@/lib/flutterwave", () => ({
  initiateFlutterwavePayment: vi.fn(),
}));

// route.ts imports these for the create-new-order path — mocked so the
// create-order tests below can control what "Sanity" returns without
// loading sanity/env.ts (which throws if Sanity env vars aren't set in
// this test environment).
vi.mock("@/lib/sanity/fetch", () => ({ sanityFetch: vi.fn() }));
vi.mock("@/lib/sanity/queries", () => ({ CART_PRICES_QUERY: "" }));

const mockedCreateClient = vi.mocked(createClient);
const mockedGetAuthenticatedApiUser = vi.mocked(getAuthenticatedApiUser);
const mockedInitiateFlutterwavePayment = vi.mocked(initiateFlutterwavePayment);
const mockedSanityFetch = vi.mocked(sanityFetch);

const validBody = {
  cart_items: [
    {
      catalog_product_id: "product-1",
      combination_key: null,
      quantity: 1,
      display_price: 5000,
    },
  ],
  shipping: {
    first_name: "Ada",
    last_name: "Okoye",
    email: "ada@example.com",
    phone: "08012345678",
    street_address: "1 Admiralty Way",
    apartment: "",
    city: "Lagos",
    state: "Lagos",
    postal_code: "",
    delivery_instructions: "",
  },
  preferred_payment: "card" as const,
};

function postRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function withIdempotencyKey(headers: Record<string, string> = {}) {
  return { "Idempotency-Key": "123e4567-e89b-42d3-a456-426614174000", ...headers };
}

interface OrdersBuilderResult {
  data: unknown;
  error: unknown;
}

// Builds a mock supabase query-builder chain shared by every test below.
// Two different terminal shapes are exercised against the SAME object:
//   - `.select(...).eq(...).maybeSingle()` — an idempotency/order lookup,
//     resolving to `selectResult`.
//   - `.update(...).eq(...)[...].select("id")` (or a bare `.update().eq()`
//     release call) — awaited directly via `.then`, since neither ends in
//     `.maybeSingle()`. `claimSucceeds` controls whether this looks like a
//     successful claimed-row array (reinitiateOrderPayment's
//     claimOrderForPayment) or an empty one (claim lost to a concurrent
//     request).
function createOrdersBuilder(
  selectResult: OrdersBuilderResult,
  claimSucceeds = true
) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.or = vi.fn(() => builder);
  builder.maybeSingle = vi.fn().mockResolvedValue(selectResult);
  builder.update = vi.fn(() => builder);
  builder.then = (resolve: (value: { data?: unknown[]; error: null }) => void) =>
    resolve({
      data: claimSucceeds
        ? [{ id: (selectResult.data as { id?: string } | null)?.id }]
        : [],
      error: null,
    });

  return builder;
}

function mockOrdersOnlyClient(
  selectResult: OrdersBuilderResult,
  options: { claimSucceeds?: boolean } = {}
) {
  const builder = createOrdersBuilder(selectResult, options.claimSucceeds ?? true);
  const from = vi.fn(() => builder);
  // @ts-expect-error only .from is read by the idempotency-replay path
  mockedCreateClient.mockResolvedValue({ from });
  return { from, builder };
}

describe("POST /api/checkout — idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAuthenticatedApiUser.mockResolvedValue({ id: "user-1" } as User);
  });

  it("returns 401 when there is no authenticated user", async () => {
    mockedGetAuthenticatedApiUser.mockResolvedValue(null);
    mockOrdersOnlyClient({ data: null, error: null });

    const response = await POST(postRequest(validBody, withIdempotencyKey()));

    expect(response.status).toBe(401);
  });

  it("returns 400 when the Idempotency-Key header is missing", async () => {
    mockOrdersOnlyClient({ data: null, error: null });

    const response = await POST(postRequest(validBody));

    expect(response.status).toBe(400);
  });

  it("re-initiates payment for an existing pending_payment order instead of creating a new one", async () => {
    const { from } = mockOrdersOnlyClient({
      data: {
        id: "order-1",
        buyer_id: "user-1",
        total_amount: 5000,
        currency: "NGN",
        status: "pending_payment",
        shipping_email: "ada@example.com",
        shipping_name: "Ada Okoye",
        shipping_phone: "08012345678",
      },
      error: null,
    });
    mockedInitiateFlutterwavePayment.mockResolvedValue({
      ok: true,
      paymentLink: "https://checkout.flutterwave.com/v3/hosted/pay/abc123",
    });

    const response = await POST(postRequest(validBody, withIdempotencyKey()));
    const json = (await response.json()) as { order_id?: string; payment_link?: string };

    expect(response.status).toBe(200);
    expect(json).toEqual({
      order_id: "order-1",
      payment_link: "https://checkout.flutterwave.com/v3/hosted/pay/abc123",
    });
    // The idempotency lookup, then the atomic payment claim — no new order
    // (and no separate insert) was created.
    expect(from).toHaveBeenCalledTimes(2);
    expect(from).toHaveBeenCalledWith("orders");
  });

  it("returns 409 without calling Flutterwave when the order is already claimed by a concurrent request", async () => {
    mockOrdersOnlyClient(
      {
        data: {
          id: "order-3",
          buyer_id: "user-1",
          total_amount: 5000,
          currency: "NGN",
          status: "pending_payment",
          shipping_email: "ada@example.com",
          shipping_name: "Ada Okoye",
          shipping_phone: "08012345678",
        },
        error: null,
      },
      { claimSucceeds: false }
    );

    const response = await POST(postRequest(validBody, withIdempotencyKey()));
    const json = (await response.json()) as { error?: string };

    expect(response.status).toBe(409);
    expect(json.error).toMatch(/already being started/i);
    expect(mockedInitiateFlutterwavePayment).not.toHaveBeenCalled();
  });

  it("returns the order id with no payment link when the matched order is already confirmed", async () => {
    mockOrdersOnlyClient({
      data: {
        id: "order-2",
        buyer_id: "user-1",
        total_amount: 5000,
        currency: "NGN",
        status: "confirmed",
        shipping_email: "ada@example.com",
        shipping_name: "Ada Okoye",
        shipping_phone: "08012345678",
      },
      error: null,
    });

    const response = await POST(postRequest(validBody, withIdempotencyKey()));
    const json = (await response.json()) as { order_id?: string; payment_link?: string | null };

    expect(response.status).toBe(200);
    expect(json).toEqual({ order_id: "order-2", payment_link: null });
    expect(mockedInitiateFlutterwavePayment).not.toHaveBeenCalled();
  });
});

const sanityProduct = {
  _id: "product-1",
  title: "Gift",
  status: "active",
  hasVariants: false,
  basePrice: 5000,
};

interface CreateOrderClientOptions {
  /** Result of the pre-insert idempotency lookup (first `.from("orders")` select). */
  initialLookup: OrdersBuilderResult;
  /** Result of `supabase.rpc("gifvtme_create_checkout_order", ...)`. */
  rpcResult: { data: unknown; error: unknown };
  /** Result of the post-conflict re-select (second `.from("orders")` select), if any. */
  raceLookup?: OrdersBuilderResult;
}

function mockCreateOrderClient({
  initialLookup,
  rpcResult,
  raceLookup,
}: CreateOrderClientOptions) {
  // Calls in order: (1) the pre-insert idempotency lookup, (2) — only on a
  // 23505 — the re-select of the now-committed race winner, and (3) — only
  // when that re-select finds a pending_payment/payment_failed order — the
  // atomic payment claim inside reinitiateOrderPayment. (2) and (3) return
  // the same underlying order data, just via different terminal calls.
  let callCount = 0;
  const from = vi.fn(() => {
    callCount += 1;

    return callCount === 1
      ? createOrdersBuilder(initialLookup)
      : createOrdersBuilder(raceLookup ?? initialLookup);
  });
  const rpc = vi.fn().mockResolvedValue(rpcResult);

  // @ts-expect-error only .from/.rpc are read by the create-order path
  mockedCreateClient.mockResolvedValue({ from, rpc });
  return { from, rpc };
}

describe("POST /api/checkout — atomic order creation (concurrent submits)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetAuthenticatedApiUser.mockResolvedValue({ id: "user-1" } as User);
    mockedSanityFetch.mockResolvedValue([sanityProduct]);
  });

  it("creates the order and its items atomically via one RPC call before starting payment", async () => {
    const { rpc } = mockCreateOrderClient({
      initialLookup: { data: null, error: null },
      rpcResult: { data: "order-new-1", error: null },
    });
    mockedInitiateFlutterwavePayment.mockResolvedValue({
      ok: true,
      paymentLink: "https://checkout.flutterwave.com/v3/hosted/pay/new1",
    });

    const response = await POST(postRequest(validBody, withIdempotencyKey()));
    const json = (await response.json()) as { order_id?: string; payment_link?: string };

    expect(response.status).toBe(200);
    expect(json).toEqual({
      order_id: "order-new-1",
      payment_link: "https://checkout.flutterwave.com/v3/hosted/pay/new1",
    });

    // order + order_items were submitted together as one RPC call, not as
    // two separate inserts — the cart line is part of the same payload.
    expect(rpc).toHaveBeenCalledWith(
      "gifvtme_create_checkout_order",
      expect.objectContaining({
        p_order_items: [
          expect.objectContaining({
            catalog_product_id: "product-1",
            quantity: 1,
            unit_price: 5000,
          }),
        ],
      })
    );

    // Payment only starts once the atomic create call has resolved.
    const rpcOrder = rpc.mock.invocationCallOrder[0];
    const paymentOrder = mockedInitiateFlutterwavePayment.mock.invocationCallOrder[0];
    expect(rpcOrder).toBeLessThan(paymentOrder);
  });

  it("does not start payment against an incomplete order when a concurrent request wins the race", async () => {
    const committedOrder = {
      id: "order-race-1",
      buyer_id: "user-1",
      total_amount: 5000,
      currency: "NGN",
      status: "pending_payment",
      shipping_email: "ada@example.com",
      shipping_name: "Ada Okoye",
      shipping_phone: "08012345678",
    };
    const { rpc, from } = mockCreateOrderClient({
      initialLookup: { data: null, error: null },
      rpcResult: {
        data: null,
        error: { code: "23505", message: "duplicate key value violates unique constraint" },
      },
      raceLookup: { data: committedOrder, error: null },
    });
    mockedInitiateFlutterwavePayment.mockResolvedValue({
      ok: true,
      paymentLink: "https://checkout.flutterwave.com/v3/hosted/pay/race1",
    });

    const response = await POST(postRequest(validBody, withIdempotencyKey()));
    const json = (await response.json()) as { order_id?: string; payment_link?: string };

    expect(response.status).toBe(200);
    expect(json).toEqual({
      order_id: "order-race-1",
      payment_link: "https://checkout.flutterwave.com/v3/hosted/pay/race1",
    });

    // Only one create attempt was made — this request lost the race and
    // never inserted anything of its own.
    expect(rpc).toHaveBeenCalledTimes(1);
    // It re-fetched the committed order (guaranteed complete, since order +
    // order_items commit together), then atomically claimed it, rather
    // than assuming it was safe to pay straight off the re-select.
    expect(from).toHaveBeenCalledTimes(3);
    expect(mockedInitiateFlutterwavePayment).toHaveBeenCalledTimes(1);
    expect(mockedInitiateFlutterwavePayment).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "order-race-1", amount: 5000 })
    );
  });
});
