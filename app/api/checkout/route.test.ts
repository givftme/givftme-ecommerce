import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";
import { initiateFlutterwavePayment } from "@/lib/flutterwave";
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

// route.ts imports these for the create-new-order path, which these
// idempotency-replay tests never reach — mocked purely to avoid loading
// sanity/env.ts (which throws if Sanity env vars aren't set in this
// test environment).
vi.mock("@/lib/sanity/fetch", () => ({ sanityFetch: vi.fn() }));
vi.mock("@/lib/sanity/queries", () => ({ CART_PRICES_QUERY: "" }));

const mockedCreateClient = vi.mocked(createClient);
const mockedGetAuthenticatedApiUser = vi.mocked(getAuthenticatedApiUser);
const mockedInitiateFlutterwavePayment = vi.mocked(initiateFlutterwavePayment);

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

function mockOrdersOnlyClient(selectResult: OrdersBuilderResult) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.maybeSingle = vi.fn().mockResolvedValue(selectResult);
  builder.update = vi.fn(() => builder);
  // `.update(...).eq(...).eq(...)` is awaited directly with no terminal
  // call in the real client — make the builder itself thenable.
  builder.then = (resolve: (value: { error: null }) => void) =>
    resolve({ error: null });

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
    // Only the idempotency lookup touched "orders" — no new order was created.
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("orders");
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
