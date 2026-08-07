import { describe, expect, it } from "vitest";
import {
  VALID_TRANSITIONS,
  assertValidOrderStatusTransition,
  isValidOrderStatusTransition,
} from "./statusTransitions";
import type { OrderStatus } from "./types";

const ALL_STATUSES = Object.keys(VALID_TRANSITIONS) as OrderStatus[];

describe("isValidOrderStatusTransition", () => {
  it("allows every transition listed in the map", () => {
    for (const from of ALL_STATUSES) {
      for (const to of VALID_TRANSITIONS[from]) {
        expect(isValidOrderStatusTransition(from, to)).toBe(true);
      }
    }
  });

  it("rejects every transition not listed in the map", () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        const expected = VALID_TRANSITIONS[from].includes(to);
        expect(isValidOrderStatusTransition(from, to)).toBe(expected);
      }
    }
  });

  it("blocks a backward move (shipped -> forwarded)", () => {
    expect(isValidOrderStatusTransition("shipped", "forwarded")).toBe(false);
  });

  it("blocks skipping a step (forwarded -> delivered)", () => {
    expect(isValidOrderStatusTransition("forwarded", "delivered")).toBe(false);
  });

  it("has no outgoing transitions from the terminal statuses", () => {
    expect(VALID_TRANSITIONS.cancelled).toEqual([]);
    expect(VALID_TRANSITIONS.refunded).toEqual([]);
  });
});

describe("assertValidOrderStatusTransition", () => {
  it("does not throw for a valid transition", () => {
    expect(() =>
      assertValidOrderStatusTransition("confirmed", "under_review"),
    ).not.toThrow();
  });

  it("throws for an invalid transition", () => {
    expect(() =>
      assertValidOrderStatusTransition("shipped", "forwarded"),
    ).toThrow("Invalid status transition from shipped to forwarded");
  });
});
