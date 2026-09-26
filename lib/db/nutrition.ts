import type { SupabaseClient } from "@supabase/supabase-js";
import type { NutritionTargets } from "@/lib/nutrition/calculations";
import type { NutritionProfile } from "@/types/database";

export async function getNutritionProfile(db: SupabaseClient, userId: string): Promise<NutritionProfile | null> {
  const { data, error } = await db.from("nutrition_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data as NutritionProfile | null;
}

export async function upsertNutritionProfile(db: SupabaseClient, userId: string, targets: NutritionTargets) {
  const { error } = await db.from("nutrition_profiles").upsert({ user_id: userId, ...targets });
  if (error) throw error;
}
