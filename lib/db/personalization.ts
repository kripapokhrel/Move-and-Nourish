import type { SupabaseClient } from "@supabase/supabase-js";
import type { NewEvent } from "@/lib/personalization/events";
import type { Inference } from "@/lib/personalization/infer";
import type { Signals } from "@/lib/personalization/signals";
import type { PreferenceCategory, RecommendationFeedback, UserEvent, UserPreference } from "@/types/database";

export type BehaviorSummary = {
  user_id: string;
  signals: Signals;
  inferences: Inference[];
  event_count: number;
  version: number;
  computed_at: string;
};

export async function insertEvents(db: SupabaseClient, userId: string, events: NewEvent[]) {
  if (!events.length) return;
  const { error } = await db.from("user_events").insert(events.map((e) => ({ ...e, user_id: userId })));
  if (error) throw error;
}

export async function getEventsSince(db: SupabaseClient, userId: string, since: string, limit: number) {
  const { data, error } = await db
    .from("user_events")
    .select("*")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as UserEvent[];
}

export async function getFeedbackSince(db: SupabaseClient, userId: string, since: string) {
  const { data, error } = await db
    .from("recommendation_feedback")
    .select("*")
    .eq("user_id", userId)
    .gte("updated_at", since)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as RecommendationFeedback[];
}

export async function getFeedbackFor(db: SupabaseClient, userId: string, targetType: RecommendationFeedback["target_type"], targetIds: string[]) {
  if (!targetIds.length) return [];
  const { data, error } = await db
    .from("recommendation_feedback")
    .select("*")
    .eq("user_id", userId)
    .eq("target_type", targetType)
    .in("target_id", targetIds);
  if (error) throw error;
  return (data ?? []) as RecommendationFeedback[];
}

export async function upsertFeedback(
  db: SupabaseClient, userId: string,
  row: Pick<RecommendationFeedback, "target_type" | "target_id" | "rating" | "reasons" | "metadata">,
) {
  const { error } = await db
    .from("recommendation_feedback")
    .upsert({ ...row, user_id: userId }, { onConflict: "user_id,target_type,target_id" });
  if (error) throw error;
}

export async function deleteFeedback(db: SupabaseClient, userId: string, targetType: RecommendationFeedback["target_type"], targetId: string) {
  const { error } = await db
    .from("recommendation_feedback")
    .delete()
    .eq("user_id", userId)
    .eq("target_type", targetType)
    .eq("target_id", targetId);
  if (error) throw error;
}

export async function getPreferences(db: SupabaseClient, userId: string) {
  const { data, error } = await db.from("user_preferences").select("*").eq("user_id", userId).order("created_at");
  if (error) throw error;
  return (data ?? []) as UserPreference[];
}

export async function upsertPreference(
  db: SupabaseClient, userId: string, category: PreferenceCategory, value: string, sentiment: UserPreference["sentiment"],
) {
  const { error } = await db
    .from("user_preferences")
    .upsert({ user_id: userId, category, value, sentiment }, { onConflict: "user_id,category,value" });
  if (error) throw error;
}

export async function deletePreference(db: SupabaseClient, userId: string, id: string) {
  const { error } = await db.from("user_preferences").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function getSummary(db: SupabaseClient, userId: string) {
  const { data, error } = await db.from("user_behavior_summary").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data as BehaviorSummary | null;
}

export async function saveSummary(db: SupabaseClient, userId: string, summary: Omit<BehaviorSummary, "user_id">) {
  const { error } = await db.from("user_behavior_summary").upsert({ user_id: userId, ...summary });
  if (error) throw error;
}

export async function setPersonalizationEnabled(db: SupabaseClient, userId: string, enabled: boolean) {
  const { error } = await db.from("profiles").update({ personalization_enabled: enabled }).eq("id", userId);
  if (error) throw error;
}

/** Deletes everything personalization has recorded or learned. Workouts, meals and the profile stay. */
export async function deletePersonalizationData(db: SupabaseClient, userId: string) {
  for (const table of ["user_events", "recommendation_feedback", "user_preferences", "user_behavior_summary"]) {
    const { error } = await db.from(table).delete().eq("user_id", userId);
    if (error) throw error;
  }
}

/**
 * True when the personalization tables or columns don't exist yet (migration 0004 not run).
 * That's an expected setup state, not a bug, so callers fall back quietly instead of logging an error.
 */
export function isMissingSchema(e: unknown) {
  const code = (e as { code?: string })?.code;
  return code === "PGRST205" || code === "PGRST204" || code === "42P01" || code === "42703";
}

/** Supabase errors print as {} in the console; this keeps the useful parts. */
export const describeError = (e: unknown) => {
  const { code, message, details, hint } = (e ?? {}) as Record<string, unknown>;
  return message ? { code, message, details, hint } : e;
};
