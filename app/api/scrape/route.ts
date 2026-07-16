import { NextResponse } from "next/server";
import { readJson, jsonError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { scrapeProductUrl } from "@/lib/scraper/microlink";
import { scrapeRequestSchema } from "@/lib/wishlist/validation";
import { getAuthenticatedApiUser } from "@/lib/wishlist/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getAuthenticatedApiUser(supabase);

  if (!user) {
    return jsonError("You need to sign in first.", 401);
  }

  const body = await readJson(request);
  const parsed = scrapeRequestSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Enter a valid URL.", 400);
  }

  const host = new URL(parsed.data.url).hostname.toLowerCase();

  // Amazon actively blocks many metadata scrapers, so the UI should fall back
  // to manual entry immediately instead of making the user wait.
  if (host.includes("amazon.")) {
    return jsonError("Amazon items need to be added manually.", 422);
  }

  try {
    const product = await scrapeProductUrl(parsed.data.url);

    return NextResponse.json({ product });
  } catch {
    return jsonError("We couldn't read that page automatically.", 422);
  }
}
