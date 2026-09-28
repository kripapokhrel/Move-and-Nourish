import { describe, expect, it } from "vitest";
import { generateWorkoutPlan, type WorkoutRequest } from "@/lib/workouts/generator";
import { EXERCISES } from "@/lib/workouts/library";
import type { RecommendationFeedback, UserEvent, UserPreference } from "@/types/database";
import { explain, NO_WORKOUT_PERSONALIZATION, rankMeals, workoutPersonalization } from "./apply";
import { exerciseKey, type NewEvent } from "./events";
import { inferPreferences, type Explicit } from "./infer";
import { buildSignals, recencyWeight } from "./signals";
import { buildPreferenceSummary } from "./summary";

const NOW = new Date("2026-09-26T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

let seq = 0;
const ev = (e: NewEvent, days = 1): UserEvent => ({ id: String(seq++), user_id: "u", created_at: daysAgo(days), ...e });
const exercise = (type: NewEvent["event_type"], name: string, stage: "main" | "finisher" = "main", days = 1, extra = {}) =>
  ev({ event_type: type, entity_type: "exercise", entity_id: name, metadata: { stage, gear: "dumbbells", ...extra } } as NewEvent, days);
const workoutDone = (focus: string, days = 1, duration = 40) =>
  ev({ event_type: "workout_completed", entity_type: "workout", entity_id: `w${seq}`, metadata: { focus, duration_min: duration } }, days);

const noExplicit: Explicit = { profile: null, preferences: [] };
const pref = (category: UserPreference["category"], value: string, sentiment: "like" | "dislike") =>
  ({ category, value, sentiment });

// Small seeded RNG so results are repeatable
const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const request = (over: Partial<WorkoutRequest> = {}): WorkoutRequest => ({
  profile: {
    fitness_level: "intermediate", fitness_goal: "build_muscle", workout_location: "home",
    available_equipment: ["dumbbells"], session_duration_min: 45,
  },
  focus: "legs",
  today: "2026-09-26",
  recent: [],
  random: seeded(7),
  ...over,
});

describe("buildSignals", () => {
  it("ignores events older than the 90-day window and weights recent ones more", () => {
    const s = buildSignals([workoutDone("legs", 120), workoutDone("legs", 30), workoutDone("legs", 0)], [], NOW);
    expect(s.workouts.completed.n).toBe(2);
    expect(s.workouts.completed.w).toBeCloseTo(1 + 0.5, 5);
    expect(recencyWeight(daysAgo(60), NOW)).toBeCloseTo(0.25, 5);
  });

  it("counts swaps against the old exercise and for the new one", () => {
    const s = buildSignals([exercise("exercise_replaced", "Dumbbell deadlift", "main", 1, { replaced_with: "Kettlebell swings", custom: true })], [], NOW);
    expect(s.workouts.exercises["Dumbbell deadlift"].replacedAway.n).toBe(1);
    expect(s.workouts.exercises["Kettlebell swings"].chosen.n).toBe(1);
    expect(s.workouts.exercises["Kettlebell swings"].custom).toBe(true);
  });

  it("uses the latest rating per workout from the feedback table", () => {
    const fb = (rating: RecommendationFeedback["rating"], d: number): RecommendationFeedback => ({
      id: String(seq++), user_id: "u", target_type: "workout", target_id: `w${seq}`, rating, reasons: [], metadata: {},
      created_at: daysAgo(d), updated_at: daysAgo(d),
    });
    const s = buildSignals([], [fb("too_hard", 1), fb("too_hard", 2), fb("just_right", 3)], NOW);
    expect(s.workouts.recent_ratings).toEqual(["too_hard", "too_hard", "just_right"]);
  });
});

describe("inferPreferences", () => {
  it("doesn't guess from one or two events", () => {
    const s = buildSignals([exercise("exercise_skipped", "Plank knee runs", "finisher"), exercise("exercise_skipped", "Star jumps", "finisher")], [], NOW);
    expect(inferPreferences(s, noExplicit)).toEqual([]);
  });

  it("notices a skipped cardio finisher and explains it with real counts", () => {
    const events = [1, 2, 3, 4].map((d) => exercise("exercise_skipped", "Star jumps", "finisher", d));
    events.push(exercise("exercise_completed", "Star jumps", "finisher", 5));
    const cardio = inferPreferences(buildSignals(events, [], NOW), noExplicit).find((i) => i.kind === "skips_cardio");
    expect(cardio?.evidence).toBe("Skipped it in 4 of 5 workouts");
    expect(cardio!.confidence).toBeGreaterThanOrEqual(0.5);
    expect(cardio!.confidence).toBeLessThan(1);
  });

  it("never infers the opposite of what the user said", () => {
    const events = [1, 2, 3, 4].map((d) => exercise("exercise_skipped", "Dumbbell deadlift", "main", d));
    const s = buildSignals(events, [], NOW);
    expect(inferPreferences(s, noExplicit).some((i) => i.key === "avoid_exercise:Dumbbell deadlift")).toBe(true);
    const liked: Explicit = { profile: null, preferences: [pref("exercise", "Dumbbell deadlift", "like")] };
    expect(inferPreferences(s, liked).some((i) => i.kind === "avoid_exercise")).toBe(false);
  });

  it("learns cuisines, quick meals and high protein from saved meals", () => {
    const meal = (type: NewEvent["event_type"], name: string, cuisine: string, prep: number, protein: number, days: number) =>
      ev({
        event_type: type, entity_type: "meal", entity_id: name,
        metadata: { name, cuisine, prep_time_min: prep, protein_g: protein, calories: 450, ingredients: ["tofu", "rice", "salt"] },
      } as NewEvent, days);
    const events = [
      meal("meal_saved", "Tofu tikka", "Indian", 20, 35, 1), meal("meal_saved", "Chana bowl", "Indian", 25, 36, 2),
      meal("meal_logged", "Tofu tikka", "Indian", 20, 35, 3), meal("meal_saved", "Tofu tacos", "Mexican", 15, 40, 4),
      meal("meal_ignored", "Berry smoothie", "American", 5, 8, 2),
    ];
    const kinds = inferPreferences(buildSignals(events, [], NOW), noExplicit).map((i) => i.key);
    expect(kinds).toContain("favor_cuisine:indian");
    expect(kinds).toContain("favor_ingredient:tofu");
    expect(kinds).toContain("quick_meals:20");
    expect(kinds).toContain("high_protein:high_protein");
    expect(kinds).not.toContain("favor_ingredient:salt");
  });
});

describe("workoutPersonalization", () => {
  const skippedBurpeeish = [1, 2, 3, 4].map((d) => exercise("exercise_skipped", "Tuck jumps", "main", d));

  it("waits for a few finished workouts before using learned patterns, but always honours explicit choices", () => {
    const x: Explicit = { profile: null, preferences: [pref("exercise", "Walking lunge", "dislike")] };
    const inferences = inferPreferences(buildSignals(skippedBurpeeish, [], NOW), x);
    const early = workoutPersonalization(inferences, x, 1);
    expect(early.exclude).toEqual(["Walking lunge"]);
    expect(early.avoid).toEqual({});
    expect(workoutPersonalization(inferences, x, 3).avoid["Tuck jumps"]).toMatch(/skipped it 4 times/);
  });
});

describe("generateWorkoutPlan with personalization", () => {
  const names = (w: ReturnType<typeof generateWorkoutPlan>) => w.exercises.map((e) => e.exercise_name);

  it("is unchanged when nothing has been learned", () => {
    for (let seed = 1; seed < 10; seed++) {
      const plain = generateWorkoutPlan(request({ random: seeded(seed) }));
      const empty = generateWorkoutPlan(request({ random: seeded(seed), personalization: NO_WORKOUT_PERSONALIZATION }));
      expect(empty).toEqual(plain);
      expect(plain.personalized_because).toEqual([]);
    }
  });

  it("never picks an exercise the user asked us not to suggest", () => {
    const blocked = "Dumbbell deadlift";
    expect(EXERCISES.some((e) => e.name === blocked)).toBe(true);
    const personalization = { ...NO_WORKOUT_PERSONALIZATION, exclude: [blocked] };
    for (let seed = 1; seed < 40; seed++) {
      expect(names(generateWorkoutPlan(request({ random: seeded(seed), personalization })))).not.toContain(blocked);
    }
  });

  it("picks favourites more often and says why only when they're included", () => {
    const fav = "Dumbbell deadlift";
    const personalization = { ...NO_WORKOUT_PERSONALIZATION, favor: { [fav]: "you finished it 6 times" } };
    let plain = 0, favoured = 0;
    for (let seed = 1; seed < 80; seed++) {
      if (names(generateWorkoutPlan(request({ random: seeded(seed) }))).includes(fav)) plain++;
      const w = generateWorkoutPlan(request({ random: seeded(seed), personalization }));
      const included = names(w).includes(fav);
      if (included) favoured++;
      expect(w.personalized_because.some((r) => r.includes(fav))).toBe(included);
    }
    expect(favoured).toBeGreaterThan(plain);
  });

  it("shortens the cardio finisher, adjusts sets and length, and explains each change", () => {
    const personalization = {
      ...NO_WORKOUT_PERSONALIZATION,
      shortFinisher: "you skipped it in 4 of 5 workouts",
      setShift: { by: -1 as const, reason: "you rated 3 of your last 4 workouts too hard" },
      duration: { minutes: 30, confidence: 0.8, reason: "your recent workouts usually took 25–35 minutes" },
    };
    const plain = generateWorkoutPlan(request());
    const w = generateWorkoutPlan(request({ personalization }));
    const finisher = w.exercises.at(-2)!;
    expect(finisher.sets).toBe(2);
    expect(w.exercises.length).toBeLessThan(plain.exercises.length); // 45 → ~33 minutes
    expect(w.exercises[1].sets).toBe(plain.exercises[1].sets - 1);
    expect(w.personalized_because.join(" ")).toMatch(/Shorter cardio finisher.*One set fewer|Planned for about 33 minutes/);
    expect(w.personalized_because).toHaveLength(3);
  });
});

describe("rankMeals", () => {
  it("drops meals with disliked or allergy foods and ranks by learned taste, with honest reasons", () => {
    const x: Explicit = { profile: { disliked_foods: ["mushrooms"], allergies: [], preferred_cuisines: [], dietary_type: "vegetarian" }, preferences: [] };
    const saved = [1, 2, 3, 4].map((d) => ev({
      event_type: "meal_saved", entity_type: "meal", entity_id: `m${d}`,
      metadata: { name: `Dal ${d}`, cuisine: "Indian", prep_time_min: 20, protein_g: 35, calories: 450, ingredients: ["lentils"] },
    }, d));
    const inferences = inferPreferences(buildSignals(saved, [], NOW), x);
    const ranked = rankMeals([
      { name: "Mushroom risotto", cuisine: "Italian", prep_time_min: 40, ingredients: ["mushrooms", "rice"] },
      { name: "Pasta bake", cuisine: "Italian", prep_time_min: 45, protein_g: 15, calories: 600 },
      { name: "Paneer tikka", cuisine: "Indian", prep_time_min: 20, protein_g: 40, calories: 480, ingredients: ["paneer"] },
    ], inferences, x);
    expect(ranked.map((r) => r.meal.name)).toEqual(["Paneer tikka", "Pasta bake"]);
    expect(explain(ranked[0].because)).toBe(
      "Recommended because you often save Indian meals, you usually pick quick meals (this one takes 20 minutes) and you usually save high-protein meals.",
    );
    expect(ranked[1].because).toEqual([]);
  });
});

describe("buildPreferenceSummary", () => {
  it("is short, labels learned vs stated, and leaves out weak guesses", () => {
    const events = [
      ...[1, 2, 3, 4, 5].map((d) => workoutDone("glutes", d, 40)),
      ...[1, 2, 3, 4].map((d) => exercise("exercise_completed", "Hip thrust", "main", d)),
      exercise("exercise_skipped", "Star jumps", "finisher", 1),
    ];
    const x: Explicit = {
      profile: { disliked_foods: ["mushrooms"], allergies: ["peanuts"], preferred_cuisines: ["Mexican"], dietary_type: "vegetarian" },
      preferences: [pref("exercise", "Walking lunge", "dislike")],
    };
    const s = buildSignals(events, [], NOW);
    const text = buildPreferenceSummary(
      { fitness_goal: "build_muscle", fitness_level: "beginner", session_duration_min: 45, ...x.profile! },
      inferPreferences(s, x), x, s,
    );
    expect(text).toContain("User goal: Build muscle");
    expect(text).toContain("Allergies (never include): peanuts");
    expect(text).toContain("Preferred workout duration: about 40 minutes (learned)");
    expect(text).toContain("Frequently completed exercises (learned): Hip thrust");
    expect(text).toContain("Never suggest (stated): Walking lunge");
    expect(text).not.toContain("cardio finisher"); // one skip isn't a pattern
    expect(text.split("\n").length).toBeLessThan(20);
  });
});

describe("exerciseKey", () => {
  it("treats typed names in any case as the same exercise", () => {
    expect(exerciseKey("  kettlebell   SWINGS ")).toBe("Kettlebell swings");
  });
});
