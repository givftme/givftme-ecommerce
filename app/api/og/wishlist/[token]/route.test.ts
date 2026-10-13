import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trackEvent } from "@/lib/analytics";
import { isDefaultOgImage, ogRequest, stubOgFetch } from "@/lib/og/test-utils";
import { getWishlistOgData, type WishlistOgData } from "@/lib/og/wishlist";
import { GET } from "./route";

vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/og/wishlist", () => ({ getWishlistOgData: vi.fn() }));

const mockedGetWishlistOgData = vi.mocked(getWishlistOgData);
const mockedTrackEvent = vi.mocked(trackEvent);

const TOKEN = "0123456789abcdef0123456789abcdef";

function data(overrides: Partial<WishlistOgData> = {}): WishlistOgData {
  return {
    receiverName: "Amaka",
    avatarUrl: "https://images.example.test/avatar.png",
    occasionTitle: "Birthday",
    occasionDate: "2026-11-01",
    availableCount: 5,
    imageUrls: [
      "https://images.example.test/one.png",
      "https://images.example.test/two.webp",
      "https://images.example.test/three.png",
    ],
    ...overrides,
  };
}

function get(token: string) {
  return GET(ogRequest(`/api/og/wishlist/${token}`), { params: Promise.resolve({ token }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  stubOgFetch();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/og/wishlist/[token]", () => {
  it("renders a personalised PNG for a public wishlist", async () => {
    mockedGetWishlistOgData.mockResolvedValue({ kind: "ok", data: data() });

    const response = await get(TOKEN);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
    );
    expect(await isDefaultOgImage(response)).toBe(false);
    expect(mockedTrackEvent).toHaveBeenCalledWith("og.wishlist_image.generated", {
      token: TOKEN,
      has_avatar: true,
      item_count: 5,
    });
  });

  it("renders the gift fallback when no item image is usable", async () => {
    mockedGetWishlistOgData.mockResolvedValue({
      kind: "ok",
      data: data({ avatarUrl: "/relative/avatar.png", imageUrls: ["https://images.example.test/x.webp"] }),
    });

    const response = await get(TOKEN);

    expect(response.status).toBe(200);
    expect(await isDefaultOgImage(response)).toBe(false);
    expect(mockedTrackEvent).toHaveBeenCalledWith(
      "og.wishlist_image.generated",
      expect.objectContaining({ has_avatar: false })
    );
  });

  it("serves the brand image for a private wishlist", async () => {
    mockedGetWishlistOgData.mockResolvedValue({ kind: "private" });

    const response = await get(TOKEN);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(await isDefaultOgImage(response)).toBe(true);
    expect(mockedTrackEvent).toHaveBeenCalledWith("og.image.fallback_used", {
      route: "wishlist",
      reason: "private",
    });
  });

  it("serves the brand image for an unknown token", async () => {
    mockedGetWishlistOgData.mockResolvedValue({ kind: "not_found" });

    const response = await get(TOKEN);

    expect(response.status).toBe(200);
    expect(await isDefaultOgImage(response)).toBe(true);
  });

  it("serves the brand image with a short cache when the lookup fails", async () => {
    mockedGetWishlistOgData.mockResolvedValue({ kind: "db_error" });

    const response = await get(TOKEN);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=60, s-maxage=60");
    expect(await isDefaultOgImage(response)).toBe(true);
  });

  it("rejects a malformed token without querying", async () => {
    const response = await get("not-a-token");

    expect(response.status).toBe(400);
    expect(await isDefaultOgImage(response)).toBe(true);
    expect(mockedGetWishlistOgData).not.toHaveBeenCalled();
  });
});
