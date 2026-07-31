import { describe, expect, it } from "vitest";
import { personalThankYouSchema } from "./validation";

describe("personalThankYouSchema", () => {
  it("accepts a valid personal thank-you", () => {
    const result = personalThankYouSchema.safeParse({
      source: "purchase",
      message: "Thank you so much!",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an empty message", () => {
    const result = personalThankYouSchema.safeParse({ source: "order", message: "" });

    expect(result.success).toBe(false);
  });

  it("rejects a message over 1000 characters", () => {
    const result = personalThankYouSchema.safeParse({
      source: "order",
      message: "a".repeat(1001),
    });

    expect(result.success).toBe(false);
  });

  it("accepts a message at exactly 1000 characters", () => {
    const result = personalThankYouSchema.safeParse({
      source: "purchase",
      message: "a".repeat(1000),
    });

    expect(result.success).toBe(true);
  });

  it("trims whitespace-only messages down to empty and rejects them", () => {
    const result = personalThankYouSchema.safeParse({ source: "purchase", message: "   " });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid source", () => {
    const result = personalThankYouSchema.safeParse({ source: "wishlist", message: "Thanks!" });

    expect(result.success).toBe(false);
  });
});
