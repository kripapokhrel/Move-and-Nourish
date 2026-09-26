"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { deletePersonalizationData, deletePreference, setPersonalizationEnabled } from "@/lib/db/personalization";
import { refreshSummaryQuietly } from "./service";

export type PersonalizationActionResult = { ok: true } | { ok: false; error: string };

async function run(label: string, fn: (u: Awaited<ReturnType<typeof requireUser>>) => Promise<unknown>): Promise<PersonalizationActionResult> {
  const user = await requireUser();
  try {
    await fn(user);
  } catch (e) {
    console.error(`${label} failed`, e);
    const message = (e as { message?: string })?.message ?? "";
    if (/user_events|user_preferences|recommendation_feedback|user_behavior_summary|personalization_enabled/.test(message)) {
      return { ok: false, error: "The database needs an update: run supabase/migrations/0004_personalization.sql in the Supabase SQL editor." };
    }
    return { ok: false, error: message || "Something went wrong. Try again." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setPersonalizationAction(enabled: unknown): Promise<PersonalizationActionResult> {
  const parsed = z.boolean().safeParse(enabled);
  if (!parsed.success) return { ok: false, error: "Something went wrong. Try again." };
  return run("setPersonalization", ({ supabase, userId }) => setPersonalizationEnabled(supabase, userId, parsed.data));
}

export async function deletePersonalizationAction(): Promise<PersonalizationActionResult> {
  return run("deletePersonalization", ({ supabase, userId }) => deletePersonalizationData(supabase, userId));
}

export async function removePreferenceAction(preferenceId: unknown): Promise<PersonalizationActionResult> {
  const parsed = z.uuid().safeParse(preferenceId);
  if (!parsed.success) return { ok: false, error: "Couldn't find that preference." };
  return run("removePreference", async ({ supabase, userId }) => {
    await deletePreference(supabase, userId, parsed.data);
    await refreshSummaryQuietly(supabase, userId);
  });
}
