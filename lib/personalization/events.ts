// The behaviour we record, and the small facts stored with each event. Nothing personal beyond what the
// app already knows: no free text, no location, no device info.

import type { Gear, Pattern } from "@/lib/workouts/library";

export const WORKOUT_EVENTS = [
  "workout_generated", "workout_refreshed", "workout_completed", "workout_skipped",
  "exercise_completed", "exercise_skipped", "exercise_replaced", "exercise_removed", "exercise_added",
] as const;
export const MEAL_EVENTS = [
  "meal_generated", "meal_viewed", "meal_saved", "meal_unsaved", "meal_ignored", "meal_logged",
] as const;

export type WorkoutEventType = (typeof WORKOUT_EVENTS)[number];
export type MealEventType = (typeof MEAL_EVENTS)[number];
export type EventType = WorkoutEventType | MealEventType;

export type WorkoutEventMeta = { focus?: string | null; duration_min?: number; exercises_done?: number; exercises_total?: number };

/** Library exercises carry their gear and pattern; the user's own typed exercises have `custom: true`. */
export type ExerciseEventMeta = {
  stage?: "warmup" | "main" | "finisher" | "cooldown";
  muscle?: string | null;
  gear?: Gear;
  pattern?: Pattern;
  custom?: boolean;
  /** exercise_replaced: what the user swapped in */
  replaced_with?: string;
  replaced_with_gear?: Gear;
};

/** What meal events need so meal preferences can be learned (meal generation, step 9, should send these). */
export type MealEventMeta = {
  name: string;
  cuisine?: string | null;
  meal_type?: string | null;
  prep_time_min?: number | null;
  calories?: number | null;
  protein_g?: number | null;
  ingredients?: string[];
  /** Whether the meal fits the user's calorie and protein targets for that meal */
  fits_targets?: boolean;
};

export type NewEvent =
  | { event_type: WorkoutEventType; entity_type: "workout"; entity_id: string; metadata: WorkoutEventMeta }
  | { event_type: WorkoutEventType; entity_type: "exercise"; entity_id: string; metadata: ExerciseEventMeta }
  | { event_type: MealEventType; entity_type: "meal"; entity_id: string; metadata: MealEventMeta };

/**
 * Exercise names are the ids for exercise events. Library names are sentence case, so typed names are put in
 * sentence case too: "kettlebell  SWINGS" and "Kettlebell swings" count as the same exercise.
 */
export const exerciseKey = (name: string) => {
  const clean = name.trim().replace(/\s+/g, " ").toLowerCase();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
};
