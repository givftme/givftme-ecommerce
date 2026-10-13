import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trackEvent } from "@/lib/analytics";
import { isDefaultOgImage, ogRequest, stubOgFetch } from "@/lib/og/test-utils";
import { getPoolPageData } from "@/lib/pools/server";
import type { PoolPageData, PoolStatus } from "@/lib/pools/types";
import { GET } from "./route";

vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/pools/server", () => ({ getPoolPageData: vi.fn() }));

const mockedGetPoolPageData = vi.mocked(getPoolPageData);
const mockedTrackEvent = vi.mocked(trackEvent);

const TOKEN = "3f2a9c1e-8b7d-4e6f-a5b4-c3d2e1f0a9b8";

function poolData({
  status = "open",
  amountRaised = 125_000,
  itemPool = true,
}: { status?: PoolStatus; amountRaised?: number; itemPool?: boolean } = {}): PoolPageData {
  const person = { id: "receiver-1", full_name: "Tunde", avatar_url: null };

  return {
    pool: {
      id: "pool-1",
      wishlist_id: "wishlist-1",
      wishlist_item_id: itemPool ? "item-1" : null,
      created_by: "creator-1",
      receiver_id: "receiver-1",
      title: "Help Tunde get the laptop he has been saving towards for his final year project",
      message: null,
      target_amount: 500_000,
      amount_raised: amountRaised,
      min_contribution: 1500,
      token: TOKEN,
      status,
      contributors_visible: true,
      fully_funded_at: null,
      cashed_out_at: null,
      cashed_out_amount: null,
      created_at: "2026-10-01T00:00:00.000Z",
    },
    wishlist_title: "Birthday",
    receiver: person,
    creator: { ...person, id: "creator-1" },
    item: itemPool
      ? {
          id: "item-1",
          title: "MacBook Air",
          image_url: "https://images.example.test/laptop.png",
          price: 500_000,
          status: "available",
        }
      : null,
    contributor_count: 1,
    contributors: null,
    viewer_is_manager: false,
    viewer_is_receiver: false,
    viewer_is_creator: false,
  };
}

function get(token: string) {
  return GET(ogRequest(`/api/og/pool/${token}`), { params: Promise.resolve({ token }) });
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

describe("GET /api/og/pool/[token]", () => {
  it("renders an item pool with its progress", async () => {
    mockedGetPoolPageData.mockResolvedValue(poolData());

    const response = await get(TOKEN);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("public, max-age=900, s-maxage=3600");
    expect(await isDefaultOgImage(response)).toBe(false);
    expect(mockedGetPoolPageData).toHaveBeenCalledWith(TOKEN, null);
    expect(mockedTrackEvent).toHaveBeenCalledWith("og.pool_image.generated", {
      token: TOKEN,
      pool_type: "item",
      is_fully_funded: false,
    });
  });

  it("renders the fully funded state", async () => {
    mockedGetPoolPageData.mockResolvedValue(poolData({ status: "fully_funded", amountRaised: 500_000 }));

    const response = await get(TOKEN);

    expect(response.status).toBe(200);
    expect(mockedTrackEvent).toHaveBeenCalledWith(
      "og.pool_image.generated",
      expect.objectContaining({ is_fully_funded: true })
    );
  });

  it("treats a pool at its target as funded before its status catches up", async () => {
    mockedGetPoolPageData.mockResolvedValue(poolData({ amountRaised: 525_000, itemPool: false }));

    const response = await get(TOKEN);

    expect(response.status).toBe(200);
    expect(mockedTrackEvent).toHaveBeenCalledWith("og.pool_image.generated", {
      token: TOKEN,
      pool_type: "general",
      is_fully_funded: true,
    });
  });

  it("serves the brand image for an unknown pool", async () => {
    mockedGetPoolPageData.mockResolvedValue(null);

    const response = await get(TOKEN);

    expect(response.status).toBe(200);
    expect(await isDefaultOgImage(response)).toBe(true);
    expect(mockedTrackEvent).toHaveBeenCalledWith("og.image.fallback_used", {
      route: "pool",
      reason: "not_found",
    });
  });

  it("serves the brand image when the lookup throws", async () => {
    mockedGetPoolPageData.mockRejectedValue(new Error("connection reset"));

    const response = await get(TOKEN);

    expect(response.status).toBe(200);
    expect(await isDefaultOgImage(response)).toBe(true);
  });

  it("rejects a malformed token without querying", async () => {
    const response = await get("pool-123");

    expect(response.status).toBe(400);
    expect(await isDefaultOgImage(response)).toBe(true);
    expect(mockedGetPoolPageData).not.toHaveBeenCalled();
  });
});
