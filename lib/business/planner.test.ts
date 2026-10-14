import { describe, expect, it } from "vitest";
import { estimateGiftingYear } from "@/lib/business/planner";

describe("estimateGiftingYear", () => {
  it("gifts the whole team once per occasion", () => {
    expect(estimateGiftingYear(60, 20000, ["bday", "csw", "eoy"])).toEqual({
      gifts: 180,
      total: 3600000,
      plan: "Pulse + Seasons",
    });
  });

  it("counts four hangouts a year at one gift per ten people", () => {
    expect(estimateGiftingYear(25, 10000, ["hangout"])).toEqual({
      gifts: 12,
      total: 120000,
      plan: "Seasons",
    });
  });

  it("recommends Pulse for birthdays alone", () => {
    expect(estimateGiftingYear(10, 5000, ["bday"]).plan).toBe("Pulse");
  });

  it("asks for an occasion when none is ticked", () => {
    expect(estimateGiftingYear(10, 5000, [])).toEqual({
      gifts: 0,
      total: 0,
      plan: "Pick an occasion",
    });
  });
});
