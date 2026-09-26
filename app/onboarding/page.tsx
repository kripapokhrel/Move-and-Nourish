import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth/actions";
import { Logo } from "@/components/layout/Logo";
import { OnboardingForm } from "@/components/onboarding/OnboardingForm";
import { requireUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/db/profiles";

export default async function OnboardingPage() {
  const { supabase, userId } = await requireUser();
  const profile = await getProfile(supabase, userId);
  if (profile?.onboarding_completed) redirect("/dashboard");

  return (
    <main className="mx-auto max-w-xl space-y-8 px-4 py-10">
      <div className="flex items-center justify-between">
        <Logo />
        <form action={signOut}>
          <button type="submit" className="text-sm font-medium text-muted hover:text-ink">Log out</button>
        </form>
      </div>
      <div className="rounded-[var(--radius-card)] border border-line bg-card p-6 shadow-[0_8px_24px_-12px_rgba(184,67,95,0.15)] sm:p-8">
        <OnboardingForm initial={profile} />
      </div>
    </main>
  );
}
