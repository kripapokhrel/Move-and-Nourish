// Builds a workout from the exercise library with plain rules. Free, instant, no external services.
// Pure: no I/O, and randomness is injected so tests are repeatable.

import { z } from "zod";
import { NO_WORKOUT_PERSONALIZATION, type WorkoutPersonalization } from "@/lib/personalization/apply";
import { FITNESS_LEVEL, labelFor } from "@/lib/profile/options";
import type { Profile } from "@/types/database";
import { EXERCISES, findExercise, type Gear, type LibraryExercise, type Pattern } from "./library";
import { WORKOUT_FOCUS, type WorkoutFocus } from "./options";

export const generatedWorkoutSchema = z.object({
  name: z.string().min(1),
  notes: z.string(),
  exercises: z
    .array(
      z.object({
        exercise_name: z.string().min(1),
        muscle_group: z.string(),
        sets: z.number().int().min(1).max(10),
        reps: z.string().min(1),
        rest_seconds: z.number().int().min(0).max(300),
        instructions: z.string(),
      }),
    )
    .min(3)
    .max(12),
  /** Why the workout was personalized, one sentence each. Empty when nothing was learned yet. */
  personalized_because: z.array(z.string()).default([]),
});

export type GeneratedWorkout = z.infer<typeof generatedWorkoutSchema>;
export type ResolvedFocus = Exclude<WorkoutFocus, "unsure">;
export type RecentWorkout = { date: string | null; muscleGroups: string[] };

export type WorkoutRequest = {
  profile: Pick<Profile, "fitness_level" | "fitness_goal" | "workout_location" | "available_equipment" | "session_duration_min">
    & Partial<Pick<Profile, "sex">>;
  focus: WorkoutFocus;
  today: string;
  recent: RecentWorkout[];
  /** Exercise names from the version the user just refreshed away from. */
  rejected?: string[];
  /** Nudges learned from the user's behaviour and explicit likes. See lib/personalization. */
  personalization?: WorkoutPersonalization;
  random?: () => number;
};

// Slots in priority order, filled until the session is full. [pattern, muscle] only accepts exercises for that
// muscle and is skipped when there are none for the user's equipment, so templates carry spare slots.
type Slot = Pattern | [Pattern, string];
const TEMPLATES: Record<ResolvedFocus, Slot[]> = {
  full_body: ["squat", "push_horizontal", "hinge", "pull_horizontal", "push_vertical", "lunge", "core"],
  legs: [
    ["squat", "Quads"], ["hinge", "Hamstrings"], ["lunge", "Quads"], ["legs_accessory", "Quads"],
    ["legs_accessory", "Hamstrings"], ["squat", "Quads"], ["hinge", "Hamstrings"], ["lunge", "Quads"],
  ],
  glutes: [
    ["hinge", "Glutes"], ["squat", "Glutes"], ["lunge", "Glutes"], ["legs_accessory", "Glutes"],
    ["legs_accessory", "Glutes"], ["hinge", "Glutes"], ["lunge", "Glutes"],
  ],
  push: ["push_horizontal", "push_vertical", "push_horizontal", "shoulders", "triceps", "triceps", "core"],
  pull: ["pull_horizontal", "pull_vertical", "pull_horizontal", "biceps", "pull_horizontal", "biceps", "core"],
  core: ["core", "core", "core", "core", "core", "core", "core"],
  // Leaves a cardio exercise free for the finisher, even for bodyweight-only beginners
  cardio: ["cardio", "cardio", "core", "cardio", "cardio"],
};

// Muscles each focus works. Used to steer "unsure" away from what was trained recently.
const FOCUS_MUSCLES: Record<ResolvedFocus, string[]> = {
  full_body: ["Quads", "Glutes", "Hamstrings", "Chest", "Back", "Shoulders"],
  legs: ["Quads", "Hamstrings", "Calves"],
  glutes: ["Glutes", "Hamstrings"],
  push: ["Chest", "Shoulders", "Triceps"],
  pull: ["Back", "Biceps"],
  core: ["Core"],
  cardio: ["Full body"],
};

// Sets, reps and rest by goal. Beginners do one set fewer.
const PRESCRIPTION: Record<string, { sets: number; reps: string; rest: number; seconds: number }> = {
  build_muscle: { sets: 4, reps: "8-12", rest: 75, seconds: 40 },
  lose_fat: { sets: 3, reps: "12-15", rest: 40, seconds: 40 },
  improve_fitness: { sets: 3, reps: "10-15", rest: 45, seconds: 40 },
  maintain: { sets: 3, reps: "10-12", rest: 60, seconds: 35 },
};

const LEVEL = { beginner: 0, intermediate: 1, advanced: 2 } as const;
const MINUTES_PER_EXERCISE = 6;
// Warm-up stretch, cardio finisher and cool-down stretch take about 15 minutes together
const BOOKEND_MINUTES = 15;
export const MAX_MAIN_EXERCISES = 5;
const MIN_MAIN_EXERCISES = 3;

export function availableGear(p: WorkoutRequest["profile"]): Set<Gear> {
  const gear = new Set<Gear>(["none"]);
  const eq = p.available_equipment;
  if (eq.includes("dumbbells")) gear.add("dumbbells");
  if (eq.includes("resistance_bands")) gear.add("bands");
  if (eq.includes("full_gym") || p.workout_location === "gym" || p.workout_location === "both") gear.add("gym").add("dumbbells").add("bands");
  return gear;
}

/** Number of main exercises (stretches and cardio finisher not counted) that fit the session length. */
export function exerciseCount(minutes: number) {
  return Math.min(MAX_MAIN_EXERCISES, Math.max(MIN_MAIN_EXERCISES, Math.floor((minutes - BOOKEND_MINUTES) / MINUTES_PER_EXERCISE)));
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** For "unsure": the focus that overlaps least with muscles trained in the last two days. */
export function chooseFocus(req: WorkoutRequest, random: () => number): { focus: ResolvedFocus; reason: string } {
  const recentMuscles = new Set(
    req.recent
      .filter((w) => w.date && daysBetween(w.date, req.today) <= 2)
      .flatMap((w) => w.muscleGroups),
  );
  const goal = req.profile.fitness_goal;
  const p = req.personalization ?? NO_WORKOUT_PERSONALIZATION;
  let candidates: ResolvedFocus[] = ["full_body", "legs", "glutes", "push", "pull"];
  if ((goal === "lose_fat" || goal === "improve_fitness") && !p.shortFinisher) candidates.push("cardio");
  // Leave out workouts the user keeps skipping, unless that leaves nothing
  const kept = candidates.filter((f) => !p.avoidFocus.includes(f));
  if (kept.length) candidates = kept;

  if (recentMuscles.size === 0) {
    return { focus: "full_body", reason: "Nothing trained in the last two days, so a full body session hits everything." };
  }

  // Favourite focuses win ties and near-ties, but recovery still comes first
  const scored = candidates.map((f) => ({
    focus: f,
    overlap: FOCUS_MUSCLES[f].filter((m) => recentMuscles.has(m)).length / FOCUS_MUSCLES[f].length
      - (p.favorFocus.includes(f) ? 0.15 : 0),
    tiebreak: random(),
  }));
  scored.sort((a, b) => a.overlap - b.overlap || a.tiebreak - b.tiebreak);
  const pick = scored[0].focus;
  const trained = [...recentMuscles].filter((m) => m !== "Full body").slice(0, 3).join(", ").toLowerCase();
  return {
    focus: pick,
    reason: trained
      ? `You recently trained ${trained}, so today is ${labelFor(WORKOUT_FOCUS, pick).toLowerCase()} to let those recover.`
      : `Picked ${labelFor(WORKOUT_FOCUS, pick).toLowerCase()} to balance your week.`,
  };
}

export type Stage = "warmup" | "main" | "finisher" | "cooldown";
type Prescribed = GeneratedWorkout["exercises"][number];

const levelOf = (p: WorkoutRequest["profile"]) => LEVEL[p.fitness_level as keyof typeof LEVEL] ?? 0;

/** Women get a little less rest between sets (see FEMALE_REST_FACTOR), never below MIN_REST_SECONDS. */
function restFor(profile: WorkoutRequest["profile"], seconds: number) {
  if (profile.sex !== "female" || seconds <= MIN_REST_SECONDS) return seconds;
  return Math.max(MIN_REST_SECONDS, Math.round((seconds * FEMALE_REST_FACTOR) / 5) * 5);
}

/** Sets, reps and rest for one exercise at a given point in the workout. Used by generation and by swaps. */
export function prescribe(profile: WorkoutRequest["profile"], e: LibraryExercise, stage: Stage): Prescribed {
  const row = (sets: number, reps: string, rest: number) => ({
    exercise_name: e.name, muscle_group: e.muscle, sets, reps, rest_seconds: rest, instructions: e.tips.join("\n"),
  });
  if (stage === "warmup") return row(1, "2 min", 0);
  if (stage === "cooldown") return row(1, e.perSide ? "30 sec each side" : "60 sec", 0);
  // Machines run as one steady block; bodyweight cardio as short intervals
  if (stage === "finisher") return e.needs === "gym" ? row(1, "5 min", 0) : row(4, "30 sec", 30);

  const rx = PRESCRIPTION[profile.fitness_goal ?? "maintain"] ?? PRESCRIPTION.maintain;
  const sets = Math.max(2, rx.sets - (levelOf(profile) === 0 ? 1 : 0));
  const side = e.perSide ? ` each ${e.perSide}` : "";
  if (e.pattern === "cardio") return row(Math.max(3, sets), `${e.timed ? "40 sec" : rx.reps}${side}`, 20);
  const rest = e.pattern === "core" ? Math.min(rx.rest, 45) : rx.rest;
  return row(sets, `${e.timed ? `${rx.seconds} sec` : rx.reps}${side}`, restFor(profile, rest));
}

/** Where an exercise sits in a saved workout: the bookends are recognised by position and type. */
export function stageOf(names: string[], index: number): Stage {
  const pattern = findExercise(names[index])?.pattern;
  if (index === 0 && pattern === "warmup") return "warmup";
  if (index === names.length - 1 && pattern === "cooldown") return "cooldown";
  if (index === names.length - 2 && pattern === "cardio") return "finisher";
  return "main";
}

const GEAR_LABEL: Record<Gear, string> = { none: "bodyweight", dumbbells: "dumbbell", bands: "resistance band", gym: "gym machine" };

const STAGE_PATTERN: Partial<Record<Stage, Pattern>> = { warmup: "warmup", cooldown: "cooldown", finisher: "cardio" };
const BOOKEND_PATTERNS: Pattern[] = ["warmup", "cooldown", "cardio"];

/**
 * Library exercises the user could swap in: same kind of movement (or, if few, same muscle), doable with
 * their equipment and level, and not already in the workout.
 */
export function swapOptions(
  profile: WorkoutRequest["profile"], current: string, stage: Stage, inWorkout: string[],
): LibraryExercise[] {
  const gear = availableGear(profile);
  const level = levelOf(profile);
  const taken = new Set(inWorkout);
  const usable = EXERCISES.filter((e) => gear.has(e.needs) && e.level <= level && !taken.has(e.name));
  const cur = findExercise(current);

  const pattern = STAGE_PATTERN[stage] ?? cur?.pattern;
  const same = usable.filter((e) => e.pattern === pattern);
  const sameMuscle = stage === "main" && cur
    ? usable.filter((e) => e.muscle === cur.muscle && e.pattern !== pattern && !BOOKEND_PATTERNS.includes(e.pattern))
    : [];
  return [...same, ...(same.length < 4 ? sameMuscle : [])].sort((a, b) => a.name.localeCompare(b.name));
}

/** Random pick where an item with weight 2 is twice as likely. Equal weights behave like a plain random pick. */
function pickWeighted<T>(items: T[], weight: (item: T) => number, random: () => number): T | undefined {
  if (!items.length) return undefined;
  const weights = items.map(weight);
  let target = random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) {
    target -= weights[i];
    if (target < 0) return items[i];
  }
  return items.at(-1);
}

// How much a learned preference changes the odds of an exercise being picked
const FAVOR_WEIGHT = 3;
const AVOID_WEIGHT = 0.2;
const GEAR_WEIGHT = 2;
const SHORT_FINISHER = { intervals: 2, machine: "3 min" };

// Differences for women, kept small and only where research supports them. Exercise choice and sets/reps stay the
// same, because men and women gain muscle and strength at similar relative rates (Roberts et al. 2020, JSCR).
// - Women usually tire less and recover faster between sets (Hunter 2014, Acta Physiologica), so rests are shorter.
// - Women have a higher risk of ACL knee injuries; hip and hamstring strength is part of the neuromuscular training
//   that roughly halves that risk. So lower-body days always include one exercise tagged `knee` in the library.
// - Menstrual cycle phase has only trivial effects on strength (McNulty et al. 2020), so nothing changes by cycle.
const FEMALE_REST_FACTOR = 0.8;
const MIN_REST_SECONDS = 30;
const KNEE_FOCUSES: ResolvedFocus[] = ["full_body", "legs", "glutes"];
// Muscles a knee exercise must work so it still fits the day
// Exercises whose photos show a woman are this much more likely for women users
const WOMAN_PHOTO_WEIGHT = 2;
const FOCUS_KNEE_MUSCLES: Partial<Record<ResolvedFocus, string[]>> = { legs: ["Quads", "Hamstrings"], glutes: ["Glutes"] };

/** Session length to plan for: moves from the profile setting toward what the user actually does, by confidence. */
function plannedMinutes(profileMinutes: number, p: WorkoutPersonalization) {
  if (!p.duration) return { minutes: profileMinutes, changed: false };
  const minutes = Math.round(profileMinutes + (p.duration.minutes - profileMinutes) * p.duration.confidence);
  return Math.abs(minutes - profileMinutes) >= 5 ? { minutes, changed: true } : { minutes: profileMinutes, changed: false };
}

export function generateWorkoutPlan(req: WorkoutRequest): GeneratedWorkout {
  const random = req.random ?? Math.random;
  const { profile } = req;
  const gear = availableGear(profile);
  const level = levelOf(profile);
  const rejected = new Set(req.rejected ?? []);
  const used = new Set<string>();
  const p = req.personalization ?? NO_WORKOUT_PERSONALIZATION;
  const excluded = new Set(p.exclude.map((n) => n.toLowerCase()));
  const isExcluded = (e: LibraryExercise) => excluded.has(e.name.toLowerCase());
  const bookend = (e: LibraryExercise) => BOOKEND_PATTERNS.includes(e.pattern);
  const weight = (e: LibraryExercise) =>
    (profile.sex === "female" && e.woman ? WOMAN_PHOTO_WEIGHT : 1) *
    (p.favor[e.name] ? FAVOR_WEIGHT : 1) *
    (p.avoid[e.name] ? AVOID_WEIGHT : 1) *
    (p.gear && !bookend(e) && e.needs === p.gear.gear ? GEAR_WEIGHT : 1);
  const pickOne = (items: LibraryExercise[]) => pickWeighted(items, weight, random);

  const { focus, reason } = req.focus === "unsure"
    ? chooseFocus(req, random)
    : { focus: req.focus, reason: "" };

  const fits = (e: LibraryExercise) => gear.has(e.needs) && e.level <= level && !used.has(e.name);
  // Gym users get equipment exercises where there is one; home moves like the under-table pull-up are a fallback.
  // Core and the bookends stay open, since planks and stretches are normal at the gym.
  const atGym = gear.has("gym");
  const suitsGym = (e: LibraryExercise) => !atGym || e.needs !== "none" || e.pattern === "core" || bookend(e);
  // Prefer exercises not in the refreshed-away version, then fall back so a slot is never empty
  const choose = (pattern: Pattern, prefer: (e: LibraryExercise) => boolean = () => true, strict = false) => {
    const all = EXERCISES.filter((e) => e.pattern === pattern && fits(e) && (!strict || prefer(e)));
    // Exercises the user said never to suggest are a last resort, only so a slot is never empty
    const options = all.filter((e) => !isExcluded(e));
    const fresh = options.filter((e) => !rejected.has(e.name));
    const pick =
      pickOne(fresh.filter((e) => prefer(e) && suitsGym(e))) ?? pickOne(fresh.filter(prefer)) ?? pickOne(fresh) ??
      pickOne(options.filter(prefer)) ?? pickOne(options) ?? pickOne(all);
    if (pick) used.add(pick.name);
    return pick;
  };

  // Order: warm-up stretch -> main exercises (max 5) -> cardio finisher -> cool-down stretch
  const warmup = choose("warmup");
  const planned = plannedMinutes(profile.session_duration_min, p);
  const target = exerciseCount(planned.minutes);
  const main: LibraryExercise[] = [];
  for (const slot of TEMPLATES[focus]) {
    if (main.length === target) break;
    const pick = Array.isArray(slot) ? choose(slot[0], (e) => e.muscle === slot[1], true) : choose(slot);
    if (pick) main.push(pick);
  }
  // Women's lower-body days: make sure one exercise supports the knees, replacing the last pick if needed
  const female = profile.sex === "female";
  let kneeAdded: LibraryExercise | undefined;
  if (female && KNEE_FOCUSES.includes(focus) && !main.some((e) => e.knee)) {
    const muscles = FOCUS_KNEE_MUSCLES[focus];
    const options = EXERCISES.filter((e) => e.knee && fits(e) && !isExcluded(e) && (!muscles || muscles.includes(e.muscle)));
    kneeAdded = pickOne(options);
    if (kneeAdded) {
      used.add(kneeAdded.name);
      if (main.length >= target) {
        const dropped = main.pop()!;
        used.delete(dropped.name);
      }
      main.push(kneeAdded);
    }
  }
  // Some focuses have few exercises for home setups (e.g. Pull with no equipment). Top up with core so there are always 3.
  while (main.length < MIN_MAIN_EXERCISES) {
    const pick = choose("core");
    if (!pick) break;
    main.push(pick);
  }
  const finisher = choose("cardio");
  const cooldown = choose("cooldown", (e) => FOCUS_MUSCLES[focus].includes(e.muscle));

  const cardio = focus === "cardio";
  const shortFinisher = !!p.shortFinisher && !cardio;
  const shift = p.setShift?.by ?? 0;
  const mainRx = (e: LibraryExercise) => {
    const rx = prescribe(profile, e, "main");
    return shift ? { ...rx, sets: Math.min(6, Math.max(2, rx.sets + shift)) } : rx;
  };
  const finisherRx = (e: LibraryExercise) => {
    const rx = prescribe(profile, e, "finisher");
    if (!shortFinisher) return rx;
    return e.needs === "gym" ? { ...rx, reps: SHORT_FINISHER.machine } : { ...rx, sets: SHORT_FINISHER.intervals };
  };

  const exercises = [
    ...(warmup ? [prescribe(profile, warmup, "warmup")] : []),
    ...main.map(mainRx),
    ...(finisher ? [finisherRx(finisher)] : []),
    ...(cooldown ? [prescribe(profile, cooldown, "cooldown")] : []),
  ];

  // Explain only what actually changed this workout
  const picked = [warmup, ...main, finisher, cooldown].filter((e): e is LibraryExercise => !!e);
  const templatePatterns = new Set<Pattern>([...TEMPLATES[focus].map((s) => (Array.isArray(s) ? s[0] : s)), ...BOOKEND_PATTERNS]);
  const couldHaveFit = (name: string) => {
    const e = findExercise(name);
    return !!e && gear.has(e.needs) && e.level <= level && templatePatterns.has(e.pattern) && !used.has(e.name);
  };
  const why: string[] = [];
  for (const e of picked.filter((e) => p.favor[e.name]).slice(0, 2)) why.push(`Includes ${e.name} because ${p.favor[e.name]}.`);
  for (const name of Object.keys(p.avoid).filter(couldHaveFit).slice(0, 2)) why.push(`Left out ${name} because ${p.avoid[name]}.`);
  const leftOut = p.exclude.filter(couldHaveFit);
  if (leftOut.length) why.push(`Leaves out ${leftOut.slice(0, 3).join(", ")}, which you asked us not to suggest.`);
  if (p.gear && main.some((e) => e.needs === p.gear!.gear)) {
    why.push(`More ${GEAR_LABEL[p.gear.gear]} exercises because ${p.gear.reason}.`);
  }
  if (shortFinisher && finisher) why.push(`Shorter cardio finisher because ${p.shortFinisher}.`);
  if (planned.changed) why.push(`Planned for about ${planned.minutes} minutes because ${p.duration!.reason}.`);
  if (shift && main.length) why.push(`${shift < 0 ? "One set fewer" : "One extra set"} on main exercises because ${p.setShift!.reason}.`);
  if (kneeAdded) {
    why.push(`Includes ${kneeAdded.name} to strengthen your hips and hamstrings. Research shows this helps protect women's knees from injury.`);
  }
  if (female && main.some((e) => prescribe(profile, e, "main").rest_seconds !== prescribe({ ...profile, sex: undefined }, e, "main").rest_seconds)) {
    why.push("Rest between sets is a little shorter, because research shows women usually recover faster between sets.");
  }
  if (req.focus === "unsure" && p.favorFocus.includes(focus)) why.push(`Picked ${labelFor(WORKOUT_FOCUS, focus).split(" (")[0].toLowerCase()} partly because you train it often.`);

  const focusLabel = labelFor(WORKOUT_FOCUS, focus).split(" (")[0];
  const levelLabel = labelFor(FITNESS_LEVEL, profile.fitness_level).toLowerCase();
  const gearText = gear.has("gym") ? "gym equipment" : gear.size > 1 ? "your equipment" : "just your bodyweight";
  return generatedWorkoutSchema.parse({
    name: cardio ? "Cardio Conditioning" : `${focusLabel.replace(/\b\w/g, (c) => c.toUpperCase())} Workout`,
    notes: reason || `A ${planned.minutes}-minute ${focusLabel.toLowerCase()} session for ${/^[aeiou]/.test(levelLabel) ? "an" : "a"} ${levelLabel}, using ${gearText}.`,
    exercises,
    personalized_because: why,
  });
}
