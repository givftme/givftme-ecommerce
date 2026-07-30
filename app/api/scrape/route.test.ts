import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";
import { scrapeProductUrl } from "@/lib/scraper/microlink";
import { POST } from "./route";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/wishlist/server", () => ({
  getAuthenticatedApiUser: vi.fn(),
}));

vi.mock("@/lib/scraper/microlink", () => ({
  scrapeProductUrl: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);
const mockedGetAuthenticatedApiUser = vi.mocked(getAuthenticatedApiUser);
const mockedScrapeProductUrl = vi.mocked(scrapeProductUrl);

function postRequest(body: unknown) {
  return new Request("http://localhost/api/scrape", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/scrape", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error only the fields getAuthenticatedApiUser reads are relevant here
    mockedCreateClient.mockResolvedValue({});
  });

  it("returns 401 when there is no authenticated user", async () => {
    mockedGetAuthenticatedApiUser.mockResolvedValue(null);

    const response = await POST(postRequest({ url: "https://www.jumia.com.ng/product" }));

    expect(response.status).toBe(401);
    expect(mockedScrapeProductUrl).not.toHaveBeenCalled();
  });

  it("returns 400 when the URL fails validation", async () => {
    mockedGetAuthenticatedApiUser.mockResolvedValue({ id: "user-1" } as User);

    const response = await POST(postRequest({ url: "not-a-url" }));

    expect(response.status).toBe(400);
    expect(mockedScrapeProductUrl).not.toHaveBeenCalled();
  });

  it("returns 422 for an Amazon URL without calling the scraper", async () => {
    mockedGetAuthenticatedApiUser.mockResolvedValue({ id: "user-1" } as User);

    const response = await POST(
      postRequest({ url: "https://www.amazon.com/dp/B000000000" }),
    );
    const json = await response.json();

    expect(response.status).toBe(422);
    expect(json.error).toBe("Amazon items need to be added manually.");
    expect(mockedScrapeProductUrl).not.toHaveBeenCalled();
  });

  it("returns the scraped product on success", async () => {
    mockedGetAuthenticatedApiUser.mockResolvedValue({ id: "user-1" } as User);
    mockedScrapeProductUrl.mockResolvedValue({
      title: "Espresso machine",
      image_url: "https://example.com/image.jpg",
      price: 45000,
      currency: "NGN",
      product_url: "https://www.jumia.com.ng/product",
    });

    const response = await POST(
      postRequest({ url: "https://www.jumia.com.ng/product" }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.product).toEqual({
      title: "Espresso machine",
      image_url: "https://example.com/image.jpg",
      price: 45000,
      currency: "NGN",
      product_url: "https://www.jumia.com.ng/product",
    });
    expect(mockedScrapeProductUrl).toHaveBeenCalledWith(
      "https://www.jumia.com.ng/product",
    );
  });

  it("returns 422 when the scraper throws", async () => {
    mockedGetAuthenticatedApiUser.mockResolvedValue({ id: "user-1" } as User);
    mockedScrapeProductUrl.mockRejectedValue(new Error("timeout"));

    const response = await POST(
      postRequest({ url: "https://www.jumia.com.ng/product" }),
    );
    const json = await response.json();

    expect(response.status).toBe(422);
    expect(json.error).toBe("We couldn't read that page automatically.");
  });
});
