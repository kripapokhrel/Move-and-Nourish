import type { SupabaseClient } from "@supabase/supabase-js";
import type { Workout, WorkoutExercise, WorkoutWithExercises } from "@/types/database";

export type NewWorkout = Pick<Workout, "name" | "focus" | "notes" | "scheduled_date" | "goal" | "fitness_level" | "duration_min">
  & { user_notes?: string | null; personalized_because?: string[] };
export type NewExercise = {
  exercise_name: string;
  muscle_group: string | null;
  sets: number;
  reps: string;
  rest_seconds: number;
  instructions: string | null;
};

/** The latest standalone workout for a date, with exercises in order. */
export async function getWorkoutForDate(db: SupabaseClient, userId: string, date: string): Promise<WorkoutWithExercises | null> {
  const { data, error } = await db
    .from("workouts")
    .select("*, workout_exercises(*)")
    .eq("user_id", userId)
    .is("plan_id", null)
    .eq("scheduled_date", date)
    .order("created_at", { ascending: false })
    .order("position", { referencedTable: "workout_exercises", ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as WorkoutWithExercises | null;
}

/** Recent workouts with their muscle groups, newest first. Used to vary what the AI suggests. */
export async function getRecentWorkouts(db: SupabaseClient, userId: string, limit = 6) {
  const { data, error } = await db
    .from("workouts")
    .select("name, focus, scheduled_date, status, workout_exercises(muscle_group)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as {
    name: string; focus: string | null; scheduled_date: string | null; status: string;
    workout_exercises: { muscle_group: string | null }[];
  }[];
}

/** Inserts a workout and its exercises. Removes the workout again if the exercises fail to save. */
export async function insertWorkout(db: SupabaseClient, userId: string, workout: NewWorkout, exercises: NewExercise[]) {
  const { data, error } = await db.from("workouts").insert({ user_id: userId, ...workout }).select("id").single();
  if (error) throw error;

  const rows = exercises.map((e, position) => ({ ...e, position, workout_id: data.id, user_id: userId }));
  const { error: exError } = await db.from("workout_exercises").insert(rows);
  if (exError) {
    await db.from("workouts").delete().eq("id", data.id);
    throw exError;
  }
  return data.id as string;
}

/** Deletes a workout that hasn't been done yet. Completed workouts are history and are never removed here. */
export async function deletePlannedWorkout(db: SupabaseClient, userId: string, workoutId: string) {
  const { error } = await db.from("workouts").delete().eq("id", workoutId).eq("user_id", userId).eq("status", "planned");
  if (error) throw error;
}

/** One exercise plus its workout, for editing. RLS already limits this to the user's own rows. */
export async function getExerciseWithWorkout(db: SupabaseClient, userId: string, exerciseId: string) {
  const { data, error } = await db
    .from("workout_exercises")
    .select("*, workouts(*, workout_exercises(*))")
    .eq("id", exerciseId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { workouts: workout, ...exercise } = data as WorkoutExercise & { workouts: WorkoutWithExercises };
  workout.workout_exercises.sort((a, b) => a.position - b.position);
  return { exercise: exercise as WorkoutExercise, workout };
}

export async function getWorkoutById(db: SupabaseClient, userId: string, workoutId: string) {
  const { data, error } = await db
    .from("workouts")
    .select("*, workout_exercises(*)")
    .eq("id", workoutId)
    .eq("user_id", userId)
    .order("position", { referencedTable: "workout_exercises", ascending: true })
    .maybeSingle();
  if (error) throw error;
  return data as WorkoutWithExercises | null;
}

export async function updateExercise(db: SupabaseClient, userId: string, exerciseId: string, fields: Partial<NewExercise>) {
  const { error } = await db.from("workout_exercises").update(fields).eq("id", exerciseId).eq("user_id", userId);
  if (error) throw error;
}

/** Inserts an exercise at a position, moving the ones at or after it down by one. */
export async function insertExerciseAt(
  db: SupabaseClient, userId: string, workout: WorkoutWithExercises, position: number, exercise: NewExercise,
) {
  const later = workout.workout_exercises.filter((e) => e.position >= position).sort((a, b) => b.position - a.position);
  for (const e of later) await updatePosition(db, userId, e.id, e.position + 1);
  const { error } = await db
    .from("workout_exercises")
    .insert({ ...exercise, position, workout_id: workout.id, user_id: userId });
  if (error) throw error;
}

async function updatePosition(db: SupabaseClient, userId: string, exerciseId: string, position: number) {
  const { error } = await db.from("workout_exercises").update({ position }).eq("id", exerciseId).eq("user_id", userId);
  if (error) throw error;
}

export async function deleteExercise(db: SupabaseClient, userId: string, exerciseId: string) {
  const { error } = await db.from("workout_exercises").delete().eq("id", exerciseId).eq("user_id", userId);
  if (error) throw error;
}

export async function updateWorkoutUserNotes(db: SupabaseClient, userId: string, workoutId: string, notes: string) {
  const { error } = await db.from("workouts").update({ user_notes: notes || null }).eq("id", workoutId).eq("user_id", userId);
  if (error) throw error;
}

export async function setExerciseCompleted(db: SupabaseClient, userId: string, exerciseId: string, completed: boolean) {
  const { error } = await db.from("workout_exercises").update({ completed }).eq("id", exerciseId).eq("user_id", userId);
  if (error) throw error;
}

/** Marks a planned workout finished or skipped. Returns false if it wasn't planned any more (e.g. a double click). */
export async function closeWorkout(db: SupabaseClient, userId: string, workoutId: string, status: "completed" | "skipped") {
  const { data, error } = await db
    .from("workouts")
    .update({ status, completed_at: status === "completed" ? new Date().toISOString() : null })
    .eq("id", workoutId)
    .eq("user_id", userId)
    .eq("status", "planned")
    .select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}

export async function insertWorkoutLog(
  db: SupabaseClient, userId: string,
  log: { workout_id: string; workout_name: string; duration_min: number; exercises_completed: number; exercises_total: number },
) {
  const { error } = await db.from("workout_logs").insert({ ...log, user_id: userId });
  if (error) throw error;
}
