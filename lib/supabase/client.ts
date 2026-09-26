"use client";
import { createBrowserClient } from "@supabase/ssr";

// Browser client, only needed for client-side realtime/subscriptions later. Most data access goes through server code.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
  );
}
