import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/send";
import { env } from "@/lib/env";
import { getProgressLogs } from "@/lib/db/progress";
import { getProfile } from "@/lib/db/profiles";
import { getMealsMadeBetween, getWeeklySummaryStatus, getWorkoutLogsBetween, saveWeeklySummary } from "@/lib/db/weekly";
import { isEnabled, refreshSummary } from "@/lib/personalization/service";
import { addDays, weekStart } from "@/lib/progress/stats";
import { todayISO } from "@/lib/workouts/service";
import { renderWeeklyEmail } from "./email";
import { buildWeeklySummary } from "./summary";

/** The week an email covers: Monday to Sunday of the current week (the job runs on Sunday). */
export const currentWeekStart = () => weekStart(todayISO());

/**
 * Gathers one user's week and renders the email. Works with the user's own client (test button, RLS applies) or
 * the admin client (weekly job).
 */
export async function buildWeeklyEmail(db: SupabaseClient, userId: string, start = currentWeekStart()) {
  const end = addDays(start, 6);
  const profile = await getProfile(db, userId);
  if (!profile) throw new Error("Finish onboarding first.");
  const [workouts, meals, logs, learned] = await Promise.all([
    getWorkoutLogsBetween(db, userId, start, end),
    getMealsMadeBetween(db, userId, start, end),
    getProgressLogs(db, userId, addDays(start, -14), end),
    // Learned patterns only when personalization is on; a missing table just means none yet
    isEnabled(profile) ? refreshSummary(db, userId, profile).then((r) => r.summary.inferences).catch(() => []) : Promise.resolve([]),
  ]);
  const summary = buildWeeklySummary({
    weekStart: start,
    name: profile.name ?? null,
    goalDaysPerWeek: profile.workout_days_per_week,
    unitSystem: profile.unit_system,
    workouts: workouts.map((w) => ({ name: w.workout_name, date: todayISO(new Date(w.completed_at)), durationMin: w.duration_min })),
    mealsMade: meals.map((m) => ({ name: m.meal_name, calories: m.calories, protein: m.protein_g })),
    logs,
    inferences: learned,
  });
  return { profile, summary, email: renderWeeklyEmail(summary, env.siteUrl) };
}

/** "Send me this week's summary": to the signed-in user only, not recorded, so the Sunday email still goes out. */
export async function sendTestWeeklyEmail(db: SupabaseClient, userId: string, to: string) {
  const { email } = await buildWeeklyEmail(db, userId);
  await sendEmail({ to, ...email });
}

/**
 * The Sunday job for one user. Skips anyone who turned the email off or already got this week's, and records the
 * result so a rerun never sends twice.
 */
export async function runWeeklyEmailFor(admin: SupabaseClient, userId: string, to: string, start = currentWeekStart()) {
  if ((await getWeeklySummaryStatus(admin, userId, start)) === "sent") return "already_sent" as const;
  const { profile, summary, email } = await buildWeeklyEmail(admin, userId, start);
  const record = { week_start: start, stats: summary, ai_summary: summary.highlights.join(" "), suggested_focus: summary.suggestion };
  if (!profile.weekly_email_opt_in) {
    await saveWeeklySummary(admin, userId, { ...record, email_status: "skipped", sent_at: null });
    return "opted_out" as const;
  }
  try {
    await sendEmail({ to, ...email });
    await saveWeeklySummary(admin, userId, { ...record, email_status: "sent", sent_at: new Date().toISOString() });
    return "sent" as const;
  } catch (e) {
    await saveWeeklySummary(admin, userId, { ...record, email_status: "failed", sent_at: null });
    throw e;
  }
}
