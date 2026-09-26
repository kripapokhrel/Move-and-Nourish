import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileInput } from "@/lib/profile/schema";
import type { Profile } from "@/types/database";

export async function getProfile(db: SupabaseClient, userId: string): Promise<Profile | null> {
  const { data, error } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function upsertProfile(db: SupabaseClient, userId: string, input: ProfileInput): Promise<Profile> {
  const { data, error } = await db
    .from("profiles")
    .upsert({ id: userId, ...input, onboarding_completed: true })
    .select("*")
    .single();
  if (error) throw error;
  return data as Profile;
}
