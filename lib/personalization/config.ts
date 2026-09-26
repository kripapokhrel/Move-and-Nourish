// Every tunable number for personalization. Change these to make learning faster or more cautious.

/** Only the last 90 days of behaviour count, so old habits fade out. */
export const WINDOW_DAYS = 90;
/** An event this many days old counts half as much as one from today. */
export const HALF_LIFE_DAYS = 30;
/** A pattern needs at least this many raw events before we call it a preference. */
export const MIN_EVIDENCE = 3;
/** Pretend there are this many neutral events, so 3 out of 3 isn't treated as certain. */
export const CONFIDENCE_PRIOR = 2;
/** Inferences below this confidence are kept as signals only, never used or shown. */
export const MIN_CONFIDENCE = 0.5;
/** Workouts completed before any workout personalization kicks in. */
export const MIN_COMPLETED_WORKOUTS = 3;
/** Most events read when recalculating a summary. */
export const MAX_EVENTS = 3000;
/** Bump when aggregation rules change, so old summaries are recalculated. */
export const SUMMARY_VERSION = 1;

export const MEAL_DISLIKE_REASONS = [
  { value: "too_complicated", label: "Too complicated" },
  { value: "ingredients", label: "Didn't like the ingredients" },
  { value: "too_long", label: "Too time-consuming" },
  { value: "not_filling", label: "Not filling" },
  { value: "not_my_style", label: "Didn't match my preferences" },
] as const;
export type MealDislikeReason = (typeof MEAL_DISLIKE_REASONS)[number]["value"];
