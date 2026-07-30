import { describe, expect, it } from "vitest";
import { parsePrice } from "./microlink";

describe("parsePrice", () => {
  it("returns null when the amount is undefined", () => {
    expect(parsePrice(undefined)).toBeNull();
  });

  it("parses a numeric amount as-is", () => {
    expect(parsePrice(1500)).toBe(1500);
  });

  it("parses a numeric string amount", () => {
    expect(parsePrice("2500.50")).toBe(2500.5);
  });

  it("returns null for a non-numeric string", () => {
    expect(parsePrice("free")).toBeNull();
  });

  it("returns null for a zero amount", () => {
    expect(parsePrice(0)).toBeNull();
  });

  it("returns null for a negative amount", () => {
    expect(parsePrice(-100)).toBeNull();
  });
});
