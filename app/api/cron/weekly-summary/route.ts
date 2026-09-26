// The Sunday email job. A scheduler (Vercel Cron, GitHub Actions, any cron) calls
//   GET /api/cron/weekly-summary   with header   Authorization: Bearer <CRON_SECRET>
// It emails everyone who has the weekly email on, once per week; running it twice never sends twice.
import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { runWeeklyEmailFor } from "@/lib/weekly/service";

// Sending can take a while for many users
export const maxDuration = 300;

function authorized(request: Request) {
  const expected = Buffer.from(`Bearer ${serverEnv.cronSecret()}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) return new Response("CRON_SECRET isn't set on the server", { status: 503 });
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  const admin = createAdminClient();

  // Emails live in Supabase Auth, profiles in our table
  const emails = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    data.users.forEach((u) => u.email && emails.set(u.id, u.email));
    if (data.users.length < 1000) break;
  }
  const { data: profiles, error } = await admin.from("profiles").select("id").eq("onboarding_completed", true);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const results = { sent: 0, already_sent: 0, opted_out: 0, no_email: 0, failed: 0 };
  for (const { id } of profiles ?? []) {
    const to = emails.get(id);
    if (!to) { results.no_email++; continue; }
    try {
      results[await runWeeklyEmailFor(admin, id, to)]++;
    } catch (e) {
      results.failed++;
      console.error("weekly email failed for", id, (e as Error)?.message);
    }
  }
  return Response.json(results);
}
