import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env, serverEnv } from "@/lib/env";

/**
 * Bypasses Row Level Security. Only for trusted server jobs that act for many users (the weekly email).
 * Never use it in code that runs for a request from a browser.
 */
export function createAdminClient() {
  return createClient(env.supabaseUrl, serverEnv.supabaseSecretKey(), { auth: { persistSession: false, autoRefreshToken: false } });
}
