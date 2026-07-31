export type GiftSource = "purchase" | "order";

export interface GiftReceived {
  id: string;
  source: GiftSource;
  itemTitle: string;
  itemImageUrl: string | null;
  buyerName: string | null;
  purchasedAt: string;
  autoThankYouSent: boolean;
  personalThankYouSent: boolean;
}
