// Meal types the user can ask for. UI, validation and the generator all read from here.
import type { MealType } from "./library";

export const MEAL_TYPES = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
] as const satisfies readonly { value: MealType; label: string }[];

/** Share of the daily calorie and protein targets each meal covers. Adds up to 1. */
export const MEAL_SHARE: Record<MealType, number> = { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snack: 0.1 };

export const isMealType = (v: unknown): v is MealType => MEAL_TYPES.some((m) => m.value === v);
export const mealLabel = (v: MealType) => MEAL_TYPES.find((m) => m.value === v)?.label ?? v;

/** Morning → breakfast, midday → lunch, and so on, as a default choice. */
export function mealTypeForHour(hour: number): MealType {
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 17) return "snack";
  return "dinner";
}
