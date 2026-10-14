import { describe, expect, it } from "vitest";
import {
  ADMIN_NAV,
  ADMIN_ROLES,
  canAccessScreen,
  canPerform,
  navForRole,
  navItemForPath,
  SCREEN_ROLES,
  type AdminRole,
  type AdminScreen,
} from "@/lib/admin/roles";

// The spec's permission matrix, row by row (support, operations, growth,
// finance, admin). Kept as a literal table so a change to SCREEN_ROLES has
// to be made deliberately in two places.
const MATRIX: Record<AdminScreen, [boolean, boolean, boolean, boolean, boolean]> = {
  pulse: [true, true, true, true, true],
  growth: [false, false, true, false, true],
  calendar: [false, true, true, false, true],
  wishlists: [false, false, true, false, true],
  pools: [false, true, true, true, true],
  demand: [false, false, true, false, true],
  orders: [false, true, false, true, true],
  corporate: [false, true, true, true, true],
  diaspora: [false, false, true, true, true],
  segments: [false, false, true, false, true],
  money: [false, false, false, true, true],
  people: [true, true, true, false, true],
  reviews: [true, false, true, false, true],
  enquiries: [false, true, true, false, true],
  reminders: [false, true, false, false, true],
};

describe("admin permission matrix", () => {
  it.each(Object.entries(MATRIX))("%s matches the spec", (screen, expected) => {
    const actual = ADMIN_ROLES.map((role) => canAccessScreen(role, screen as AdminScreen));
    expect(actual).toEqual(expected);
  });

  it("denies customers and unknown values", () => {
    expect(canAccessScreen(null, "pulse")).toBe(false);
    expect(canAccessScreen(undefined, "pulse")).toBe(false);
    expect(canAccessScreen("customer" as AdminRole, "pulse")).toBe(false);
  });

  it("puts every screen in the nav exactly once", () => {
    const screens = ADMIN_NAV.flatMap((group) => group.items.map((item) => item.screen));
    expect(screens.sort()).toEqual(Object.keys(SCREEN_ROLES).sort());
  });

  it("filters the nav to permitted screens and drops empty groups", () => {
    const support = navForRole("support");
    expect(support.map((group) => group.label)).toEqual(["Overview", "People"]);
    expect(support.flatMap((group) => group.items.map((item) => item.screen))).toEqual(["pulse", "people", "reviews"]);
    const finance = navForRole("finance").flatMap((group) => group.items.map((item) => item.screen));
    expect(finance).not.toContain("people");
    expect(finance).toContain("money");
  });

  it("limits order status changes and payouts to the right roles", () => {
    expect(ADMIN_ROLES.filter((role) => canPerform(role, "updateOrderStatus"))).toEqual(["operations", "admin"]);
    expect(ADMIN_ROLES.filter((role) => canPerform(role, "updatePayout"))).toEqual(["operations", "finance", "admin"]);
  });

  it("resolves nested paths to their screen", () => {
    expect(navItemForPath("/admin/orders/abc")?.screen).toBe("orders");
    expect(navItemForPath("/admin/people")?.screen).toBe("people");
    expect(navItemForPath("/admin/pricing")).toBeNull();
  });
});
