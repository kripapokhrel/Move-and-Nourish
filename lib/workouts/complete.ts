import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteFeedback, deletePreference, getPreferences, upsertFeedback, upsertPreference } from "@/lib/db/personalization";
import { closeWorkout, getExerciseWithWorkout, getWorkoutById, insertWorkoutLog, setExerciseCompleted } from "@/lib/db/workouts";
import { exerciseKey } from "@/lib/personalization/events";
import { refreshSummaryQuietly, track } from "@/lib/personalization/service";
import type { FeedbackRating } from "@/types/database";
import { exerciseEvent } from "./events";
import { stageOf } from "./generator";

export async function setExerciseDone(db: SupabaseClient, userId: string, exerciseId: string, done: boolean) {
  const found = await getExerciseWithWorkout(db, userId, exerciseId);
  if (!found) throw new Error("That exercise no longer exists. Refresh the page.");
  if (found.workout.status !== "planned") throw new Error("This workout is already finished.");
  await setExerciseCompleted(db, userId, exerciseId, done);
}

/**
 * Finishing records which exercises were done or skipped. That's the main thing personalization learns from.
 * `done` is the list the user ticked, sent with the click so it can't disagree with what's on screen.
 */
export async function finishWorkout(db: SupabaseClient, userId: string, workoutId: string, durationMin: number, done: string[]) {
  const workout = await getWorkoutById(db, userId, workoutId);
  if (!workout) throw new Error("That workout no longer exists. Refresh the page.");
  if (workout.status !== "planned") return; // already finished, e.g. a double click
  const doneIds = new Set(done);
  const exercises = workout.workout_exercises;

  for (const e of exercises) if (e.completed !== doneIds.has(e.id)) await setExerciseCompleted(db, userId, e.id, doneIds.has(e.id));
  if (!(await closeWorkout(db, userId, workoutId, "completed"))) return; // already finished

  const doneCount = exercises.filter((e) => doneIds.has(e.id)).length;
  await insertWorkoutLog(db, userId, {
    workout_id: workoutId, workout_name: workout.name, duration_min: durationMin,
    exercises_completed: doneCount, exercises_total: exercises.length,
  });

  const names = exercises.map((e) => e.exercise_name);
  await track(db, userId, [
    {
      event_type: "workout_completed", entity_type: "workout", entity_id: workoutId,
      metadata: { focus: workout.focus, duration_min: durationMin, exercises_done: doneCount, exercises_total: exercises.length },
    },
    ...exercises.map((e, i) => exerciseEvent(doneIds.has(e.id) ? "exercise_completed" : "exercise_skipped", e.exercise_name, stageOf(names, i))),
  ]);
  await refreshSummaryQuietly(db, userId);
}

export async function skipWorkout(db: SupabaseClient, userId: string, workoutId: string) {
  const workout = await getWorkoutById(db, userId, workoutId);
  if (!workout) throw new Error("That workout no longer exists. Refresh the page.");
  if (!(await closeWorkout(db, userId, workoutId, "skipped"))) return;
  await track(db, userId, [{ event_type: "workout_skipped", entity_type: "workout", entity_id: workoutId, metadata: { focus: workout.focus } }]);
  await refreshSummaryQuietly(db, userId);
}

/** Optional feedback after a workout. Picking the same rating again clears it. */
export async function rateWorkout(db: SupabaseClient, userId: string, workoutId: string, rating: FeedbackRating | null) {
  const workout = await getWorkoutById(db, userId, workoutId);
  if (!workout) throw new Error("That workout no longer exists. Refresh the page.");
  if (rating) {
    await upsertFeedback(db, userId, { target_type: "workout", target_id: workoutId, rating, reasons: [], metadata: { focus: workout.focus } });
  } else {
    await deleteFeedback(db, userId, "workout", workoutId);
  }
  await refreshSummaryQuietly(db, userId);
}

export async function rateExercise(db: SupabaseClient, userId: string, exerciseId: string, rating: "too_easy" | "too_hard" | null) {
  const found = await getExerciseWithWorkout(db, userId, exerciseId);
  if (!found) throw new Error("That exercise no longer exists. Refresh the page.");
  const { exercise, workout } = found;
  const targetId = `${workout.id}:${exerciseKey(exercise.exercise_name)}`;
  if (rating) {
    await upsertFeedback(db, userId, {
      target_type: "exercise", target_id: targetId, rating, reasons: [], metadata: { exercise_name: exerciseKey(exercise.exercise_name) },
    });
  } else {
    await deleteFeedback(db, userId, "exercise", targetId);
  }
  await refreshSummaryQuietly(db, userId);
}

/** Explicit, permanent choices: "favourite" or "don't suggest again". null removes the choice. */
export async function setExercisePreference(db: SupabaseClient, userId: string, name: string, sentiment: "like" | "dislike" | null) {
  const value = exerciseKey(name);
  if (sentiment) {
    await upsertPreference(db, userId, "exercise", value, sentiment);
  } else {
    const existing = (await getPreferences(db, userId)).find((p) => p.category === "exercise" && p.value === value);
    if (existing) await deletePreference(db, userId, existing.id);
  }
  await refreshSummaryQuietly(db, userId);
}
