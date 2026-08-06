import { describe, expect, it } from "vitest";
import { checkoutSchema } from "./validation";

const validShipping = {
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
};

const validCartItem = {
  catalog_product_id: "product-1",
  combination_key: null,
  quantity: 1,
  display_price: 5000,
};

function build(overrides: Record<string, unknown> = {}) {
  return {
    cart_items: [validCartItem],
    shipping: validShipping,
    preferred_payment: "card",
    ...overrides,
  };
}

describe("checkoutSchema", () => {
  it("accepts a minimal valid checkout payload", () => {
    const result = checkoutSchema.safeParse(build());

    expect(result.success).toBe(true);
  });

  it("accepts a cart item with a variant combination_key", () => {
    const result = checkoutSchema.safeParse(
      build({
        cart_items: [{ ...validCartItem, combination_key: "size-m:color-red" }],
      })
    );

    expect(result.success).toBe(true);
  });

  it("accepts an optional wishlist_item_id when it's a valid uuid", () => {
    const result = checkoutSchema.safeParse(
      build({ wishlist_item_id: "123e4567-e89b-42d3-a456-426614174000" })
    );

    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid wishlist_item_id", () => {
    const result = checkoutSchema.safeParse(build({ wishlist_item_id: "not-a-uuid" }));

    expect(result.success).toBe(false);
  });

  it("rejects an empty cart", () => {
    const result = checkoutSchema.safeParse(build({ cart_items: [] }));

    expect(result.success).toBe(false);
  });

  it("rejects a quantity of zero", () => {
    const result = checkoutSchema.safeParse(
      build({ cart_items: [{ ...validCartItem, quantity: 0 }] })
    );

    expect(result.success).toBe(false);
  });

  it("rejects a quantity above 99", () => {
    const result = checkoutSchema.safeParse(
      build({ cart_items: [{ ...validCartItem, quantity: 100 }] })
    );

    expect(result.success).toBe(false);
  });

  it("rejects a non-positive display_price", () => {
    const result = checkoutSchema.safeParse(
      build({ cart_items: [{ ...validCartItem, display_price: 0 }] })
    );

    expect(result.success).toBe(false);
  });

  it("accepts a Nigerian phone number in +234 format", () => {
    const result = checkoutSchema.safeParse(
      build({ shipping: { ...validShipping, phone: "+2348012345678" } })
    );

    expect(result.success).toBe(true);
  });

  it("rejects a non-Nigerian phone number", () => {
    const result = checkoutSchema.safeParse(
      build({ shipping: { ...validShipping, phone: "+14155552671" } })
    );

    expect(result.success).toBe(false);
  });

  it("rejects an invalid state", () => {
    const result = checkoutSchema.safeParse(
      build({ shipping: { ...validShipping, state: "Texas" } })
    );

    expect(result.success).toBe(false);
  });

  it("rejects a street address shorter than 5 characters", () => {
    const result = checkoutSchema.safeParse(
      build({ shipping: { ...validShipping, street_address: "1 A" } })
    );

    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = checkoutSchema.safeParse(
      build({ shipping: { ...validShipping, email: "not-an-email" } })
    );

    expect(result.success).toBe(false);
  });

  it("rejects an unrecognized preferred_payment value", () => {
    const result = checkoutSchema.safeParse(build({ preferred_payment: "crypto" }));

    expect(result.success).toBe(false);
  });

  it("allows preferred_payment to be omitted", () => {
    const body = build();
    delete (body as { preferred_payment?: string }).preferred_payment;
    const result = checkoutSchema.safeParse(body);

    expect(result.success).toBe(true);
  });
});
