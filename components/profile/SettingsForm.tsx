"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AboutSection, FitnessSection, NutritionSection } from "./ProfileSections";
import { useProfileForm } from "./useProfileForm";
import { saveProfile } from "@/lib/profile/actions";
import type { Profile } from "@/types/database";

export function SettingsForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const form = useProfileForm(profile);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    setStatus(null);
    if (!form.validate()) return setStatus({ kind: "error", text: "Some fields need fixing." });
    startTransition(async () => {
      const res = await saveProfile(form.toInput());
      if (res.ok) {
        setStatus({ kind: "ok", text: "Saved. Your targets were recalculated." });
        router.refresh();
      } else {
        if (res.fieldErrors) form.setErrors(res.fieldErrors);
        setStatus({ kind: "error", text: res.error });
      }
    });
  };

  const sectionProps = { state: form.state, set: form.set, errors: form.errors };
  return (
    <div className="space-y-4">
      <Card title="About you"><AboutSection {...sectionProps} /></Card>
      <Card title="Training"><FitnessSection {...sectionProps} /></Card>
      <Card title="Nutrition"><NutritionSection {...sectionProps} /></Card>
      <Card title="Emails">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5" checked={form.state.weekly_email_opt_in}
            onChange={(e) => form.set("weekly_email_opt_in", e.target.checked)} />
          <span>
            Send me a weekly summary every Sunday
            <span className="block text-xs text-muted">
              Your workouts, meals and weight trend for the week, what we&apos;ve learned about what you like, and one idea for next week.
            </span>
          </span>
        </label>
      </Card>
      <div className="sticky bottom-0 flex items-center gap-3 border-t border-line bg-paper py-3">
        <Button onClick={save} disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
        {status && <p className={`text-sm ${status.kind === "ok" ? "text-brand" : "text-danger"}`}>{status.text}</p>}
      </div>
    </div>
  );
}
