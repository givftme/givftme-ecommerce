import { describe, expect, it } from "vitest";
import { businessViewer, isBusinessPage, navbarEntryLinks } from "@/lib/business/entry";

describe("isBusinessPage", () => {
  it("matches the landing page and its children only", () => {
    expect(isBusinessPage("/business")).toBe(true);
    expect(isBusinessPage("/business/plans")).toBe(true);
    expect(isBusinessPage("/business-dashboard")).toBe(false);
    expect(isBusinessPage("/")).toBe(false);
  });
});

describe("businessViewer", () => {
  it("treats anyone signed out as a guest", () => {
    expect(businessViewer({ signedIn: false, accountType: "business", isMember: true })).toBe("guest");
  });

  it("needs both the business account type and a membership for the dashboard", () => {
    expect(businessViewer({ signedIn: true, accountType: "business", isMember: true })).toBe("business");
  });

  it("separates personal accounts from logins whose records disagree", () => {
    expect(businessViewer({ signedIn: true, accountType: "consumer", isMember: false })).toBe("consumer");
    expect(businessViewer({ signedIn: true, accountType: null, isMember: false })).toBe("consumer");
    expect(businessViewer({ signedIn: true, accountType: "business", isMember: false })).toBe("incomplete");
    expect(businessViewer({ signedIn: true, accountType: "consumer", isMember: true })).toBe("incomplete");
    expect(businessViewer({ signedIn: true, accountType: null, isMember: true })).toBe("incomplete");
  });
});

describe("navbarEntryLinks", () => {
  it("leads into the business account system from the business page", () => {
    expect(navbarEntryLinks("/business", "ref=ad")).toEqual({
      signInHref: "/business-dashboard/auth",
      getStartedHref: "/get-started?hint=business",
    });
  });

  it("keeps the consumer login, returning to the current page, everywhere else", () => {
    expect(navbarEntryLinks("/shop", "sort=price")).toEqual({
      signInHref: `/login?redirect=${encodeURIComponent("/shop?sort=price")}`,
      getStartedHref: "/get-started",
    });
  });
});
