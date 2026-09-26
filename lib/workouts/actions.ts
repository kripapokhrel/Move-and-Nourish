"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { finishWorkout, rateExercise, rateWorkout, setExerciseDone, setExercisePreference, skipWorkout } from "./complete";
import { addCustomExercise, removeExercise, saveWorkoutNotes, swapExercise } from "./edit";
import { WORKOUT_FOCUS, type WorkoutFocus } from "./options";
import { generateTodayWorkout } from "./service";

export type WorkoutActionResult = { ok: true } | { ok: false; error: string };

const focusSchema = z.enum(WORKOUT_FOCUS.map((f) => f.value) as [WorkoutFocus, ...WorkoutFocus[]]);
const id = z.uuid();
const exerciseName = z.string().trim().min(1, "Type an exercise name").max(80, "Keep the name under 80 characters");
const swapSchema = z.object({
  exerciseId: id,
  choice: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("library"), name: z.string().min(1) }),
    z.object({ kind: z.literal("custom"), name: exerciseName }),
  ]),
});
const addSchema = z.object({
  workoutId: id,
  name: exerciseName,
  sets: z.number({ error: "Sets must be a number" }).int().min(1, "At least 1 set").max(10, "10 sets max"),
  reps: z.string().trim().min(1, "Add reps or time, e.g. 10 or 30 sec").max(30),
});
const notesSchema = z.object({ workoutId: id, notes: z.string().max(1000, "Keep notes under 1000 characters") });
const doneSchema = z.object({ exerciseId: id, done: z.boolean() });
const finishSchema = z.object({
  workoutId: id,
  durationMin: z.number({ error: "Enter how many minutes it took" }).int().min(1, "At least 1 minute").max(300, "300 minutes max"),
  done: z.array(id).max(50),
});
const rateWorkoutSchema = z.object({ workoutId: id, rating: z.enum(["too_easy", "just_right", "too_hard"]).nullable() });
const rateExerciseSchema = z.object({ exerciseId: id, rating: z.enum(["too_easy", "too_hard"]).nullable() });
const preferenceSchema = z.object({ name: exerciseName, sentiment: z.enum(["like", "dislike"]).nullable() });

/** Runs an edit for the signed-in user and turns failures into a message the UI can show. */
async function run(label: string, fn: (db: Awaited<ReturnType<typeof requireUser>>) => Promise<unknown>): Promise<WorkoutActionResult> {
  const user = await requireUser();
  try {
    await fn(user);
  } catch (e) {
    console.error(`${label} failed`, e);
    const message = (e as { message?: string })?.message ?? "";
    if (/user_events|user_preferences|recommendation_feedback|user_behavior_summary|personaliz/.test(message)) {
      return { ok: false, error: "The database needs an update: run supabase/migrations/0004_personalization.sql in the Supabase SQL editor." };
    }
    if (/column .*user_notes/.test(message)) {
      return { ok: false, error: "The database needs an update: run supabase/migrations/0003_workout_user_notes.sql in the Supabase SQL editor." };
    }
    if (/column .*(focus|notes)/.test(message)) {
      return { ok: false, error: "The database needs an update: run supabase/migrations/0002_workout_focus.sql in the Supabase SQL editor." };
    }
    return { ok: false, error: message || "Something went wrong. Try again." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Check your input.";

export async function generateWorkoutAction(rawFocus: unknown): Promise<WorkoutActionResult> {
  const parsed = focusSchema.safeParse(rawFocus);
  if (!parsed.success) return { ok: false, error: "Pick what you want to train." };
  return run("generateWorkout", ({ supabase, userId }) => generateTodayWorkout(supabase, userId, parsed.data));
}

export async function swapExerciseAction(raw: unknown): Promise<WorkoutActionResult> {
  const parsed = swapSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { exerciseId, choice } = parsed.data;
  return run("swapExercise", ({ supabase, userId }) => swapExercise(supabase, userId, exerciseId, choice));
}

export async function addExerciseAction(raw: unknown): Promise<WorkoutActionResult> {
  const parsed = addSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { workoutId, ...input } = parsed.data;
  return run("addExercise", ({ supabase, userId }) => addCustomExercise(supabase, userId, workoutId, input));
}

export async function removeExerciseAction(exerciseId: unknown): Promise<WorkoutActionResult> {
  const parsed = id.safeParse(exerciseId);
  if (!parsed.success) return { ok: false, error: "Couldn't find that exercise." };
  return run("removeExercise", ({ supabase, userId }) => removeExercise(supabase, userId, parsed.data));
}

export async function saveWorkoutNotesAction(raw: unknown): Promise<WorkoutActionResult> {
  const parsed = notesSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { workoutId, notes } = parsed.data;
  return run("saveWorkoutNotes", ({ supabase, userId }) => saveWorkoutNotes(supabase, userId, workoutId, notes.trim()));
}

export async function setExerciseDoneAction(raw: unknown): Promise<WorkoutActionResult> {
  const parsed = doneSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Couldn't find that exercise." };
  const { exerciseId, done } = parsed.data;
  return run("setExerciseDone", ({ supabase, userId }) => setExerciseDone(supabase, userId, exerciseId, done));
}

export async function finishWorkoutAction(raw: unknown): Promise<WorkoutActionResult> {
  const parsed = finishSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { workoutId, durationMin, done } = parsed.data;
  return run("finishWorkout", ({ supabase, userId }) => finishWorkout(supabase, userId, workoutId, durationMin, done));
}

export async function skipWorkoutAction(workoutId: unknown): Promise<WorkoutActionResult> {
  const parsed = id.safeParse(workoutId);
  if (!parsed.success) return { ok: false, error: "Couldn't find that workout." };
  return run("skipWorkout", ({ supabase, userId }) => skipWorkout(supabase, userId, parsed.data));
}

export async function rateWorkoutAction(raw: unknown): Promise<WorkoutActionResult> {
  const parsed = rateWorkoutSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Pick a rating." };
  const { workoutId, rating } = parsed.data;
  return run("rateWorkout", ({ supabase, userId }) => rateWorkout(supabase, userId, workoutId, rating));
}

export async function rateExerciseAction(raw: unknown): Promise<WorkoutActionResult> {
  const parsed = rateExerciseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Pick a rating." };
  const { exerciseId, rating } = parsed.data;
  return run("rateExercise", ({ supabase, userId }) => rateExercise(supabase, userId, exerciseId, rating));
}

export async function setExercisePreferenceAction(raw: unknown): Promise<WorkoutActionResult> {
  const parsed = preferenceSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { name, sentiment } = parsed.data;
  return run("setExercisePreference", ({ supabase, userId }) => setExercisePreference(supabase, userId, name, sentiment));
}
