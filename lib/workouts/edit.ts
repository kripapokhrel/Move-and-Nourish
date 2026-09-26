import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getProfile } from "@/lib/db/profiles";
import {
  deleteExercise, getExerciseWithWorkout, getWorkoutById, insertExerciseAt, updateExercise, updateWorkoutUserNotes,
} from "@/lib/db/workouts";
import { exerciseKey } from "@/lib/personalization/events";
import { track } from "@/lib/personalization/service";
import type { WorkoutWithExercises } from "@/types/database";
import { exerciseEvent } from "./events";
import { prescribe, stageOf, swapOptions } from "./generator";
import { findExercise } from "./library";

/** Swap in a suggested library exercise, or anything the user typed. */
export type SwapChoice = { kind: "library"; name: string } | { kind: "custom"; name: string };
export type CustomExercise = { name: string; sets: number; reps: string };

function assertEditable(workout: WorkoutWithExercises | null | undefined): asserts workout is WorkoutWithExercises {
  if (!workout) throw new Error("That workout no longer exists. Refresh the page.");
  if (workout.status !== "planned") throw new Error("Finished workouts can't be edited.");
}

export async function swapExercise(db: SupabaseClient, userId: string, exerciseId: string, choice: SwapChoice) {
  const found = await getExerciseWithWorkout(db, userId, exerciseId);
  assertEditable(found?.workout);
  const { exercise, workout } = found!;
  const names = workout.workout_exercises.map((e) => e.exercise_name);
  const stage = stageOf(names, names.indexOf(exercise.exercise_name));
  const replaced = (to: string) => exerciseEvent("exercise_replaced", exercise.exercise_name, stage, {
    replaced_with: exerciseKey(to), replaced_with_gear: findExercise(to)?.needs, custom: choice.kind === "custom" || undefined,
  });

  if (choice.kind === "custom") {
    // Typed by the user: keep the same sets/reps/rest, no photo or tips
    await updateExercise(db, userId, exercise.id, { exercise_name: choice.name, muscle_group: null, instructions: null });
    await track(db, userId, [replaced(choice.name)]);
    return;
  }

  const profile = await getProfile(db, userId);
  if (!profile) throw new Error("Finish onboarding first.");
  const allowed = swapOptions(profile, exercise.exercise_name, stage, names).some((e) => e.name === choice.name);
  const next = findExercise(choice.name);
  if (!allowed || !next) throw new Error("That exercise isn't available for this spot. Pick another.");

  await updateExercise(db, userId, exercise.id, prescribe(profile, next, stage));
  await track(db, userId, [replaced(next.name)], profile);
}

/** Adds the user's own exercise at the end of the main block, before the cardio finisher and cool-down. */
export async function addCustomExercise(db: SupabaseClient, userId: string, workoutId: string, input: CustomExercise) {
  const workout = await getWorkoutById(db, userId, workoutId);
  assertEditable(workout);

  const names = workout.workout_exercises.map((e) => e.exercise_name);
  let insertAt = names.length;
  while (insertAt > 0 && ["finisher", "cooldown"].includes(stageOf(names, insertAt - 1))) insertAt--;
  const position = workout.workout_exercises[insertAt]?.position ?? names.length;

  await insertExerciseAt(db, userId, workout, position, {
    exercise_name: input.name, muscle_group: null, sets: input.sets, reps: input.reps, rest_seconds: 60, instructions: null,
  });
  await track(db, userId, [exerciseEvent("exercise_added", input.name, "main")]);
}

export async function removeExercise(db: SupabaseClient, userId: string, exerciseId: string) {
  const found = await getExerciseWithWorkout(db, userId, exerciseId);
  assertEditable(found?.workout);
  const { exercise, workout } = found!;
  if (workout.workout_exercises.length <= 1) throw new Error("A workout needs at least one exercise.");
  const names = workout.workout_exercises.map((e) => e.exercise_name);
  const stage = stageOf(names, names.indexOf(exercise.exercise_name));
  await deleteExercise(db, userId, exerciseId);
  await track(db, userId, [exerciseEvent("exercise_removed", exercise.exercise_name, stage)]);
}

export async function saveWorkoutNotes(db: SupabaseClient, userId: string, workoutId: string, notes: string) {
  const workout = await getWorkoutById(db, userId, workoutId);
  if (!workout) throw new Error("That workout no longer exists. Refresh the page.");
  await updateWorkoutUserNotes(db, userId, workoutId, notes);
}
