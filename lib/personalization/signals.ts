// Step 1 of learning: count what happened. Pure: no I/O, and `now` is passed in so tests are repeatable.
// Every count keeps the raw number (for honest explanations), a recency-weighted number (so habits can change)
// and when it last happened.

import type { RecommendationFeedback, UserEvent } from "@/types/database";
import { HALF_LIFE_DAYS, WINDOW_DAYS } from "./config";
import { exerciseKey, type ExerciseEventMeta, type MealEventMeta, type WorkoutEventMeta } from "./events";

export type Count = { n: number; w: number; last: string | null };

export type ExerciseStats = {
  completed: Count; skipped: Count; replacedAway: Count; removed: Count; chosen: Count;
  tooEasy: Count; tooHard: Count; custom: boolean;
};
type YesNo = { yes: Count; no: Count };

export type Signals = {
  computed_at: string;
  window_days: number;
  event_count: number;
  workouts: {
    generated: Count; completed: Count; skipped: Count;
    focus: Record<string, { completed: Count; skipped: Count }>;
    /** Minutes the user reported, oldest first */
    durations: number[];
    /** Completed workouts by weekday, 0 = Monday */
    weekdays: number[];
    /** Completed workouts per week over the window */
    per_week: number;
    exercises: Record<string, ExerciseStats>;
    /** Completed main exercises by equipment */
    gear: Record<string, Count>;
    finisher: YesNo;
    ratings: Record<"too_easy" | "just_right" | "too_hard", Count>;
    /** Latest workout ratings, newest first */
    recent_ratings: string[];
  };
  meals: {
    generated: Count; viewed: Count; saved: Count; ignored: Count; logged: Count; liked: Count; disliked: Count;
    cuisines: Record<string, YesNo>;
    meal_types: Record<string, YesNo>;
    ingredients: Record<string, YesNo>;
    /** Prep time of meals the user saved, liked or logged */
    prep_times: number[];
    /** Of kept meals (saved, liked, logged): high protein or not */
    high_protein: YesNo;
    /** Of kept meals: fit the user's calorie and protein targets or not */
    fits_targets: YesNo;
    dislike_reasons: Record<string, Count>;
    /** Meals logged more than once, by name */
    repeated: Record<string, Count>;
  };
};

const zero = (): Count => ({ n: 0, w: 0, last: null });
const yesNo = (): YesNo => ({ yes: zero(), no: zero() });
const DAY = 86_400_000;

/** How much an event counts: 1 today, 0.5 after HALF_LIFE_DAYS. */
export const recencyWeight = (at: string, now: Date) =>
  Math.pow(0.5, Math.max(0, now.getTime() - Date.parse(at)) / DAY / HALF_LIFE_DAYS);

function add(c: Count, at: string, now: Date) {
  c.n += 1;
  c.w += recencyWeight(at, now);
  if (!c.last || at > c.last) c.last = at;
}

function bump<K extends string, V>(map: Record<K, V>, key: K, make: () => V): V {
  return (map[key] ??= make());
}

const exerciseStats = (): ExerciseStats => ({
  completed: zero(), skipped: zero(), replacedAway: zero(), removed: zero(), chosen: zero(),
  tooEasy: zero(), tooHard: zero(), custom: false,
});

/** A meal counts as high protein when protein gives at least 30% of its calories. */
export const isHighProtein = (m: Pick<MealEventMeta, "protein_g" | "calories">) =>
  !!m.protein_g && !!m.calories && (m.protein_g * 4) / m.calories >= 0.3;

const normal = (s: string) => s.trim().toLowerCase();

export function buildSignals(events: UserEvent[], feedback: RecommendationFeedback[], now: Date): Signals {
  const since = now.getTime() - WINDOW_DAYS * DAY;
  const inWindow = <T extends { created_at: string }>(rows: T[]) =>
    rows.filter((r) => Date.parse(r.created_at) >= since).sort((a, b) => a.created_at.localeCompare(b.created_at));

  const s: Signals = {
    computed_at: now.toISOString(),
    window_days: WINDOW_DAYS,
    event_count: 0,
    workouts: {
      generated: zero(), completed: zero(), skipped: zero(), focus: {}, durations: [], weekdays: [0, 0, 0, 0, 0, 0, 0],
      per_week: 0, exercises: {}, gear: {}, finisher: yesNo(),
      ratings: { too_easy: zero(), just_right: zero(), too_hard: zero() }, recent_ratings: [],
    },
    meals: {
      generated: zero(), viewed: zero(), saved: zero(), ignored: zero(), logged: zero(), liked: zero(), disliked: zero(),
      cuisines: {}, meal_types: {}, ingredients: {}, prep_times: [], high_protein: yesNo(), fits_targets: yesNo(), dislike_reasons: {}, repeated: {},
    },
  };
  const w = s.workouts;
  const m = s.meals;
  const ex = (name: string) => bump(w.exercises, exerciseKey(name), exerciseStats);
  const mealPositive = new Set(["meal_saved", "meal_logged"]);
  const mealNegative = new Set(["meal_ignored"]);

  const rows = inWindow(events);
  s.event_count = rows.length;
  for (const e of rows) {
    const at = e.created_at;
    const meta = e.metadata ?? {};
    switch (e.event_type) {
      case "workout_generated":
        add(w.generated, at, now);
        break;
      case "workout_completed":
      case "workout_skipped": {
        const done = e.event_type === "workout_completed";
        const wm = meta as WorkoutEventMeta;
        add(done ? w.completed : w.skipped, at, now);
        if (wm.focus) add(bump(w.focus, wm.focus, () => ({ completed: zero(), skipped: zero() }))[done ? "completed" : "skipped"], at, now);
        if (done && wm.duration_min) w.durations.push(wm.duration_min);
        if (done) w.weekdays[(new Date(at).getDay() + 6) % 7] += 1;
        break;
      }
      case "exercise_completed":
      case "exercise_skipped": {
        if (!e.entity_id) break;
        const em = meta as ExerciseEventMeta;
        const done = e.event_type === "exercise_completed";
        const stats = ex(e.entity_id);
        stats.custom ||= !!em.custom;
        add(done ? stats.completed : stats.skipped, at, now);
        if (em.stage === "finisher") add(done ? w.finisher.yes : w.finisher.no, at, now);
        if (done && em.stage === "main" && em.gear) add(bump(w.gear, em.gear, zero), at, now);
        break;
      }
      case "exercise_replaced": {
        if (!e.entity_id) break;
        const em = meta as ExerciseEventMeta;
        add(ex(e.entity_id).replacedAway, at, now);
        if (em.replaced_with) {
          const chosen = ex(em.replaced_with);
          chosen.custom ||= !!em.custom;
          add(chosen.chosen, at, now);
        }
        break;
      }
      case "exercise_removed":
        if (e.entity_id) add(ex(e.entity_id).removed, at, now);
        break;
      case "exercise_added":
        if (e.entity_id) {
          const stats = ex(e.entity_id);
          stats.custom = true;
          add(stats.chosen, at, now);
        }
        break;
      case "meal_generated":
      case "meal_viewed":
      case "meal_saved":
      case "meal_ignored":
      case "meal_logged": {
        const mm = meta as MealEventMeta;
        const counter = { meal_generated: m.generated, meal_viewed: m.viewed, meal_saved: m.saved, meal_ignored: m.ignored, meal_logged: m.logged }[e.event_type];
        add(counter, at, now);
        const positive = mealPositive.has(e.event_type);
        if (!positive && !mealNegative.has(e.event_type)) break;
        tallyMeal(m, mm, positive, at, now);
        if (e.event_type === "meal_logged" && mm.name) add(bump(m.repeated, normal(mm.name), zero), at, now);
        break;
      }
    }
  }
  // Only meals logged at least twice count as "repeated"
  for (const [name, c] of Object.entries(m.repeated)) if (c.n < 2) delete m.repeated[name];

  // Average over the time since the first event, so a new user isn't diluted by 13 empty weeks
  const daysTracked = rows.length ? (now.getTime() - Date.parse(rows[0].created_at)) / DAY : 0;
  const weeks = Math.max(1, daysTracked / 7);
  w.per_week = Math.round((w.completed.n / weeks) * 10) / 10;

  // Ratings: the feedback table holds the latest rating per item
  for (const f of inWindow(feedback.map((f) => ({ ...f, created_at: f.updated_at ?? f.created_at })))) {
    const at = f.created_at;
    if (f.target_type === "workout" && f.rating in w.ratings) {
      add(w.ratings[f.rating as keyof typeof w.ratings], at, now);
      w.recent_ratings.unshift(f.rating);
    } else if (f.target_type === "exercise") {
      const name = String(f.metadata?.exercise_name ?? f.target_id.split(":").slice(1).join(":"));
      if (!name) continue;
      if (f.rating === "too_easy") add(ex(name).tooEasy, at, now);
      if (f.rating === "too_hard") add(ex(name).tooHard, at, now);
    } else if (f.target_type === "meal" && (f.rating === "like" || f.rating === "dislike")) {
      const liked = f.rating === "like";
      add(liked ? m.liked : m.disliked, at, now);
      tallyMeal(m, f.metadata as MealEventMeta, liked, at, now);
      if (!liked) for (const r of f.reasons) add(bump(m.dislike_reasons, r, zero), at, now);
    }
  }
  w.recent_ratings = w.recent_ratings.slice(0, 5);
  return s;
}

function tallyMeal(m: Signals["meals"], meal: MealEventMeta | undefined, positive: boolean, at: string, now: Date) {
  if (!meal) return;
  const side = positive ? "yes" : "no";
  if (meal.cuisine) add(bump(m.cuisines, normal(meal.cuisine), yesNo)[side], at, now);
  if (meal.meal_type) add(bump(m.meal_types, normal(meal.meal_type), yesNo)[side], at, now);
  for (const i of new Set((meal.ingredients ?? []).map(normal).filter(Boolean))) add(bump(m.ingredients, i, yesNo)[side], at, now);
  if (!positive) return;
  // Of the meals the user kept: how many were high protein, how many fit their targets
  if (meal.prep_time_min) m.prep_times.push(meal.prep_time_min);
  if (meal.protein_g && meal.calories) add(isHighProtein(meal) ? m.high_protein.yes : m.high_protein.no, at, now);
  if (meal.fits_targets !== undefined) add(meal.fits_targets ? m.fits_targets.yes : m.fits_targets.no, at, now);
}
