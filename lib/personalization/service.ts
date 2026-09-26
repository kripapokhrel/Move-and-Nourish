import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  describeError, getEventsSince, isMissingSchema, getFeedbackSince, getPreferences, insertEvents, saveSummary, type BehaviorSummary,
} from "@/lib/db/personalization";
import { getProfile } from "@/lib/db/profiles";
import type { Profile, UserPreference } from "@/types/database";
import { NO_WORKOUT_PERSONALIZATION, workoutPersonalization, type WorkoutPersonalization } from "./apply";
import { MAX_EVENTS, SUMMARY_VERSION, WINDOW_DAYS } from "./config";
import type { NewEvent } from "./events";
import { inferPreferences, type Explicit, type Inference } from "./infer";
import { buildSignals } from "./signals";

export const isEnabled = (profile: Pick<Profile, "personalization_enabled"> | null) => profile?.personalization_enabled !== false;

/**
 * Records behaviour if the user has personalization on. Never throws: tracking must not break the feature
 * it's attached to (and before migration 0004 is run the tables don't exist yet).
 */
export async function track(db: SupabaseClient, userId: string, events: NewEvent[], profile?: Profile | null) {
  try {
    const p = profile === undefined ? await getProfile(db, userId) : profile;
    if (!isEnabled(p)) return;
    await insertEvents(db, userId, events);
  } catch (e) {
    if (!isMissingSchema(e)) console.error("personalization: couldn't record events", describeError(e));
  }
}

const explicitFrom = (profile: Profile | null, preferences: UserPreference[]): Explicit => ({ profile, preferences });

/** Recalculates the user's summary from raw events, feedback and explicit preferences, and stores it. */
export async function refreshSummary(db: SupabaseClient, userId: string, profile: Profile | null) {
  const now = new Date();
  const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000).toISOString();
  const [events, feedback, preferences] = await Promise.all([
    getEventsSince(db, userId, since, MAX_EVENTS),
    getFeedbackSince(db, userId, since),
    getPreferences(db, userId),
  ]);
  const explicit = explicitFrom(profile, preferences);
  const signals = buildSignals(events, feedback, now);
  const inferences = inferPreferences(signals, explicit);
  const summary: Omit<BehaviorSummary, "user_id"> = {
    signals, inferences, event_count: signals.event_count, version: SUMMARY_VERSION, computed_at: signals.computed_at,
  };
  await saveSummary(db, userId, summary);
  return { summary, explicit };
}

/** Recalculate without failing the caller. Used after the user finishes or rates something. */
export async function refreshSummaryQuietly(db: SupabaseClient, userId: string) {
  try {
    const profile = await getProfile(db, userId);
    if (isEnabled(profile)) await refreshSummary(db, userId, profile);
  } catch (e) {
    if (!isMissingSchema(e)) console.error("personalization: couldn't refresh summary", describeError(e));
  }
}

/**
 * Nudges for the workout generator. Explicit likes and "don't suggest again" always count; learned patterns
 * only when personalization is on. Falls back to no personalization on any error.
 */
export async function loadWorkoutPersonalization(db: SupabaseClient, userId: string, profile: Profile): Promise<WorkoutPersonalization> {
  try {
    if (!isEnabled(profile)) return workoutPersonalization([], explicitFrom(profile, await getPreferences(db, userId)), 0);
    const { summary, explicit } = await refreshSummary(db, userId, profile);
    return workoutPersonalization(summary.inferences, explicit, summary.signals.workouts.completed.n);
  } catch (e) {
    if (!isMissingSchema(e)) console.error("personalization: couldn't load, generating without it", describeError(e));
    return NO_WORKOUT_PERSONALIZATION;
  }
}

/**
 * Learned preferences plus explicit ones, for recommenders. Learned ones are left out when personalization is
 * off; explicit ones (profile dislikes, favourites) always apply. Never throws.
 */
export async function loadPreferences(db: SupabaseClient, userId: string, profile: Profile | null): Promise<{ inferences: Inference[]; explicit: Explicit }> {
  try {
    if (!isEnabled(profile)) return { inferences: [], explicit: explicitFrom(profile, await getPreferences(db, userId)) };
    const { summary, explicit } = await refreshSummary(db, userId, profile);
    return { inferences: summary.inferences, explicit };
  } catch (e) {
    if (!isMissingSchema(e)) console.error("personalization: couldn't load preferences", describeError(e));
    return { inferences: [], explicit: explicitFrom(profile, []) };
  }
}
