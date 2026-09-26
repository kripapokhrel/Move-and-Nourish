import type { SupabaseClient } from "@supabase/supabase-js";
import type { MealHistory, MealWithSaved } from "@/types/database";

export type NewMeal = Omit<MealHistory, "id" | "user_id" | "created_at" | "made_at" | "source_input"> & { source_input?: string | null };

const withSaved = (rows: (MealHistory & { saved_meals: { id: string }[] })[]): MealWithSaved[] =>
  rows.map(({ saved_meals, ...m }) => ({ ...m, saved: saved_meals.length > 0 }));

const SELECT = "*, saved_meals(id)";

export async function insertMeals(db: SupabaseClient, userId: string, meals: NewMeal[]) {
  const { data, error } = await db
    .from("meal_history")
    .insert(meals.map((m) => ({ ...m, user_id: userId })))
    .select("id, library_id");
  if (error) throw error;
  return (data ?? []) as { id: string; library_id: string }[];
}

/** The most recent set of ideas from one source ("recommend" or "fridge"), optionally for one meal type. */
export async function getLatestBatch(
  db: SupabaseClient, userId: string, source: MealHistory["source"], mealType?: string,
): Promise<MealWithSaved[]> {
  let query = db
    .from("meal_history")
    .select("batch_id")
    .eq("user_id", userId)
    .eq("source", source)
    .not("batch_id", "is", null);
  if (mealType) query = query.eq("meal_type", mealType);
  const { data: last, error } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!last?.batch_id) return [];
  const { data, error: batchError } = await db
    .from("meal_history")
    .select(SELECT)
    .eq("user_id", userId)
    .eq("batch_id", last.batch_id)
    .order("created_at", { ascending: true });
  if (batchError) throw batchError;
  return withSaved(data ?? []);
}

/** Recipe ids shown in recent batches, so new ideas can avoid them. */
export async function getRecentLibraryIds(db: SupabaseClient, userId: string, limit = 12) {
  const { data, error } = await db
    .from("meal_history")
    .select("library_id")
    .eq("user_id", userId)
    .not("library_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => r.library_id as string);
}

export async function getMeal(db: SupabaseClient, userId: string, mealId: string): Promise<MealWithSaved | null> {
  const { data, error } = await db.from("meal_history").select(SELECT).eq("id", mealId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data ? withSaved([data])[0] : null;
}

export async function getSavedMeals(db: SupabaseClient, userId: string, limit = 30): Promise<MealWithSaved[]> {
  const { data, error } = await db
    .from("saved_meals")
    .select("created_at, meal_history(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as { meal_history: MealHistory }[]).map((r) => ({ ...r.meal_history, saved: true }));
}

/**
 * Meals the user saved or made, most recent first. Falls back to the latest ideas when there are none yet,
 * so the dashboard isn't empty after a first try.
 */
export async function getRecentMeals(db: SupabaseClient, userId: string, limit = 5): Promise<{ meals: MealWithSaved[]; kept: boolean }> {
  const { data, error } = await db
    .from("meal_history")
    .select(SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw error;
  const all = withSaved(data ?? []);
  const kept = all
    .filter((m) => m.saved || m.made_at)
    .sort((a, b) => (b.made_at ?? b.created_at).localeCompare(a.made_at ?? a.created_at));
  return kept.length ? { meals: kept.slice(0, limit), kept: true } : { meals: all.slice(0, limit), kept: false };
}

export async function saveMeal(db: SupabaseClient, userId: string, mealId: string) {
  const { error } = await db.from("saved_meals").upsert({ user_id: userId, meal_id: mealId }, { onConflict: "user_id,meal_id" });
  if (error) throw error;
}

export async function unsaveMeal(db: SupabaseClient, userId: string, mealId: string) {
  const { error } = await db.from("saved_meals").delete().eq("user_id", userId).eq("meal_id", mealId);
  if (error) throw error;
}

export async function markMealMade(db: SupabaseClient, userId: string, mealId: string) {
  const { error } = await db.from("meal_history").update({ made_at: new Date().toISOString() }).eq("id", mealId).eq("user_id", userId);
  if (error) throw error;
}
