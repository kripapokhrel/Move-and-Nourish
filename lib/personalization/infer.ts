// Step 2 of learning: turn counts into guesses about what the user prefers. Pure and deterministic.
//
// Rules of thumb:
// - Nothing is inferred from fewer than MIN_EVIDENCE events.
// - confidence = recency-weighted hits / (weighted total + CONFIDENCE_PRIOR), so small samples and old habits
//   stay unsure. 3 out of 3 today = 0.6; 8 out of 8 = 0.8; 3 out of 6 = 0.38 (not used).
// - What the user told us directly always wins: an explicit like or dislike blocks any contrary inference.
// - Every inference carries its evidence in plain words, built from the real counts, so explanations
//   never claim more than the data shows.

import type { Profile, UserPreference } from "@/types/database";
import { CONFIDENCE_PRIOR, MIN_CONFIDENCE, MIN_EVIDENCE } from "./config";
import { exerciseKey } from "./events";
import type { Count, Signals } from "./signals";

export type InferenceKind =
  | "favor_focus" | "avoid_focus" | "skips_cardio" | "workout_duration" | "favor_exercise" | "avoid_exercise"
  | "difficulty" | "favor_gear" | "workout_days"
  | "favor_cuisine" | "avoid_cuisine" | "favor_ingredient" | "avoid_ingredient" | "favor_meal_type"
  | "quick_meals" | "high_protein" | "meal_complaint" | "repeat_meal";

export type Inference = {
  key: string;
  kind: InferenceKind;
  domain: "workout" | "meal";
  /** What the rule concluded: a name, a number of minutes, "too_hard" ... */
  value: string | number;
  /** "Often skips the cardio finisher" */
  statement: string;
  /** "Skipped it in 5 of your last 7 workouts" */
  evidence: string;
  confidence: number;
  n: number;
  last: string | null;
};

/** Explicit preferences: from onboarding/profile plus anything the user marked later. */
export type Explicit = {
  profile: Pick<Profile, "disliked_foods" | "allergies" | "preferred_cuisines" | "dietary_type"> | null;
  preferences: Pick<UserPreference, "category" | "value" | "sentiment">[];
};

const round2 = (x: number) => Math.round(x * 100) / 100;
export const confidence = (hitsW: number, totalW: number) => round2(hitsW / (totalW + CONFIDENCE_PRIOR));
const latest = (...cs: (Count | undefined)[]) =>
  cs.map((c) => c?.last).filter((x): x is string => !!x).sort().at(-1) ?? null;
const lower = (s: string) => s.trim().toLowerCase();
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const FOCUS_NAMES: Record<string, string> = {
  full_body: "full body", legs: "legs", glutes: "glutes", push: "push", pull: "pull", core: "core", cardio: "cardio",
};
const GEAR_NAMES: Record<string, string> = { dumbbells: "dumbbell", bands: "resistance band", gym: "gym machine", none: "bodyweight" };
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const COMPLAINTS: Record<string, string> = {
  too_complicated: "Finds some meals too complicated",
  ingredients: "Often dislikes the ingredients chosen",
  too_long: "Finds some meals take too long",
  not_filling: "Finds some meals not filling enough",
  not_my_style: "Some meals didn't match their taste",
};
// Too common to say anything about taste
const STAPLES = new Set(["salt", "pepper", "black pepper", "oil", "olive oil", "water", "garlic", "onion", "butter"]);

function quantile(xs: number[], q: number) {
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  return s[lo] + (s[Math.ceil(pos)] - s[lo]) * (pos - lo);
}
const to5 = (x: number) => Math.round(x / 5) * 5;

export function explicitSets(x: Explicit) {
  const pick = (category: UserPreference["category"], sentiment: "like" | "dislike") =>
    new Set(x.preferences.filter((p) => p.category === category && p.sentiment === sentiment).map((p) => lower(p.value)));
  const foods = [...(x.profile?.disliked_foods ?? []), ...(x.profile?.allergies ?? [])].map(lower);
  return {
    likedExercises: pick("exercise", "like"),
    dislikedExercises: pick("exercise", "dislike"),
    dislikedIngredients: new Set([...pick("ingredient", "dislike"), ...foods]),
    likedCuisines: new Set([...pick("cuisine", "like"), ...(x.profile?.preferred_cuisines ?? []).map(lower)]),
    dislikedCuisines: pick("cuisine", "dislike"),
  };
}

export function inferPreferences(s: Signals, x: Explicit): Inference[] {
  const out: Inference[] = [];
  const ex = explicitSets(x);
  const push = (i: Omit<Inference, "key" | "confidence"> & { confidence: number }, min = MIN_CONFIDENCE) => {
    if (i.n >= MIN_EVIDENCE && i.confidence >= min) out.push({ ...i, key: `${i.kind}:${i.value}` });
  };
  const w = s.workouts;

  // ---------- workouts ----------
  for (const [focus, c] of Object.entries(w.focus)) {
    const name = FOCUS_NAMES[focus];
    if (!name) continue;
    // A focus is "preferred" when it's a big share of all finished workouts, so several can qualify
    push({
      kind: "favor_focus", domain: "workout", value: focus, n: c.completed.n, last: c.completed.last,
      statement: `Often trains ${name}`,
      evidence: `${plural(c.completed.n, `${name} workout`)} finished out of ${w.completed.n}`,
      confidence: confidence(c.completed.w, w.completed.w),
    }, 0.35);
    push({
      kind: "avoid_focus", domain: "workout", value: focus, n: c.skipped.n, last: c.skipped.last,
      statement: `Often skips ${name} workouts`,
      evidence: `Skipped ${c.skipped.n} of ${c.skipped.n + c.completed.n} ${name} workouts`,
      confidence: confidence(c.skipped.w, c.skipped.w + c.completed.w),
    });
  }

  const f = w.finisher;
  push({
    kind: "skips_cardio", domain: "workout", value: "finisher", n: f.no.n, last: f.no.last,
    statement: "Often skips the cardio finisher",
    evidence: `Skipped it in ${f.no.n} of ${f.no.n + f.yes.n} workouts`,
    confidence: confidence(f.no.w, f.no.w + f.yes.w),
  });

  if (w.durations.length >= MIN_EVIDENCE) {
    const recent = w.durations.slice(-10);
    const lo = to5(quantile(recent, 0.25));
    const hi = to5(quantile(recent, 0.75));
    push({
      kind: "workout_duration", domain: "workout", value: to5(quantile(recent, 0.5)), n: recent.length, last: w.completed.last,
      statement: lo === hi ? `Usually works out for about ${lo} minutes` : `Usually works out for ${lo}–${hi} minutes`,
      evidence: `Based on the length of your last ${plural(recent.length, "workout")}`,
      confidence: round2(recent.length / (recent.length + CONFIDENCE_PRIOR)),
    });
  }

  for (const [name, e] of Object.entries(w.exercises)) {
    const key = lower(name);
    const misses = { n: e.skipped.n + e.replacedAway.n + e.removed.n + e.tooHard.n, w: e.skipped.w + e.replacedAway.w + e.removed.w + e.tooHard.w };
    // Picking an exercise yourself says more than finishing one you were given
    const hits = { n: e.completed.n + 2 * e.chosen.n, w: e.completed.w + 2 * e.chosen.w };
    if (!ex.dislikedExercises.has(key) && hits.n >= 4) {
      const parts = [
        e.completed.n && `finished it ${plural(e.completed.n, "time")}`,
        e.chosen.n && `picked it yourself ${plural(e.chosen.n, "time")}`,
      ].filter(Boolean);
      push({
        kind: "favor_exercise", domain: "workout", value: name, n: hits.n, last: latest(e.completed, e.chosen),
        statement: e.chosen.n > 0 ? `Likes to choose ${name}${e.custom ? " (your own exercise)" : ""}` : `Frequently completes ${name}`,
        evidence: capitalize(parts.join(" and ")),
        confidence: confidence(hits.w, hits.w + misses.w),
      });
    }
    if (!ex.likedExercises.has(key)) {
      const parts = [
        e.skipped.n && `skipped it ${plural(e.skipped.n, "time")}`,
        e.replacedAway.n && `swapped it out ${plural(e.replacedAway.n, "time")}`,
        e.removed.n && `removed it ${plural(e.removed.n, "time")}`,
        e.tooHard.n && `rated it too hard ${plural(e.tooHard.n, "time")}`,
      ].filter(Boolean);
      push({
        kind: "avoid_exercise", domain: "workout", value: name, n: misses.n, last: latest(e.skipped, e.replacedAway, e.removed, e.tooHard),
        statement: `Often skips or swaps ${name}`,
        evidence: `${capitalize(parts.join(", "))}; finished it ${plural(e.completed.n, "time")}`,
        confidence: confidence(misses.w, misses.w + e.completed.w),
      });
    }
  }

  // Difficulty: a majority of the last five workout ratings pointing the same way
  for (const rating of ["too_hard", "too_easy"] as const) {
    const n = w.recent_ratings.filter((r) => r === rating).length;
    if (n >= MIN_EVIDENCE) {
      out.push({
        key: `difficulty:${rating}`, kind: "difficulty", domain: "workout", value: rating, n, last: w.ratings[rating].last,
        statement: rating === "too_hard" ? "Recent workouts have felt too hard" : "Recent workouts have felt too easy",
        evidence: `Rated ${n} of your last ${w.recent_ratings.length} workouts ${rating.replace("_", " ")}`,
        confidence: round2(n / (w.recent_ratings.length + 1)),
      });
    }
  }

  const gearEntries = Object.entries(w.gear);
  const gearTotal = gearEntries.reduce((t, [, c]) => ({ n: t.n + c.n, w: t.w + c.w }), { n: 0, w: 0 });
  const [topGear, top] = gearEntries.filter(([g]) => g !== "none").sort((a, b) => b[1].w - a[1].w)[0] ?? [];
  if (topGear && top && gearTotal.n >= 6) {
    push({
      kind: "favor_gear", domain: "workout", value: topGear, n: top.n, last: top.last,
      statement: `Prefers ${GEAR_NAMES[topGear] ?? topGear} exercises`,
      evidence: `${top.n} of ${gearTotal.n} main exercises you finished used ${GEAR_NAMES[topGear] ?? topGear}s`,
      confidence: confidence(top.w, gearTotal.w),
    });
  }

  if (w.completed.n >= 4) {
    const days = w.weekdays.map((n, d) => ({ n, d })).filter(({ n }) => n >= 2 && n / w.completed.n >= 0.25);
    if (days.length) {
      const n = days.reduce((t, d) => t + d.n, 0);
      out.push({
        key: "workout_days", kind: "workout_days", domain: "workout", value: days.map((d) => WEEKDAYS[d.d]).join(", "), n,
        last: w.completed.last,
        statement: `Usually works out on ${days.map((d) => WEEKDAYS[d.d]).join(", ")}`,
        evidence: `${n} of your ${w.completed.n} finished workouts were on those days`,
        confidence: round2(n / (w.completed.n + CONFIDENCE_PRIOR)),
      });
    }
  }

  // ---------- meals ----------
  const m = s.meals;
  for (const [cuisine, c] of Object.entries(m.cuisines)) {
    if (!ex.dislikedCuisines.has(cuisine)) push({
      kind: "favor_cuisine", domain: "meal", value: cuisine, n: c.yes.n, last: c.yes.last,
      statement: `Enjoys ${capitalize(cuisine)} meals`,
      evidence: `Saved, liked or cooked ${plural(c.yes.n, `${capitalize(cuisine)} meal`)}`,
      confidence: confidence(c.yes.w, c.yes.w + c.no.w),
    });
    if (!ex.likedCuisines.has(cuisine)) push({
      kind: "avoid_cuisine", domain: "meal", value: cuisine, n: c.no.n, last: c.no.last,
      statement: `Rarely goes for ${capitalize(cuisine)} meals`,
      evidence: `Passed on or disliked ${plural(c.no.n, `${capitalize(cuisine)} meal`)}`,
      confidence: confidence(c.no.w, c.yes.w + c.no.w),
    });
  }
  for (const [item, c] of Object.entries(m.ingredients)) {
    if (STAPLES.has(item)) continue;
    // Explicit dislikes are already hard rules; no need to "learn" them
    if (!ex.dislikedIngredients.has(item)) push({
      kind: "favor_ingredient", domain: "meal", value: item, n: c.yes.n, last: c.yes.last,
      statement: `Often chooses meals with ${item}`,
      evidence: `In ${plural(c.yes.n, "meal")} you saved, liked or cooked`,
      confidence: confidence(c.yes.w, c.yes.w + c.no.w),
    });
    if (!ex.dislikedIngredients.has(item)) push({
      kind: "avoid_ingredient", domain: "meal", value: item, n: c.no.n, last: c.no.last,
      statement: `May not like ${item}`,
      evidence: `In ${plural(c.no.n, "meal")} you passed on or disliked`,
      confidence: confidence(c.no.w, c.yes.w + c.no.w),
    });
  }
  for (const [type, c] of Object.entries(m.meal_types)) {
    push({
      kind: "favor_meal_type", domain: "meal", value: type, n: c.yes.n, last: c.yes.last,
      statement: `Often saves ${type.replace("_", "-")} meals`,
      evidence: `Saved, liked or cooked ${plural(c.yes.n, `${type.replace("_", "-")} meal`)}`,
      confidence: confidence(c.yes.w, c.yes.w + c.no.w),
    }, 0.35);
  }
  if (m.prep_times.length >= 4) {
    const cap = to5(quantile(m.prep_times, 0.75));
    if (cap <= 30) push({
      kind: "quick_meals", domain: "meal", value: cap, n: m.prep_times.length, last: m.saved.last ?? m.logged.last,
      statement: `Prefers meals ready in ${cap} minutes or less`,
      evidence: `Most of the ${m.prep_times.length} meals you kept took ${cap} minutes or less`,
      confidence: round2(m.prep_times.length / (m.prep_times.length + CONFIDENCE_PRIOR)),
    });
  }
  const hp = m.high_protein;
  push({
    kind: "high_protein", domain: "meal", value: "high_protein", n: hp.yes.n, last: hp.yes.last,
    statement: "Prefers high-protein meals",
    evidence: `${hp.yes.n} of the ${hp.yes.n + hp.no.n} meals you kept were high in protein`,
    confidence: confidence(hp.yes.w, hp.yes.w + hp.no.w),
  });
  for (const [reason, c] of Object.entries(m.dislike_reasons)) {
    if (COMPLAINTS[reason]) push({
      kind: "meal_complaint", domain: "meal", value: reason, n: c.n, last: c.last,
      statement: COMPLAINTS[reason],
      evidence: `Gave this reason for ${plural(c.n, "disliked meal")}`,
      confidence: confidence(c.w, m.disliked.w),
    });
  }
  for (const [name, c] of Object.entries(m.repeated)) {
    push({
      kind: "repeat_meal", domain: "meal", value: name, n: c.n, last: c.last,
      statement: `Often makes ${capitalize(name)}`,
      evidence: `Cooked it ${plural(c.n, "time")}`,
      confidence: round2(c.n / (c.n + CONFIDENCE_PRIOR)),
    });
  }

  return out.sort((a, b) => b.confidence - a.confidence);
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const byKind = (xs: Inference[], kind: InferenceKind) => xs.filter((i) => i.kind === kind);

/** Exercise names in explicit preferences are stored the same way as in events. */
export const preferenceValue = (category: UserPreference["category"], value: string) =>
  category === "exercise" ? exerciseKey(value) : lower(value);
