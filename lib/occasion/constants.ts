export const OCCASION_TYPES = [
  "birthday",
  "wedding",
  "anniversary",
  "baby_shower",
  "graduation",
  "other",
] as const;

export const OCCASION_EMOJIS: Record<(typeof OCCASION_TYPES)[number], string> = {
  birthday: "🎂",
  wedding: "💍",
  anniversary: "💑",
  baby_shower: "👶",
  graduation: "🎓",
  other: "🎉",
};

export const OCCASION_LABELS: Record<(typeof OCCASION_TYPES)[number], string> = {
  birthday: "Birthday",
  wedding: "Wedding",
  anniversary: "Anniversary",
  baby_shower: "Baby Shower",
  graduation: "Graduation",
  other: "Other",
};

export const OCCASION_TITLE_SUGGESTIONS: Record<
  (typeof OCCASION_TYPES)[number],
  string
> = {
  birthday: "My Birthday",
  wedding: "Our Wedding",
  anniversary: "Our Anniversary",
  baby_shower: "Our Baby Shower",
  graduation: "My Graduation",
  other: "My Celebration",
};
