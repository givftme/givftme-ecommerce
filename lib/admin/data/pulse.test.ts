import { describe, expect, it } from "vitest";
import { buildPulseKpis, type PulseDay } from "@/lib/admin/data/pulse";
import { parsePeriod, periodSince, ratio } from "@/lib/admin/format";

function day(day: string, signups: number, collected = 0): PulseDay {
  return { day, signups, collected, active: 0, dates_saved: 0, lists_created: 0, links_shared: 0, orders_placed: 0 };
}

describe("buildPulseKpis", () => {
  it("takes today, yesterday, and a seven-day series from eight days", () => {
    const days = [
      day("2026-10-14", 9, 5000),
      day("2026-10-07", 1),
      day("2026-10-08", 2),
      day("2026-10-09", 3),
      day("2026-10-10", 4),
      day("2026-10-11", 5),
      day("2026-10-12", 6),
      day("2026-10-13", 12),
    ];
    const [signups] = buildPulseKpis(days);
    expect(signups).toMatchObject({ key: "signups", today: 9, yesterday: 12, delta: -3 });
    expect(signups.series).toEqual([2, 3, 4, 5, 6, 12, 9]);
    expect(buildPulseKpis(days).find((kpi) => kpi.key === "collected")).toMatchObject({ today: 5000, money: true });
  });

  it("returns zeroes for an empty log", () => {
    const kpis = buildPulseKpis([]);
    expect(kpis).toHaveLength(7);
    expect(kpis[0]).toMatchObject({ today: 0, yesterday: 0, delta: 0, series: [] });
  });
});

describe("period helpers", () => {
  it("parses known periods and falls back otherwise", () => {
    expect(parsePeriod("7d")).toBe("7d");
    expect(parsePeriod("all")).toBe("all");
    expect(parsePeriod("1y")).toBe("30d");
    expect(parsePeriod(undefined, "90d")).toBe("90d");
  });

  it("computes period starts", () => {
    const now = new Date("2026-10-14T12:00:00Z");
    expect(periodSince("7d", now)).toBe("2026-10-07T12:00:00.000Z");
    expect(periodSince("all", now)).toBeNull();
  });

  it("guards divide-by-zero ratios", () => {
    expect(ratio(1, 4)).toBe(25);
    expect(ratio(3, 0)).toBeNull();
  });
});
