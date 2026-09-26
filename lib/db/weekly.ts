import type { SupabaseClient } from "@supabase/supabase-js";

/** Start of `from` to the end of `to`, in server-local time like the rest of the app's dates. */
function range(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(new Date(`${to}T00:00:00`).getTime() + 86_400_000);
  return [start.toISOString(), end.toISOString()] as const;
}

/** Workouts finished between two dates (inclusive), from the log that survives regenerating workouts. */
export async function getWorkoutLogsBetween(db: SupabaseClient, userId: string, from: string, to: string) {
  const { data, error } = await db
    .from("workout_logs")
    .select("workout_name, completed_at, duration_min")
    .eq("user_id", userId)
    .gte("completed_at", range(from, to)[0])
    .lt("completed_at", range(from, to)[1]);
  if (error) throw error;
  return (data ?? []) as { workout_name: string; completed_at: string; duration_min: number | null }[];
}

/** Meals the user said they made between two dates (inclusive), newest first. */
export async function getMealsMadeBetween(db: SupabaseClient, userId: string, from: string, to: string) {
  const { data, error } = await db
    .from("meal_history")
    .select("meal_name, calories, protein_g, made_at")
    .eq("user_id", userId)
    .gte("made_at", range(from, to)[0])
    .lt("made_at", range(from, to)[1])
    .order("made_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as { meal_name: string; calories: number | null; protein_g: number | null; made_at: string }[];
}

export async function getWeeklySummaryStatus(db: SupabaseClient, userId: string, weekStart: string) {
  const { data, error } = await db
    .from("weekly_summaries")
    .select("email_status")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (error) throw error;
  return (data?.email_status as string | undefined) ?? null;
}

/** Written by the weekly job with the admin client (users can only read their own rows). */
export async function saveWeeklySummary(
  db: SupabaseClient, userId: string,
  row: { week_start: string; stats: unknown; ai_summary: string; suggested_focus: string; email_status: "sent" | "failed" | "skipped"; sent_at: string | null },
) {
  const { error } = await db.from("weekly_summaries").upsert({ user_id: userId, ...row }, { onConflict: "user_id,week_start" });
  if (error) throw error;
}
