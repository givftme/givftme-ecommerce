import { describe, expect, it } from "vitest";
import {
  daysBetween,
  deviceFromUserAgent,
  eventContextFromHeaders,
  priceBand,
  referrerListIdFromPath,
} from "@/lib/events/context";

describe("deviceFromUserAgent", () => {
  it("classifies common agents", () => {
    expect(deviceFromUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148")).toBe("mobile");
    expect(deviceFromUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36")).toBe("mobile");
    expect(deviceFromUserAgent("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe("tablet");
    expect(deviceFromUserAgent("Mozilla/5.0 (Linux; Android 13; SM-X200) Safari/537.36")).toBe("tablet");
    expect(deviceFromUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0")).toBe("desktop");
    expect(deviceFromUserAgent(null)).toBeNull();
  });
});

describe("eventContextFromHeaders", () => {
  it("reads Vercel geo headers", () => {
    const headers = new Headers({ "x-vercel-ip-country": "gb", "x-vercel-ip-city": "S%C3%A3o%20Paulo" });
    expect(eventContextFromHeaders(headers)).toEqual({ device: null, city: "São Paulo", country: "GB" });
  });

  it("drops malformed countries so the column default applies", () => {
    expect(eventContextFromHeaders(new Headers({ "x-vercel-ip-country": "XX1" })).country).toBeNull();
    expect(eventContextFromHeaders(new Headers()).country).toBeNull();
  });
});

describe("referrerListIdFromPath", () => {
  const id = "11111111-2222-4333-8444-555555555555";
  it("extracts a shared wishlist id", () => {
    expect(referrerListIdFromPath(`/w/${id}`)).toBe(id);
    expect(referrerListIdFromPath(`/w/${id}/item/abc`)).toBe(id);
    expect(referrerListIdFromPath(`/w/${id}?invite=1`)).toBe(id);
  });
  it("ignores other paths", () => {
    expect(referrerListIdFromPath("/wishlists")).toBeNull();
    expect(referrerListIdFromPath(`/x/w/${id}`)).toBeNull();
    expect(referrerListIdFromPath(null)).toBeNull();
  });
});

describe("priceBand", () => {
  it("buckets naira prices", () => {
    expect(priceBand(null)).toBeNull();
    expect(priceBand(9_999)).toBe("under_10k");
    expect(priceBand(10_000)).toBe("10k_25k");
    expect(priceBand(99_999)).toBe("50k_100k");
    expect(priceBand(250_000)).toBe("100k_plus");
  });
});

describe("daysBetween", () => {
  it("counts Lagos calendar days", () => {
    // 23:30 UTC on the 1st is 00:30 on the 2nd in Lagos (UTC+1).
    expect(daysBetween(new Date("2026-03-01T23:30:00Z"), new Date("2026-03-02T12:00:00Z"))).toBe(0);
    expect(daysBetween(new Date("2026-03-01T10:00:00Z"), new Date("2026-03-15T10:00:00Z"))).toBe(14);
    expect(daysBetween(new Date("2026-03-15T10:00:00Z"), new Date("2026-03-10T10:00:00Z"))).toBe(-5);
  });
});
