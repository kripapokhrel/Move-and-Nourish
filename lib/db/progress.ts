import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProgressLog } from "@/lib/progress/stats";

export type ProgressLogRow = ProgressLog & { id: string };
// Steps aren't asked any more; leaving them out keeps any old values untouched
export type NewProgressLog = Omit<ProgressLog, "notes" | "steps"> & { notes?: string | null };

const COLUMNS = "id, log_date, weight_kg, steps, water_ml, measurements, notes";

export async function getProgressLogs(db: SupabaseClient, userId: string, from: string, to: string) {
  const { data, error } = await db
    .from("progress_logs")
    .select(COLUMNS)
    .eq("user_id", userId)
    .gte("log_date", from)
    .lte("log_date", to)
    .order("log_date", { ascending: true });
  if (error) throw error;
  // numeric columns come back as strings
  return (data ?? []).map((r) => ({ ...r, weight_kg: r.weight_kg === null ? null : Number(r.weight_kg) })) as ProgressLogRow[];
}

/** One row per day: logging again the same day updates it. */
export async function upsertProgressLog(db: SupabaseClient, userId: string, log: NewProgressLog) {
  const { error } = await db.from("progress_logs").upsert({ ...log, user_id: userId }, { onConflict: "user_id,log_date" });
  if (error) throw error;
}

export async function deleteProgressLog(db: SupabaseClient, userId: string, logDate: string) {
  const { error } = await db.from("progress_logs").delete().eq("user_id", userId).eq("log_date", logDate);
  if (error) throw error;
}

/** Dates (YYYY-MM-DD, server time) of workouts finished since a date. */
export async function getCompletedWorkoutDates(db: SupabaseClient, userId: string, since: string) {
  const { data, error } = await db
    .from("workouts")
    .select("completed_at, scheduled_date")
    .eq("user_id", userId)
    .eq("status", "completed")
    .gte("scheduled_date", since);
  if (error) throw error;
  return (data ?? []).map((w) => (w.scheduled_date ?? w.completed_at?.slice(0, 10)) as string).filter(Boolean);
}

/** Meals the user said they made today, for the calories and protein so far. */
export async function getMealsMadeOn(db: SupabaseClient, userId: string, date: string) {
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(start.getTime() + 86_400_000);
  const { data, error } = await db
    .from("meal_history")
    .select("id, meal_name, calories, protein_g")
    .eq("user_id", userId)
    .gte("made_at", start.toISOString())
    .lt("made_at", end.toISOString());
  if (error) throw error;
  return (data ?? []) as { id: string; meal_name: string; calories: number | null; protein_g: number | null }[];
}
