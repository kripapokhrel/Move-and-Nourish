import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { NutritionTargets } from "@/components/nutrition/NutritionTargets";
import { PersonalizationSettings } from "@/components/profile/PersonalizationSettings";
import { SettingsForm } from "@/components/profile/SettingsForm";
import { requireUser } from "@/lib/auth/session";
import { getNutritionProfile } from "@/lib/db/nutrition";
import { describeError, getPreferences, isMissingSchema } from "@/lib/db/personalization";
import { getProfile } from "@/lib/db/profiles";
import { isEnabled } from "@/lib/personalization/service";
import type { SupabaseClient } from "@supabase/supabase-js";

async function loadPersonalization(db: SupabaseClient, userId: string) {
  try {
    const preferences = await getPreferences(db, userId);
    return { preferences, needsMigration: false };
  } catch (e) {
    if (!isMissingSchema(e)) console.error("couldn't load personalization", describeError(e));
    return { preferences: [], needsMigration: true };
  }
}

export default async function ProfilePage() {
  const { supabase, userId } = await requireUser();
  const [profile, nutrition, personalization] = await Promise.all([
    getProfile(supabase, userId),
    getNutritionProfile(supabase, userId),
    loadPersonalization(supabase, userId),
  ]);
  if (!profile) redirect("/onboarding");
  const { preferences, needsMigration } = personalization;
  const enabled = isEnabled(profile);

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="About you" title="Profile">Change anything here and your targets and plans update.</PageHeader>
      {nutrition && <Card title="Your current targets"><NutritionTargets n={nutrition} detailed /></Card>}
      {/* key forces a fresh form after save + refresh */}
      <SettingsForm key={profile.updated_at} profile={profile} />
      <PersonalizationSettings
        enabled={enabled}
        preferences={preferences}
        needsMigration={needsMigration || profile.personalization_enabled === undefined}
      />
    </div>
  );
}
