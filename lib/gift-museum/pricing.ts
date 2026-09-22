export interface MarkupDefaults {
  markupPercent: number;
  deliveryBufferNgn: number;
  roundingNgn: number;
}

export interface MarkupEstimate extends MarkupDefaults {
  basePriceNgn: number | null;
  recommendedPriceNgn: number | null;
}

function parseNumberEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function getMarkupDefaults(): MarkupDefaults {
  return {
    markupPercent: parseNumberEnv(process.env.FETCH_MARKUP_PERCENT, 25),
    deliveryBufferNgn: parseNumberEnv(process.env.FETCH_DELIVERY_BUFFER_NGN, 5000),
    roundingNgn: Math.max(1, parseNumberEnv(process.env.FETCH_ROUNDING_NGN, 500)),
  };
}

export function roundUpToNearest(value: number, nearest: number) {
  return Math.ceil(value / nearest) * nearest;
}

export function estimateMarkupPrice(
  sourcePrice: number | null | undefined,
  convertedPriceNgn: number | null | undefined,
  defaults = getMarkupDefaults()
): MarkupEstimate {
  const basePriceNgn =
    typeof convertedPriceNgn === "number"
      ? convertedPriceNgn
      : typeof sourcePrice === "number"
        ? sourcePrice
        : null;

  if (basePriceNgn === null) {
    return { ...defaults, basePriceNgn, recommendedPriceNgn: null };
  }

  const markedUp =
    basePriceNgn * (1 + defaults.markupPercent / 100) +
    defaults.deliveryBufferNgn;

  return {
    ...defaults,
    basePriceNgn,
    recommendedPriceNgn: roundUpToNearest(markedUp, defaults.roundingNgn),
  };
}

export function normalizeCurrency(currency: string | null | undefined) {
  return (currency || "NGN").trim().toUpperCase() || "NGN";
}
