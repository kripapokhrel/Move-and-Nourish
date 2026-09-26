// Picks meal ideas from the recipe library with plain rules. Free, instant, no external services.
// Pure: no I/O, and randomness is injected so tests are repeatable.

import { rankMeals, type MealCandidate } from "@/lib/personalization/apply";
import type { MealEventMeta } from "@/lib/personalization/events";
import type { Explicit, Inference } from "@/lib/personalization/infer";
import type { NutritionProfile, Profile } from "@/types/database";
import { allowed, dietRules } from "./diet";
import { RECIPES, type MealType, type Recipe } from "./library";
import { MEAL_SHARE, mealLabel } from "./options";

export type MealTarget = { calories: number; protein_g: number };

/** The slice of the daily targets one meal should cover. */
export function mealTarget(n: Pick<NutritionProfile, "calorie_target" | "protein_target_g"> | null, type: MealType): MealTarget | null {
  if (!n) return null;
  return { calories: Math.round(n.calorie_target * MEAL_SHARE[type]), protein_g: Math.round(n.protein_target_g * MEAL_SHARE[type]) };
}

/** A meal fits when calories are within 25% of the target and protein is at least 70% of it. */
export function fitOf(recipe: Pick<Recipe, "calories" | "protein_g">, target: MealTarget | null, type: MealType) {
  if (!target) return { fits: undefined, note: null };
  const ratio = recipe.calories / target.calories;
  const meal = mealLabel(type).toLowerCase();
  if (ratio < 0.75) return { fits: false, note: `Lighter than your ${meal} target. Add a side to fill up.` };
  if (ratio > 1.25) return { fits: false, note: `Bigger than your ${meal} target. Have a smaller portion or a lighter next meal.` };
  if (recipe.protein_g < target.protein_g * 0.7) return { fits: false, note: `Fits your ${meal} calories but is lower in protein.` };
  return { fits: true, note: `Fits your ${meal} target.` };
}

/** How close a recipe is to the target: 1 is spot on, 0 is far off. */
function closeness(recipe: Recipe, target: MealTarget | null) {
  if (!target) return 0.5;
  const kcal = 1 - Math.min(1, Math.abs(recipe.calories / target.calories - 1) * 2);
  const protein = Math.min(1, recipe.protein_g / Math.max(1, target.protein_g));
  return (kcal + protein) / 2;
}

export const toCandidate = (r: Recipe, type: MealType, fits?: boolean): MealCandidate & { id: string } => ({
  id: r.id, name: r.name, cuisine: r.cuisine, meal_type: type, prep_time_min: r.prep_time_min,
  calories: r.calories, protein_g: r.protein_g, ingredients: r.ingredients.map((i) => i.item),
  ...(fits === undefined ? {} : { fits_targets: fits }),
});

export type MealRequest = {
  profile: Pick<Profile, "dietary_type" | "allergies" | "dietary_restrictions" | "disliked_foods" | "preferred_cuisines"> | null;
  nutrition: Pick<NutritionProfile, "calorie_target" | "protein_target_g"> | null;
  mealType: MealType;
  /** Learned preferences. Empty when personalization is off. */
  inferences: Inference[];
  explicit: Explicit;
  /** Recipe ids shown recently, tried last so ideas change */
  recent?: string[];
  count?: number;
  random?: () => number;
};

export type MealIdea = { recipe: Recipe; fits: boolean | undefined; fitNote: string | null; because: string[]; meta: MealEventMeta };

// How much each part counts when ordering ideas
const FIT_WEIGHT = 1;
const RANDOM_WEIGHT = 0.6;
const RECENT_PENALTY = 1.5;

export function suggestMeals(req: MealRequest) {
  const random = req.random ?? Math.random;
  const rules = dietRules(req.profile);
  const target = mealTarget(req.nutrition, req.mealType);
  const recent = new Set(req.recent ?? []);
  const count = req.count ?? 3;

  const safe = RECIPES.filter((r) => r.types.includes(req.mealType) && allowed(r, rules));
  // rankMeals drops disliked foods and scores learned taste; closeness to target and a little randomness do the rest
  const ranked = rankMeals(safe.map((r) => toCandidate(r, req.mealType)), req.inferences, req.explicit)
    .map(({ meal, score, because }) => {
      const recipe = safe.find((r) => r.id === meal.id)!;
      return {
        recipe, because,
        total: score + FIT_WEIGHT * closeness(recipe, target) + RANDOM_WEIGHT * random() - (recent.has(recipe.id) ? RECENT_PENALTY : 0),
      };
    })
    .sort((a, b) => b.total - a.total);

  // Different cuisines first, so three ideas aren't three curries
  const picks: typeof ranked = [];
  const cuisines = new Set<string>();
  for (const x of ranked) {
    if (picks.length === count) break;
    if (!cuisines.has(x.recipe.cuisine)) { picks.push(x); cuisines.add(x.recipe.cuisine); }
  }
  for (const x of ranked) {
    if (picks.length === count) break;
    if (!picks.includes(x)) picks.push(x);
  }

  const ideas: MealIdea[] = picks.map(({ recipe, because }) => {
    const { fits, note } = fitOf(recipe, target, req.mealType);
    return { recipe, fits, fitNote: note, because, meta: toCandidate(recipe, req.mealType, fits) };
  });
  return { ideas, target, unchecked: rules.unchecked, available: ranked.length };
}
