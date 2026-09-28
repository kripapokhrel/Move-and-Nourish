"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { profileInputSchema } from "./schema";
import { saveProfileAndRecalculate } from "./service";
import { sendTestWeeklyEmail } from "@/lib/weekly/service";

export type SaveProfileResult = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Emails this week's summary to the signed-in user right now, to preview what arrives on Sunday. */
export async function sendTestWeeklyEmailAction(): Promise<{ ok: true; to: string } | { ok: false; error: string }> {
  const { supabase, userId, email } = await requireUser();
  if (!email) return { ok: false, error: "Your account has no email address." };
  try {
    await sendTestWeeklyEmail(supabase, userId, email);
    return { ok: true, to: email };
  } catch (e) {
    const message = (e as Error)?.message ?? "";
    console.error("sendTestWeeklyEmail failed", message);
    if (/Missing env var GMAIL/.test(message)) {
      return {
        ok: false,
        error: "Email isn't set up yet. Add GMAIL_USER and GMAIL_APP_PASSWORD to .env.local and restart the app (on your computer), or to the project's Environment Variables in Vercel and redeploy (live site).",
      };
    }
    if (/Invalid login|Username and Password not accepted/i.test(message)) {
      return { ok: false, error: "Gmail didn't accept the login. Check GMAIL_USER and that GMAIL_APP_PASSWORD is an app password, not your normal one." };
    }
    return { ok: false, error: "Couldn't send the email. Try again in a minute." };
  }
}

export async function saveProfile(raw: unknown): Promise<SaveProfileResult> {
  const parsed = profileInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, error: "Some fields need fixing.", fieldErrors };
  }

  const { supabase, userId } = await requireUser();
  let accountMissing = false;
  try {
    await saveProfileAndRecalculate(supabase, userId, parsed.data);
  } catch (e) {
    // The login cookie can outlive a deleted account (it's checked without asking Supabase). Saving then fails on
    // the link to auth.users; sign out so the person can create a fresh account instead of being stuck.
    if ((e as { code?: string })?.code === "23503" && /profiles_id_fkey/.test((e as { message?: string })?.message ?? "")) {
      accountMissing = true;
    } else {
      console.error("saveProfile failed", e);
      const message = (e as { message?: string })?.message;
      return { ok: false, error: message ?? "Couldn't save your profile. Try again." };
    }
  }
  if (accountMissing) {
    // Local only: Supabase no longer knows this account, so just clear the cookies
    await supabase.auth.signOut({ scope: "local" });
    redirect("/signup?reason=account-missing");
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
