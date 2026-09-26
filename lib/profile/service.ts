import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { upsertProfile } from "@/lib/db/profiles";
import { upsertNutritionProfile } from "@/lib/db/nutrition";
import { calculateNutrition } from "@/lib/nutrition/calculations";
import type { ProfileInput } from "./schema";

/**
 * The one place profile changes happen. Onboarding and Settings both call this,
 * so nutrition targets are always recalculated from the latest profile.
 * Workouts and meals read the profile fresh on each generation, so they pick up changes automatically.
 */
export async function saveProfileAndRecalculate(db: SupabaseClient, userId: string, input: ProfileInput) {
  const profile = await upsertProfile(db, userId, input);
  const targets = calculateNutrition(profile);
  await upsertNutritionProfile(db, userId, targets);
  return { profile, targets };
}
