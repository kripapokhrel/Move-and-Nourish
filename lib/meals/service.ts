import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getLatestBatch, getMeal, getRecentLibraryIds, insertMeals, markMealMade, saveMeal, unsaveMeal,
} from "@/lib/db/meals";
import { getNutritionProfile } from "@/lib/db/nutrition";
import { deleteFeedback, getFeedbackFor, upsertFeedback } from "@/lib/db/personalization";
import { getProfile } from "@/lib/db/profiles";
import type { MealDislikeReason } from "@/lib/personalization/config";
import type { MealEventMeta, MealEventType, NewEvent } from "@/lib/personalization/events";
import { loadPreferences, refreshSummaryQuietly, track } from "@/lib/personalization/service";
import type { MealHistory, MealWithSaved, Profile } from "@/types/database";
import { suggestFromFridge } from "./fridge";
import { fitOf, mealTarget, suggestMeals, toCandidate } from "./generator";
import type { MealType, Recipe } from "./library";

/** The facts personalization learns from, taken from a saved meal row. */
export const mealMeta = (m: MealHistory): MealEventMeta => ({
  name: m.meal_name,
  cuisine: m.cuisine,
  meal_type: m.meal_type,
  prep_time_min: m.prep_time_min,
  calories: m.calories,
  protein_g: m.protein_g,
  ingredients: m.ingredients.map((i) => i.item),
  ...(m.fits_targets === null ? {} : { fits_targets: m.fits_targets }),
});

const mealEvent = (type: MealEventType, m: MealHistory): NewEvent =>
  ({ event_type: type, entity_type: "meal", entity_id: m.id, metadata: mealMeta(m) });

async function getOwnMeal(db: SupabaseClient, userId: string, mealId: string) {
  const meal = await getMeal(db, userId, mealId);
  if (!meal) throw new Error("That meal no longer exists. Refresh the page.");
  return meal;
}

type BatchIdea = { recipe: Recipe; mealType: MealType; fits: boolean | undefined; because: string[] };

/**
 * Saves a set of ideas and records what happened. Ideas from the previous set of the same kind that the user didn't
 * save, make or rate are recorded as passed on, which is how the app learns what doesn't appeal.
 */
async function saveBatch(
  db: SupabaseClient, userId: string, profile: Profile, ideas: BatchIdea[], previous: MealWithSaved[],
  source: "recommend" | "fridge", sourceInput: string | null,
) {
  const batchId = crypto.randomUUID();
  const inserted = await insertMeals(db, userId, ideas.map(({ recipe, mealType, fits, because }) => ({
    meal_name: recipe.name,
    ingredients: recipe.ingredients,
    instructions: recipe.steps,
    calories: recipe.calories,
    protein_g: recipe.protein_g,
    carbs_g: recipe.carbs_g,
    fat_g: recipe.fat_g,
    prep_time_min: recipe.prep_time_min,
    meal_type: mealType,
    cuisine: recipe.cuisine,
    source,
    source_input: sourceInput,
    library_id: recipe.id,
    batch_id: batchId,
    fits_targets: fits ?? null,
    personalized_because: because,
  })));

  const ratedBefore = new Set((await getFeedbackFor(db, userId, "meal", previous.map((m) => m.id)).catch(() => [])).map((f) => f.target_id));
  const ignored = previous.filter((m) => !m.saved && !m.made_at && !ratedBefore.has(m.id));
  const byLibraryId = new Map(inserted.map((r) => [r.library_id, r.id]));
  await track(db, userId, [
    ...ignored.map((m) => mealEvent("meal_ignored", m)),
    ...ideas.map(({ recipe, mealType, fits }) => ({
      event_type: "meal_generated", entity_type: "meal", entity_id: byLibraryId.get(recipe.id) ?? recipe.id,
      metadata: toCandidate(recipe, mealType, fits),
    }) as NewEvent),
  ], profile);
}

/** A new set of ideas for a meal type. */
export async function generateMealIdeas(db: SupabaseClient, userId: string, mealType: MealType) {
  const [profile, nutrition, previous, recent] = await Promise.all([
    getProfile(db, userId),
    getNutritionProfile(db, userId),
    // Only the last set for this meal counts as passed on; switching between meals isn't a rejection
    getLatestBatch(db, userId, "recommend", mealType),
    getRecentLibraryIds(db, userId),
  ]);
  if (!profile) throw new Error("Finish onboarding before getting meal ideas.");
  const { inferences, explicit } = await loadPreferences(db, userId, profile);

  const { ideas } = suggestMeals({ profile, nutrition, mealType, inferences, explicit, recent });
  if (!ideas.length) {
    throw new Error("No recipes match your diet and restrictions for this meal yet. Try another meal type.");
  }
  await saveBatch(db, userId, profile, ideas.map((i) => ({ ...i, mealType })), previous, "recommend", null);
}

/**
 * Recipes made only from what the user has. The list (and what they said they don't have) is kept with the ideas,
 * so the page can show it again. Fridge results aren't counted as "passed on" when replaced: they depend on what's
 * in the fridge, not on taste.
 */
export async function generateFridgeIdeas(
  db: SupabaseClient, userId: string, items: string[], declined: string[], mealType: MealType | "any",
) {
  // Preferences only need the profile, so load them alongside the other reads instead of after them
  const profileRead = getProfile(db, userId);
  const [profile, nutrition, previous, { inferences, explicit }] = await Promise.all([
    profileRead,
    getNutritionProfile(db, userId),
    getLatestBatch(db, userId, "fridge"),
    profileRead.then((p) => loadPreferences(db, userId, p)),
  ]);
  if (!profile) throw new Error("Finish onboarding before getting meal ideas.");

  const recent = previous.map((m) => m.library_id).filter((id): id is string => !!id);
  const result = suggestFromFridge({ profile, items, declined, mealType, inferences, explicit, recent });
  if (!result.ideas.length) {
    throw new Error("No recipes use anything on your list yet. Try adding a main ingredient, like chicken, eggs, rice or beans.");
  }
  await saveBatch(db, userId, profile, result.ideas.map(({ recipe, because }) => {
    const type = mealType === "any" ? recipe.types[0] : mealType;
    return { recipe, mealType: type, because, fits: fitOf(recipe, mealTarget(nutrition, type), type).fits };
  }), [], "fridge", JSON.stringify({ items: result.items, declined, mealType }));
}

export async function viewMeal(db: SupabaseClient, userId: string, mealId: string) {
  await track(db, userId, [mealEvent("meal_viewed", await getOwnMeal(db, userId, mealId))]);
}

export async function setMealSaved(db: SupabaseClient, userId: string, mealId: string, saved: boolean) {
  const meal = await getOwnMeal(db, userId, mealId);
  if (saved === meal.saved) return;
  if (saved) await saveMeal(db, userId, mealId);
  else await unsaveMeal(db, userId, mealId);
  await track(db, userId, [mealEvent(saved ? "meal_saved" : "meal_unsaved", meal)]);
  await refreshSummaryQuietly(db, userId);
}

export async function markMade(db: SupabaseClient, userId: string, mealId: string) {
  const meal = await getOwnMeal(db, userId, mealId);
  await markMealMade(db, userId, mealId);
  await track(db, userId, [mealEvent("meal_logged", meal)]);
  await refreshSummaryQuietly(db, userId);
}

/** 👍 / 👎 with optional reasons. null clears the rating. */
export async function rateMeal(
  db: SupabaseClient, userId: string, mealId: string, rating: "like" | "dislike" | null, reasons: MealDislikeReason[],
) {
  const meal = await getOwnMeal(db, userId, mealId);
  if (rating) {
    await upsertFeedback(db, userId, {
      target_type: "meal", target_id: mealId, rating, reasons: rating === "dislike" ? reasons : [], metadata: mealMeta(meal),
    });
  } else {
    await deleteFeedback(db, userId, "meal", mealId);
  }
  await refreshSummaryQuietly(db, userId);
}
