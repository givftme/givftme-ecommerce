import { describe, expect, it } from "vitest";
import {
  catalogWishlistItemSchema,
  editWishlistItemSchema,
  externalWishlistItemSchema,
} from "./validation";

describe("externalWishlistItemSchema", () => {
  const base = {
    origin: "external" as const,
    title: "Espresso machine",
    product_url: "https://www.jumia.com.ng/product",
  };

  it("accepts a minimal valid external item", () => {
    const result = externalWishlistItemSchema.safeParse(base);

    expect(result.success).toBe(true);
  });

  it("requires a product_url", () => {
    const rest: Record<string, unknown> = { ...base };
    delete rest.product_url;
    const result = externalWishlistItemSchema.safeParse(rest);

    expect(result.success).toBe(false);
  });

  it("rejects an invalid product_url", () => {
    const result = externalWishlistItemSchema.safeParse({
      ...base,
      product_url: "not-a-url",
    });

    expect(result.success).toBe(false);
  });

  it("defaults is_exclusive to false", () => {
    const result = externalWishlistItemSchema.parse(base);

    expect(result.is_exclusive).toBe(false);
  });

  it("rejects a negative price", () => {
    const result = externalWishlistItemSchema.safeParse({
      ...base,
      price: -100,
    });

    expect(result.success).toBe(false);
  });

  it("normalizes a zero price to null", () => {
    const result = externalWishlistItemSchema.parse({ ...base, price: 0 });

    expect(result.price).toBeNull();
  });
});

describe("catalogWishlistItemSchema", () => {
  const base = {
    origin: "catalog" as const,
    title: "Espresso machine",
    catalog_product_id: "catalog-123",
    price: 45000,
  };

  it("accepts a minimal valid catalog item", () => {
    const result = catalogWishlistItemSchema.safeParse(base);

    expect(result.success).toBe(true);
  });

  it("requires a catalog_product_id", () => {
    const rest: Record<string, unknown> = { ...base };
    delete rest.catalog_product_id;
    const result = catalogWishlistItemSchema.safeParse(rest);

    expect(result.success).toBe(false);
  });
});

describe("editWishlistItemSchema", () => {
  it("accepts an empty object since all fields are optional", () => {
    const result = editWishlistItemSchema.safeParse({});

    expect(result.success).toBe(true);
  });

  it("rejects a title over the max length", () => {
    const result = editWishlistItemSchema.safeParse({
      title: "a".repeat(201),
    });

    expect(result.success).toBe(false);
  });
});
