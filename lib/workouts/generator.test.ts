import { describe, expect, it } from "vitest";
import {
  MAX_MAIN_EXERCISES, availableGear, chooseFocus, exerciseCount, generateWorkoutPlan, prescribe, stageOf, swapOptions,
  type WorkoutRequest,
} from "./generator";
import { EXERCISES } from "./library";

// Small seeded RNG so results are repeatable
const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

const base = (over: Partial<WorkoutRequest> = {}): WorkoutRequest => ({
  profile: {
    fitness_level: "beginner", fitness_goal: "build_muscle", workout_location: "home",
    available_equipment: ["none"], session_duration_min: 45,
  },
  focus: "legs",
  today: "2026-09-26",
  recent: [],
  random: seeded(42),
  ...over,
});

const byName = new Map(EXERCISES.map((e) => [e.name, e]));

describe("generateWorkoutPlan", () => {
  it("only uses bodyweight exercises when the user has no equipment", () => {
    for (let seed = 1; seed < 20; seed++) {
      const w = generateWorkoutPlan(base({ focus: "full_body", random: seeded(seed) }));
      for (const e of w.exercises) expect(byName.get(e.exercise_name)?.needs).toBe("none");
    }
  });

  it("keeps beginners on beginner exercises", () => {
    const w = generateWorkoutPlan(base({ focus: "push" }));
    for (const e of w.exercises) expect(byName.get(e.exercise_name)?.level).toBe(0);
  });

  it("goes stretch -> main exercises -> cardio -> stretch, for every focus and equipment", () => {
    const setups = [
      base().profile,
      { ...base().profile, workout_location: "gym" as const, fitness_level: "advanced" as const },
      { ...base().profile, available_equipment: ["dumbbells" as const] },
    ];
    for (const profile of setups) {
      for (const focus of ["full_body", "legs", "glutes", "push", "pull", "core", "cardio", "unsure"] as const) {
        for (let seed = 1; seed < 6; seed++) {
          const patterns = generateWorkoutPlan(base({ profile, focus, random: seeded(seed) }))
            .exercises.map((e) => byName.get(e.exercise_name)?.pattern);
          expect(patterns[0]).toBe("warmup");
          expect(patterns.at(-2)).toBe("cardio");
          expect(patterns.at(-1)).toBe("cooldown");
          expect(patterns.length - 3).toBeLessThanOrEqual(MAX_MAIN_EXERCISES);
        }
      }
    }
  });

  it("always has at least 3 main exercises, even for Pull with no equipment", () => {
    for (const focus of ["full_body", "legs", "glutes", "push", "pull", "core", "cardio"] as const) {
      for (let seed = 1; seed < 10; seed++) {
        const w = generateWorkoutPlan(base({ focus, random: seeded(seed) }));
        expect(w.exercises.length - 3).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("fits the number of main exercises to the session length, max 5", () => {
    expect(exerciseCount(20)).toBe(3);
    expect(exerciseCount(45)).toBe(5);
    expect(exerciseCount(120)).toBe(5);
    const w = generateWorkoutPlan(base({ profile: { ...base().profile, session_duration_min: 30 } }));
    expect(w.exercises.length).toBe(3 + 3);
  });

  it("includes step-by-step tips for every exercise", () => {
    const w = generateWorkoutPlan(base({ focus: "full_body" }));
    for (const e of w.exercises) expect(e.instructions.split("\n").length).toBeGreaterThanOrEqual(3);
  });

  it("makes Legs days about quads and hamstrings and Glutes days about glutes", () => {
    for (let seed = 1; seed < 10; seed++) {
      for (const profile of [base().profile, { ...base().profile, workout_location: "gym" as const }]) {
        const muscles = (focus: "legs" | "glutes") =>
          generateWorkoutPlan(base({ profile, focus, random: seeded(seed) })).exercises.slice(1, -2).map((e) => e.muscle_group);
        expect(muscles("legs").every((m) => m === "Quads" || m === "Hamstrings")).toBe(true);
        expect(muscles("glutes").every((m) => m === "Glutes")).toBe(true);
      }
    }
  });

  it("keeps Pull days on back and biceps, with core only as a top-up", () => {
    for (let seed = 1; seed < 10; seed++) {
      for (const profile of [base().profile, { ...base().profile, available_equipment: ["dumbbells" as const] }, { ...base().profile, workout_location: "gym" as const }]) {
        const muscles = generateWorkoutPlan(base({ profile, focus: "pull", random: seeded(seed) })).exercises.slice(1, -2).map((e) => e.muscle_group);
        expect(muscles.every((m) => m === "Back" || m === "Biceps" || m === "Core")).toBe(true);
      }
    }
  });

  // Glutes days can still fall back to hip lifts and step-ups, which are fine at the gym
  it("gives gym users equipment exercises instead of home moves on upper-body and full-body days", () => {
    const gym = { ...base().profile, workout_location: "gym" as const };
    for (let seed = 1; seed < 20; seed++) {
      for (const focus of ["full_body", "push", "pull"] as const) {
        const main = generateWorkoutPlan(base({ profile: gym, focus, random: seeded(seed) })).exercises.slice(1, -2);
        const home = main.filter((e) => byName.get(e.exercise_name)?.needs === "none" && byName.get(e.exercise_name)?.pattern !== "core");
        expect(home.map((e) => e.exercise_name)).toEqual([]);
      }
    }
  });

  it("says 'an intermediate' but 'a beginner'", () => {
    expect(generateWorkoutPlan(base({ profile: { ...base().profile, fitness_level: "intermediate" } })).notes).toContain("for an intermediate,");
    expect(generateWorkoutPlan(base()).notes).toContain("for a beginner,");
  });

  it("never repeats an exercise in one workout", () => {
    const w = generateWorkoutPlan(base({ focus: "core", profile: { ...base().profile, session_duration_min: 90 } }));
    const names = w.exercises.map((e) => e.exercise_name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("swaps out rejected exercises on refresh when alternatives exist", () => {
    const first = generateWorkoutPlan(base({ profile: { ...base().profile, workout_location: "gym", fitness_level: "advanced" } }));
    const rejected = first.exercises.map((e) => e.exercise_name);
    const second = generateWorkoutPlan(base({
      profile: { ...base().profile, workout_location: "gym", fitness_level: "advanced" }, rejected, random: seeded(7),
    }));
    const repeats = second.exercises.filter((e) => rejected.includes(e.exercise_name)).length;
    expect(repeats).toBeLessThan(second.exercises.length / 2);
  });
});

describe("chooseFocus (unsure)", () => {
  it("picks full body when nothing was trained recently", () => {
    expect(chooseFocus(base({ focus: "unsure" }), seeded(1)).focus).toBe("full_body");
  });

  it("avoids muscles trained in the last two days", () => {
    const recent = [{ date: "2026-09-25", muscleGroups: ["Quads", "Glutes", "Hamstrings", "Calves"] }];
    const { focus } = chooseFocus(base({ focus: "unsure", recent }), seeded(1));
    expect(["push", "pull"]).toContain(focus);
  });

  it("ignores workouts older than two days", () => {
    const recent = [{ date: "2026-09-20", muscleGroups: ["Chest", "Back"] }];
    expect(chooseFocus(base({ focus: "unsure", recent }), seeded(1)).focus).toBe("full_body");
  });
});

describe("availableGear", () => {
  it("gives gym users everything", () => {
    const g = availableGear({ ...base().profile, workout_location: "gym" });
    expect([...g].sort()).toEqual(["bands", "dumbbells", "gym", "none"]);
  });
});

describe("library", () => {
  it("has start and finish photos for every exercise", () => {
    const missing = EXERCISES.filter((e) => !e.image).map((e) => e.name);
    expect(missing).toEqual([]);
  });

  it("has unique names and at least 3 tips each", () => {
    expect(new Set(EXERCISES.map((e) => e.name)).size).toBe(EXERCISES.length);
    for (const e of EXERCISES) expect(e.tips.length).toBeGreaterThanOrEqual(3);
  });
});

describe("swapping", () => {
  const w = generateWorkoutPlan(base({ focus: "full_body", random: seeded(3) }));
  const names = w.exercises.map((e) => e.exercise_name);

  it("recognises the warm-up, cardio finisher and cool-down by position", () => {
    expect(stageOf(names, 0)).toBe("warmup");
    expect(stageOf(names, 1)).toBe("main");
    expect(stageOf(names, names.length - 2)).toBe("finisher");
    expect(stageOf(names, names.length - 1)).toBe("cooldown");
  });

  it("only suggests exercises that fit the user and aren't already in the workout", () => {
    names.forEach((n, i) => {
      for (const o of swapOptions(base().profile, n, stageOf(names, i), names)) {
        expect(o.needs).toBe("none");
        expect(o.level).toBe(0);
        expect(names).not.toContain(o.name);
      }
    });
  });

  it("keeps bookends as bookends: cardio for the finisher, stretches for the cool-down", () => {
    const last = names.length - 1;
    expect(swapOptions(base().profile, names[last - 1], "finisher", names).every((o) => o.pattern === "cardio")).toBe(true);
    expect(swapOptions(base().profile, names[last], "cooldown", names).every((o) => o.pattern === "cooldown")).toBe(true);
  });

  it("gives a swapped-in exercise the right sets and reps for its spot", () => {
    const plank = byName.get("Plank")!;
    expect(prescribe(base().profile, plank, "main").reps).toBe("40 sec");
    expect(prescribe(base().profile, byName.get("Treadmill run")!, "finisher")).toMatchObject({ sets: 1, reps: "5 min" });
  });
});

describe("differences for women (research-based)", () => {
  const knee = new Set(EXERCISES.filter((e) => e.knee).map((e) => e.name));
  const setups = [
    base().profile,
    { ...base().profile, available_equipment: ["dumbbells"], fitness_level: "intermediate" },
    { ...base().profile, workout_location: "gym", available_equipment: ["full_gym"], fitness_level: "advanced" },
  ] as WorkoutRequest["profile"][];

  it("always includes a knee-supporting exercise on women's lower-body days, and says why", () => {
    for (const profile of setups) {
      for (const focus of ["legs", "glutes", "full_body"] as const) {
        for (let seed = 1; seed < 15; seed++) {
          const w = generateWorkoutPlan(base({ profile: { ...profile, sex: "female" }, focus, random: seeded(seed) }));
          const names = w.exercises.map((e) => e.exercise_name);
          expect(names.some((n) => knee.has(n)), `${focus} ${profile.available_equipment}`).toBe(true);
          expect(w.exercises.length - 3).toBeLessThanOrEqual(MAX_MAIN_EXERCISES);
          const added = w.personalized_because.find((r) => r.includes("protect women's knees"));
          if (added) expect(names.some((n) => added.includes(n))).toBe(true);
        }
      }
    }
  });

  it("keeps each day on its muscles when adding the knee exercise", () => {
    for (let seed = 1; seed < 20; seed++) {
      const w = generateWorkoutPlan(base({ profile: { ...setups[1], sex: "female" }, focus: "glutes", random: seeded(seed) }));
      for (const e of w.exercises.slice(1, -2)) expect(byName.get(e.exercise_name)?.muscle).toBe("Glutes");
    }
  });

  it("gives women slightly shorter rests, never under 30 seconds, and the same exercises otherwise", () => {
    const squat = byName.get("Squat")!;
    const man = prescribe({ ...base().profile, sex: "male" }, squat, "main");
    const woman = prescribe({ ...base().profile, sex: "female" }, squat, "main");
    expect(woman.rest_seconds).toBe(60); // 75 × 0.8
    expect(man.rest_seconds).toBe(75);
    expect({ ...woman, rest_seconds: 0 }).toEqual({ ...man, rest_seconds: 0 });
    const fatLoss = prescribe({ ...base().profile, fitness_goal: "lose_fat", sex: "female" }, squat, "main");
    expect(fatLoss.rest_seconds).toBeGreaterThanOrEqual(30);
  });

  it("picks exercises photographed with a woman more often for women", () => {
    const woman = new Set(EXERCISES.filter((e) => e.woman).map((e) => e.name));
    expect(woman.size).toBeGreaterThan(0);
    let forWomen = 0, forOthers = 0;
    for (let seed = 1; seed < 150; seed++) {
      const req = { focus: "core" as const, random: seeded(seed) };
      const count = (sex: "female" | "male") =>
        generateWorkoutPlan(base({ ...req, profile: { ...setups[2], sex } })).exercises.filter((e) => woman.has(e.exercise_name)).length;
      forWomen += count("female");
      forOthers += count("male");
    }
    expect(forWomen).toBeGreaterThan(forOthers);
  });

  it("changes nothing for men or anyone who prefers not to say", () => {
    for (const sex of ["male", "other", undefined] as const) {
      const w = generateWorkoutPlan(base({ profile: { ...base().profile, sex }, focus: "push" }));
      expect(w).toEqual(generateWorkoutPlan(base({ focus: "push" })));
    }
  });
});
