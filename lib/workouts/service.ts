import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getProfile } from "@/lib/db/profiles";
import { deletePlannedWorkout, getRecentWorkouts, getWorkoutForDate, insertWorkout } from "@/lib/db/workouts";
import { loadWorkoutPersonalization, track } from "@/lib/personalization/service";
import { generateWorkoutPlan } from "./generator";
import type { WorkoutFocus } from "./options";

/** Today's date as YYYY-MM-DD in the server's timezone. */
export const todayISO = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Generates today's workout for the chosen focus and replaces any unfinished one from earlier today.
 * The old workout is only removed after the new one is saved, so a failed generation never leaves the user with nothing.
 */
export async function generateTodayWorkout(db: SupabaseClient, userId: string, focus: WorkoutFocus) {
  const today = todayISO();
  const [profile, current, recent] = await Promise.all([
    getProfile(db, userId),
    getWorkoutForDate(db, userId, today),
    getRecentWorkouts(db, userId),
  ]);
  if (!profile) throw new Error("Finish onboarding before generating a workout.");

  const replacing = current?.status === "planned" ? current : null;
  // When refreshing the same focus, avoid the exercises the user just passed on
  const rejected = replacing && replacing.focus === focus ? replacing.workout_exercises.map((e) => e.exercise_name) : undefined;
  const personalization = await loadWorkoutPersonalization(db, userId, profile);

  const generated = generateWorkoutPlan({
    profile,
    focus,
    today,
    rejected,
    personalization,
    recent: recent
      .filter((w) => w.status === "completed" || w.scheduled_date !== today)
      .map((w) => ({
        date: w.scheduled_date,
        muscleGroups: w.workout_exercises.map((e) => e.muscle_group ?? "").filter(Boolean),
      })),
  });

  const id = await insertWorkout(
    db,
    userId,
    {
      name: generated.name,
      notes: generated.notes,
      focus,
      scheduled_date: today,
      goal: profile.fitness_goal,
      fitness_level: profile.fitness_level,
      duration_min: profile.session_duration_min,
      // The user's own notes for the day survive a refresh
      ...(current?.user_notes ? { user_notes: current.user_notes } : {}),
      // Only sent when there is something to say, so generation works before migration 0004 is run
      ...(generated.personalized_because.length ? { personalized_because: generated.personalized_because } : {}),
    },
    generated.exercises,
  );
  if (replacing) await deletePlannedWorkout(db, userId, replacing.id);
  await track(db, userId, [{
    event_type: replacing ? "workout_refreshed" : "workout_generated", entity_type: "workout", entity_id: id, metadata: { focus },
  }], profile);
  return id;
}
