"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { deleteProgressLog, upsertProgressLog } from "@/lib/db/progress";
import { getProfile } from "@/lib/db/profiles";
import { profileInputSchema } from "@/lib/profile/schema";
import { saveProfileAndRecalculate } from "@/lib/profile/service";
import { todayISO } from "@/lib/workouts/service";
import { LOG_WINDOW_DAYS, progressInputSchema } from "./schema";
import { addDays } from "./stats";

export type ProgressActionResult = { ok: true } | { ok: false; error: string };

function inWindow(date: string) {
  const today = todayISO();
  if (date > today) return "You can't log a day that hasn't happened yet.";
  if (date < addDays(today, -LOG_WINDOW_DAYS)) return `You can log up to ${LOG_WINDOW_DAYS} days back.`;
  return null;
}

async function run(label: string, fn: (u: Awaited<ReturnType<typeof requireUser>>) => Promise<unknown>): Promise<ProgressActionResult> {
  const user = await requireUser();
  try {
    await fn(user);
  } catch (e) {
    console.error(`${label} failed`, e);
    return { ok: false, error: (e as { message?: string })?.message || "Something went wrong. Try again." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveProgressAction(raw: unknown): Promise<ProgressActionResult> {
  const parsed = progressInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your entries." };
  const { log_date, weight_kg, waist_cm, water_ml, notes } = parsed.data;
  const dateError = inWindow(log_date);
  if (dateError) return { ok: false, error: dateError };
  if (weight_kg === null && waist_cm === null && !water_ml && !notes) {
    return { ok: false, error: "Add at least one thing to log." };
  }
  return run("saveProgress", ({ supabase, userId }) => upsertProgressLog(supabase, userId, {
    log_date, weight_kg, water_ml,
    measurements: waist_cm === null ? null : { waist_cm },
    notes: notes || null,
  }));
}

export async function deleteProgressAction(date: unknown): Promise<ProgressActionResult> {
  const parsed = z.iso.date().safeParse(date);
  if (!parsed.success) return { ok: false, error: "Couldn't find that day." };
  return run("deleteProgress", ({ supabase, userId }) => deleteProgressLog(supabase, userId, parsed.data));
}

/** Copies a logged weight into the profile, so calorie and protein targets are recalculated. */
export async function applyWeightToTargetsAction(weightKg: unknown): Promise<ProgressActionResult> {
  const parsed = z.number().min(30).max(350).safeParse(weightKg);
  if (!parsed.success) return { ok: false, error: "That weight looks off." };
  return run("useWeightForTargets", async ({ supabase, userId }) => {
    const profile = await getProfile(supabase, userId);
    if (!profile) throw new Error("Finish onboarding first.");
    const input = profileInputSchema.safeParse({ ...profile, weight_kg: parsed.data });
    if (!input.success) throw new Error("Your profile needs updating first. Open Profile, check it and save.");
    await saveProfileAndRecalculate(supabase, userId, input.data);
  });
}
