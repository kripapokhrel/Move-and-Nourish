// Step 3: turn inferences and explicit preferences into concrete nudges for the generators.
// Nudges are soft: they change how likely something is, never make the library smaller,
// except for exercises and foods the user explicitly said no to.

import type { Gear } from "@/lib/workouts/library";
import { MIN_COMPLETED_WORKOUTS } from "./config";
import type { MealEventMeta } from "./events";
import { byKind, explicitSets, type Explicit, type Inference } from "./infer";
import { isHighProtein } from "./signals";

export type WorkoutPersonalization = {
  /** Explicit "don't suggest again". Never picked. */
  exclude: string[];
  /** More likely to be picked. Reason is shown if the exercise ends up in the workout. */
  favor: Record<string, string>;
  /** Less likely to be picked. */
  avoid: Record<string, string>;
  gear?: { gear: Gear; reason: string };
  favorFocus: string[];
  avoidFocus: string[];
  shortFinisher?: string;
  duration?: { minutes: number; confidence: number; reason: string };
  setShift?: { by: 1 | -1; reason: string };
};

export const NO_WORKOUT_PERSONALIZATION: WorkoutPersonalization = { exclude: [], favor: {}, avoid: {}, favorFocus: [], avoidFocus: [] };

/**
 * Explicit likes and dislikes always apply. Learned patterns only apply once the user has finished
 * MIN_COMPLETED_WORKOUTS workouts, so a couple of odd sessions don't reshape everything.
 */
export function workoutPersonalization(inferences: Inference[], x: Explicit, completedWorkouts: number): WorkoutPersonalization {
  const ex = explicitSets(x);
  const names = (set: Set<string>) =>
    x.preferences.filter((p) => p.category === "exercise" && set.has(p.value.toLowerCase())).map((p) => p.value);
  const p: WorkoutPersonalization = {
    exclude: names(ex.dislikedExercises),
    favor: Object.fromEntries(names(ex.likedExercises).map((n) => [n, `you marked ${n} as a favourite`])),
    avoid: {},
    favorFocus: [],
    avoidFocus: [],
  };
  if (completedWorkouts < MIN_COMPLETED_WORKOUTS) return p;

  for (const i of byKind(inferences, "favor_exercise")) p.favor[i.value as string] ??= `you ${i.evidence.toLowerCase()}`;
  for (const i of byKind(inferences, "avoid_exercise")) p.avoid[i.value as string] = `you've ${i.evidence.split(";")[0].toLowerCase()}`;
  p.favorFocus = byKind(inferences, "favor_focus").map((i) => i.value as string);
  p.avoidFocus = byKind(inferences, "avoid_focus").map((i) => i.value as string);

  const gear = byKind(inferences, "favor_gear")[0];
  if (gear && gear.value !== "none") p.gear = { gear: gear.value as Gear, reason: gear.evidence.toLowerCase() };

  const cardio = byKind(inferences, "skips_cardio")[0];
  if (cardio) p.shortFinisher = `you ${cardio.evidence.charAt(0).toLowerCase()}${cardio.evidence.slice(1)}`;

  const duration = byKind(inferences, "workout_duration")[0];
  if (duration) {
    p.duration = {
      minutes: duration.value as number,
      confidence: duration.confidence,
      reason: duration.statement.replace(/^Usually works out for/, "your recent workouts usually took"),
    };
  }

  const hard = inferences.find((i) => i.key === "difficulty:too_hard");
  const easy = inferences.find((i) => i.key === "difficulty:too_easy");
  if (hard) p.setShift = { by: -1, reason: `you ${hard.evidence.charAt(0).toLowerCase()}${hard.evidence.slice(1)}` };
  else if (easy) p.setShift = { by: 1, reason: `you ${easy.evidence.charAt(0).toLowerCase()}${easy.evidence.slice(1)}` };
  return p;
}

// ---------- meals (used by meal generation, step 9) ----------

export type MealCandidate = MealEventMeta & { id?: string };
export type RankedMeal<T extends MealCandidate> = { meal: T; score: number; because: string[] };

const contains = (meal: MealCandidate, food: string) =>
  [meal.name, ...(meal.ingredients ?? [])].some((s) => s.toLowerCase().includes(food));

/**
 * Orders meal ideas by how well they match the user. Meals with a food the user said they dislike or are
 * allergic to are dropped. `because` only lists reasons backed by an inference or an explicit preference.
 */
export function rankMeals<T extends MealCandidate>(meals: T[], inferences: Inference[], x: Explicit): RankedMeal<T>[] {
  const ex = explicitSets(x);
  const kind = (k: Parameters<typeof byKind>[1]) => byKind(inferences, k);
  const quick = kind("quick_meals")[0];
  const protein = kind("high_protein")[0];

  return meals
    .filter((meal) => ![...ex.dislikedIngredients].some((food) => contains(meal, food)))
    .map((meal) => {
      let score = 0;
      const because: string[] = [];
      const cuisine = meal.cuisine?.toLowerCase();
      if (cuisine && ex.likedCuisines.has(cuisine)) {
        score += 1;
        because.push(`${meal.cuisine} is one of your preferred cuisines`);
      }
      const fav = kind("favor_cuisine").find((i) => i.value === cuisine);
      if (fav) {
        score += fav.confidence;
        if (!ex.likedCuisines.has(cuisine!)) because.push(`you often save ${meal.cuisine} meals`);
      }
      const avoid = kind("avoid_cuisine").find((i) => i.value === cuisine);
      if (avoid) score -= avoid.confidence;
      if (cuisine && ex.dislikedCuisines.has(cuisine)) score -= 2;

      const ingredients = new Set((meal.ingredients ?? []).map((i) => i.toLowerCase()));
      const liked = kind("favor_ingredient").filter((i) => ingredients.has(i.value as string));
      score += liked.reduce((t, i) => t + i.confidence * 0.5, 0);
      if (liked.length) because.push(`it has ${liked.slice(0, 2).map((i) => i.value).join(" and ")}, which you often choose`);
      score -= kind("avoid_ingredient").filter((i) => ingredients.has(i.value as string)).reduce((t, i) => t + i.confidence * 0.5, 0);

      if (quick && meal.prep_time_min) {
        if (meal.prep_time_min <= (quick.value as number)) {
          score += quick.confidence;
          because.push(`it takes ${meal.prep_time_min} minutes and you usually pick quick meals`);
        } else score -= quick.confidence / 2;
      }
      if (protein && isHighProtein(meal)) {
        score += protein.confidence;
        because.push("it's high in protein, like the meals you usually save");
      }
      const type = kind("favor_meal_type").find((i) => i.value === meal.meal_type?.toLowerCase());
      if (type) score += type.confidence * 0.5;
      return { meal, score: Math.round(score * 100) / 100, because };
    })
    .sort((a, b) => b.score - a.score);
}

/** "Recommended because you usually choose high-protein meals and it takes 20 minutes." */
export const explain = (because: string[]) =>
  because.length ? `Recommended because ${because.length === 1 ? because[0] : `${because.slice(0, -1).join(", ")} and ${because.at(-1)}`}.` : null;
