import { PageHeader } from "@/components/ui/PageHeader";
import { TodayWorkout, type SwapOption, type WorkoutFeedbackState } from "@/components/workouts/TodayWorkout";
import { requireUser } from "@/lib/auth/session";
import { describeError, getFeedbackFor, getPreferences, isMissingSchema } from "@/lib/db/personalization";
import { getProfile } from "@/lib/db/profiles";
import { getWorkoutForDate } from "@/lib/db/workouts";
import { exerciseKey } from "@/lib/personalization/events";
import { stageOf, swapOptions } from "@/lib/workouts/generator";
import { todayISO } from "@/lib/workouts/service";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkoutWithExercises } from "@/types/database";

/** Ratings and favourites already given for a finished workout, so the chips show what was picked. */
async function loadFeedback(db: SupabaseClient, userId: string, workout: WorkoutWithExercises): Promise<WorkoutFeedbackState> {
  const empty: WorkoutFeedbackState = { workout: null, exercises: {} };
  if (workout.status !== "completed") return empty;
  const keyOf = (name: string) => `${workout.id}:${exerciseKey(name)}`;
  try {
    const [workoutFeedback, exerciseFeedback, preferences] = await Promise.all([
      getFeedbackFor(db, userId, "workout", [workout.id]),
      getFeedbackFor(db, userId, "exercise", workout.workout_exercises.map((e) => keyOf(e.exercise_name))),
      getPreferences(db, userId),
    ]);
    const ratings = new Map(exerciseFeedback.map((f) => [f.target_id, f.rating]));
    const prefs = new Map(preferences.filter((p) => p.category === "exercise").map((p) => [p.value, p.sentiment]));
    return {
      workout: workoutFeedback[0]?.rating ?? null,
      exercises: Object.fromEntries(workout.workout_exercises.map((e) => {
        const rating = ratings.get(keyOf(e.exercise_name));
        return [e.id, {
          rating: rating === "too_easy" || rating === "too_hard" ? rating : null,
          preference: prefs.get(exerciseKey(e.exercise_name)) ?? null,
        }];
      })),
    };
  } catch (e) {
    // Tables from migration 0004 missing: show the chips empty, saving explains what to run
    if (!isMissingSchema(e)) console.error("couldn't load workout feedback", describeError(e));
    return empty;
  }
}

export default async function WorkoutsPage() {
  const { supabase, userId } = await requireUser();
  const [workout, profile] = await Promise.all([getWorkoutForDate(supabase, userId, todayISO()), getProfile(supabase, userId)]);

  // Suggestions for each exercise's Swap menu, worked out here because they depend on the profile
  const options: Record<string, SwapOption[]> = {};
  if (workout && profile && workout.status === "planned") {
    const names = workout.workout_exercises.map((e) => e.exercise_name);
    workout.workout_exercises.forEach((e, i) => {
      options[e.id] = swapOptions(profile, e.exercise_name, stageOf(names, i), names)
        .map(({ name, muscle, image }) => ({ name, muscle, image: image ?? null }));
    });
  }
  const feedback = workout ? await loadFeedback(supabase, userId, workout) : { workout: null, exercises: {} };

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Your movement plan" title="Today's workout">Warm up, move, cool down. Swap anything that doesn&apos;t feel right.</PageHeader>
      {/* key resets the picker/card state whenever a new workout arrives or it's finished */}
      <TodayWorkout
        key={workout ? `${workout.id}:${workout.status}` : "none"}
        workout={workout}
        swapOptions={options}
        feedback={feedback}
      />
    </div>
  );
}
