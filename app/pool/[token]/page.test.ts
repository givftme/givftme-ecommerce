import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPoolPageData } from "@/lib/pools/server";
import type { PoolPageData } from "@/lib/pools/types";
import { formatPrice } from "@/lib/utils";
import { generateMetadata } from "./page";

vi.mock("@/lib/pools/server", () => ({ getPoolPageData: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(), createServiceClient: vi.fn() }));
vi.mock("@/components/layout/PageWrapper", () => ({ PageWrapper: () => null }));
vi.mock("@/components/pools/PoolPageClient", () => ({ PoolPageClient: () => null }));

const mockedGetPoolPageData = vi.mocked(getPoolPageData);

const TOKEN = "3f2a9c1e-8b7d-4e6f-a5b4-c3d2e1f0a9b8";

function poolData(overrides: { wishlist_item_id?: string | null; item?: PoolPageData["item"] } = {}): PoolPageData {
  const person = { id: "receiver-1", full_name: "Tunde", avatar_url: null };

  return {
    pool: {
      id: "pool-1",
      wishlist_id: "wishlist-1",
      wishlist_item_id: overrides.wishlist_item_id === undefined ? "item-1" : overrides.wishlist_item_id,
      created_by: "creator-1",
      receiver_id: "receiver-1",
      title: "Help Tunde get his laptop",
      message: null,
      target_amount: 500_000,
      amount_raised: 125_000,
      min_contribution: 1500,
      token: TOKEN,
      status: "open",
      contributors_visible: true,
      fully_funded_at: null,
      cashed_out_at: null,
      cashed_out_amount: null,
      created_at: "2026-10-01T00:00:00.000Z",
    },
    wishlist_title: "Birthday",
    receiver: person,
    creator: { ...person, id: "creator-1", full_name: "Kemi" },
    item: overrides.item === undefined
      ? { id: "item-1", title: "MacBook Air", image_url: null, price: 500_000, status: "available" }
      : overrides.item,
    contributor_count: 4,
    contributors: null,
    viewer_is_manager: false,
    viewer_is_receiver: false,
    viewer_is_creator: false,
  };
}

async function metadataFor(token = TOKEN) {
  return generateMetadata({ params: Promise.resolve({ token }) });
}

beforeEach(() => vi.clearAllMocks());

describe("gift pool metadata", () => {
  it("names the item for an item pool", async () => {
    mockedGetPoolPageData.mockResolvedValue(poolData());
    const metadata = await metadataFor();

    expect(metadata.title).toEqual({ absolute: "Help Tunde get his laptop — Gift Pool on Givftme" });
    expect(metadata.description).toBe(
      `4 people have contributed ${formatPrice(125_000)} of ${formatPrice(500_000)} towards MacBook Air. Join the pool!`
    );
    expect(metadata.openGraph?.images).toEqual([
      expect.objectContaining({ url: `/api/og/pool/${TOKEN}`, width: 1200, height: 630 }),
    ]);
    expect(metadata.twitter).toEqual(
      expect.objectContaining({ card: "summary_large_image", images: [`/api/og/pool/${TOKEN}`] })
    );
    expect(mockedGetPoolPageData).toHaveBeenCalledWith(TOKEN, null);
  });

  it("names the receiver for a general pool", async () => {
    mockedGetPoolPageData.mockResolvedValue(poolData({ wishlist_item_id: null, item: null }));
    const metadata = await metadataFor();

    expect(metadata.description).toBe(
      `4 people have contributed ${formatPrice(125_000)} of ${formatPrice(500_000)} for Tunde. Join the pool!`
    );
  });

  it("falls back to a generic title for an unknown or malformed token", async () => {
    mockedGetPoolPageData.mockResolvedValue(null);
    expect((await metadataFor()).title).toBe("Gift Pool");

    expect((await metadataFor("not-a-token")).title).toBe("Gift Pool");
    expect(mockedGetPoolPageData).toHaveBeenCalledTimes(1);
  });
});
