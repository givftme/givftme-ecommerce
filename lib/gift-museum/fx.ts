import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeCurrency } from "@/lib/gift-museum/pricing";

interface ExchangeRateResponse {
  result?: string;
  time_last_update_utc?: string;
  conversion_rates?: Record<string, number>;
  "error-type"?: string;
}

export interface CurrencyConversion {
  convertedPriceNgn: number;
  rate: number;
  source: string;
  asOf: string;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function convertToNgn(
  supabase: SupabaseClient,
  amount: number | null | undefined,
  currency: string | null | undefined
): Promise<CurrencyConversion | null> {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const baseCurrency = normalizeCurrency(currency);
  const asOf = todayIsoDate();

  if (baseCurrency === "NGN") {
    return {
      convertedPriceNgn: Math.round(amount),
      rate: 1,
      source: "native-ngn",
      asOf,
    };
  }

  const cached = await supabase
    .from("exchange_rates")
    .select("rate, source, as_of")
    .eq("base_currency", baseCurrency)
    .eq("quote_currency", "NGN")
    .eq("as_of", asOf)
    .maybeSingle();

  if (!cached.error && cached.data?.rate) {
    const rate = Number(cached.data.rate);
    return {
      convertedPriceNgn: Math.round(amount * rate),
      rate,
      source: cached.data.source || "exchangerate-api",
      asOf: cached.data.as_of || asOf,
    };
  }

  const apiKey = process.env.EXCHANGERATE_API_KEY;
  if (!apiKey) {
    return null;
  }

  const response = await fetch(
    `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${baseCurrency}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error("ExchangeRate API request failed.");
  }

  const payload = (await response.json()) as ExchangeRateResponse;
  const rate = payload.conversion_rates?.NGN;

  if (payload.result !== "success" || typeof rate !== "number") {
    throw new Error(payload["error-type"] || "ExchangeRate API returned no NGN rate.");
  }

  await supabase.from("exchange_rates").upsert(
    {
      base_currency: baseCurrency,
      quote_currency: "NGN",
      rate,
      source: "exchangerate-api",
      as_of: asOf,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "base_currency,quote_currency,as_of" }
  );

  return {
    convertedPriceNgn: Math.round(amount * rate),
    rate,
    source: "exchangerate-api",
    asOf,
  };
}
