import { describe, expect, it } from "vitest";
import { importantDateSchema, updateImportantDateSchema } from "./validation";

function futureDateOnly(daysFromNow: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

describe("importantDateSchema", () => {
  const base = {
    person_name: "Mum",
    occasion_type: "birthday" as const,
    date: futureDateOnly(30),
    is_recurring: true,
  };

  it("accepts a minimal valid important date", () => {
    const result = importantDateSchema.safeParse(base);

    expect(result.success).toBe(true);
  });

  it("requires a person_name", () => {
    const result = importantDateSchema.safeParse({ ...base, person_name: "" });

    expect(result.success).toBe(false);
  });

  it("rejects a date in the past", () => {
    const result = importantDateSchema.safeParse({ ...base, date: futureDateOnly(-10) });

    expect(result.success).toBe(false);
  });

  it("rejects a date more than 5 years away", () => {
    const result = importantDateSchema.safeParse({ ...base, date: futureDateOnly(365 * 6) });

    expect(result.success).toBe(false);
  });

  it("defaults is_recurring to true when omitted", () => {
    const { is_recurring, ...rest } = base;
    const result = importantDateSchema.parse(rest);

    expect(result.is_recurring).toBe(true);
  });

  it("rejects an invalid linked_wishlist_url", () => {
    const result = importantDateSchema.safeParse({
      ...base,
      linked_wishlist_url: "not-a-url",
    });

    expect(result.success).toBe(false);
  });

  it("accepts an empty string for linked_wishlist_url", () => {
    const result = importantDateSchema.safeParse({ ...base, linked_wishlist_url: "" });

    expect(result.success).toBe(true);
  });
});

describe("updateImportantDateSchema", () => {
  it("rejects an empty object", () => {
    const result = updateImportantDateSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("accepts a partial update", () => {
    const result = updateImportantDateSchema.safeParse({ person_name: "Dad" });

    expect(result.success).toBe(true);
  });
});
