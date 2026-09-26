import { redirect } from "next/navigation";
import { AppNav } from "@/components/layout/AppNav";
import { requireUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/db/profiles";

// Every page in (app) requires login and a finished onboarding
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, userId, email } = await requireUser();
  const profile = await getProfile(supabase, userId);
  if (!profile?.onboarding_completed) redirect("/onboarding");

  return (
    <>
      <AppNav name={profile.name ?? null} email={email} level={profile.fitness_level ?? null} />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-4 sm:px-6">{children}</main>
    </>
  );
}
