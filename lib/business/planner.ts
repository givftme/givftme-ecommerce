export const PLANNER_OCCASIONS = ["bday", "csw", "parents", "eoy", "hangout"] as const;
export type PlannerOccasion = (typeof PLANNER_OCCASIONS)[number];

export interface GiftingEstimate {
  gifts: number;
  total: number;
  plan: string;
}

/**
 * A rough yearly gifting budget for the business page planner. Every ticked
 * occasion gifts the whole team once, except hangouts: four a year, with one
 * shared gift per ten people. The final quote comes from the Experience Centre.
 */
export function estimateGiftingYear(
  teamSize: number,
  budgetPerGift: number,
  occasions: readonly PlannerOccasion[],
): GiftingEstimate {
  const gifts = occasions.reduce(
    (sum, occasion) => sum + (occasion === "hangout" ? Math.ceil(teamSize / 10) * 4 : teamSize),
    0,
  );
  const hasBirthdays = occasions.includes("bday");
  const hasSeasons = occasions.some((occasion) => occasion !== "bday");
  const plan =
    hasBirthdays && hasSeasons
      ? "Pulse + Seasons"
      : hasBirthdays
        ? "Pulse"
        : hasSeasons
          ? "Seasons"
          : "Pick an occasion";

  return { gifts, total: gifts * budgetPerGift, plan };
}
