"use client";

import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react";
import type { BusinessOccasion, BusinessTeamSize } from "@/lib/business/validation";
import { BRAND_SWATCHES, DEFAULT_BRAND_NAME, GIFT_CARD_VALUES } from "@/app/business/_components/content";

/** What a section CTA hands the Experience Centre form before scrolling to it. */
export interface BriefInput {
  occasions?: BusinessOccasion[];
  note?: string;
  teamSize?: BusinessTeamSize;
}

export interface Brief extends BriefInput {
  /** Bumped on every request, so repeating the same brief still applies. */
  id: number;
}

interface BusinessContextValue {
  /** The raw studio input; `displayName` is what gets printed on gifts. */
  brandName: string;
  displayName: string;
  setBrandName: (name: string) => void;
  brandColor: string;
  setBrandColor: (color: string) => void;
  giftCardValue: number;
  setGiftCardValue: (value: number) => void;
  brief: Brief | null;
  planBrief: (brief: BriefInput) => void;
}

const BusinessContext = createContext<BusinessContextValue | null>(null);

export function useBusiness() {
  const value = useContext(BusinessContext);
  if (!value) throw new Error("useBusiness must be used inside <BusinessProvider>");
  return value;
}

/**
 * Shares the visitor's brand between the studio and the gift card preview,
 * and carries section CTAs' context into the Experience Centre brief.
 */
export function BusinessProvider({ children }: { children: ReactNode }) {
  const [brandName, setBrandName] = useState(DEFAULT_BRAND_NAME);
  const [brandColor, setBrandColor] = useState(BRAND_SWATCHES[0].value);
  const [giftCardValue, setGiftCardValue] = useState(GIFT_CARD_VALUES[1]);
  const [brief, setBrief] = useState<Brief | null>(null);

  const planBrief = useCallback((input: BriefInput) => {
    setBrief((current) => ({ ...input, id: (current?.id ?? 0) + 1 }));
  }, []);

  const value = useMemo(
    () => ({
      brandName,
      displayName: brandName.trim() || DEFAULT_BRAND_NAME,
      setBrandName,
      brandColor,
      setBrandColor,
      giftCardValue,
      setGiftCardValue,
      brief,
      planBrief,
    }),
    [brandName, brandColor, giftCardValue, brief, planBrief],
  );

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}
