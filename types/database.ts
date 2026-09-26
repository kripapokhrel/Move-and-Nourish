// Hand-written row types for the tables used so far.
// Later you can replace this with generated types:
//   npx supabase gen types typescript --project-id <id> > types/supabase.ts

import type { ProfileInput } from "@/lib/profile/schema";

export type Profile = ProfileInput & {
  id: string;
  /** Missing until migration 0004 is run; treat undefined as on. */
  personalization_enabled?: boolean;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkoutExercise = {
  id: string;
  workout_id: string;
  position: number;
  exercise_name: string;
  muscle_group: string | null;
  sets: number | null;
  reps: string | null;
  rest_seconds: number | null;
  instructions: string | null;
  completed: boolean;
};

export type Workout = {
  id: string;
  user_id: string;
  plan_id: string | null;
  name: string;
  focus: string | null;
  notes: string | null;
  user_notes: string | null;
  scheduled_date: string | null;
  goal: string | null;
  fitness_level: string | null;
  duration_min: number | null;
  status: "planned" | "completed" | "skipped";
  completed_at: string | null;
  /** Why this workout was personalized. Missing until migration 0004 is run. */
  personalized_because?: string[] | null;
  created_at: string;
};

export type WorkoutWithExercises = Workout & { workout_exercises: WorkoutExercise[] };

export type NutritionProfile = {
  user_id: string;
  bmi: number;
  bmr: number;
  activity_multiplier: number;
  tdee: number;
  calorie_target: number;
  protein_target_g: number;
  carb_target_g: number;
  fat_target_g: number;
  calculation_method: string;
  updated_at: string;
};

// ---------- personalization (0004) ----------

export type UserEvent = {
  id: string;
  user_id: string;
  event_type: string;
  entity_type: "workout" | "exercise" | "meal" | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type PreferenceCategory = "exercise" | "ingredient" | "cuisine" | "meal_type" | "workout_focus";

export type UserPreference = {
  id: string;
  user_id: string;
  category: PreferenceCategory;
  value: string;
  sentiment: "like" | "dislike";
  created_at: string;
};

export type FeedbackRating = "too_easy" | "just_right" | "too_hard" | "like" | "dislike";

export type RecommendationFeedback = {
  id: string;
  user_id: string;
  target_type: "workout" | "exercise" | "meal";
  target_id: string;
  rating: FeedbackRating;
  reasons: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

// ---------- meals ----------

export type MealHistory = {
  id: string;
  user_id: string;
  meal_name: string;
  /** grams is missing on meals saved before nutrition came from USDA data */
  ingredients: { item: string; quantity: string; grams?: number; optional?: true }[];
  instructions: string[];
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  prep_time_min: number | null;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack" | "post_workout" | "any" | null;
  cuisine: string | null;
  source: "fridge" | "recommend" | "manual";
  source_input: string | null;
  library_id: string | null;
  batch_id: string | null;
  made_at: string | null;
  fits_targets: boolean | null;
  personalized_because: string[] | null;
  created_at: string;
};

/** A meal plus whether the user saved it. */
export type MealWithSaved = MealHistory & { saved: boolean };
