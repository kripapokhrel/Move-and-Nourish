"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { AboutSection, FitnessSection, NutritionSection } from "@/components/profile/ProfileSections";
import { useProfileForm } from "@/components/profile/useProfileForm";
import { saveProfile } from "@/lib/profile/actions";
import type { Profile } from "@/types/database";

const STEPS = [
  { title: "About you", Section: AboutSection, fields: ["name", "age", "sex", "height_cm", "weight_kg"] },
  {
    title: "Your training", Section: FitnessSection,
    fields: ["fitness_level", "fitness_goal", "workout_location", "workout_days_per_week"],
  },
  { title: "How you eat", Section: NutritionSection, fields: ["dietary_type", "dietary_restrictions", "preferred_cuisines"] },
];

export function OnboardingForm({ initial }: { initial?: Profile | null }) {
  const router = useRouter();
  const form = useProfileForm(initial);
  const [step, setStep] = useState(0);
  const [formError, setFormError] = useState("");
  const [pending, startTransition] = useTransition();
  const { title, Section, fields } = STEPS[step];
  const last = step === STEPS.length - 1;

  const next = () => {
    if (!form.validate(fields)) return;
    if (!last) return setStep(step + 1);

    setFormError("");
    startTransition(async () => {
      const res = await saveProfile(form.toInput());
      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
        return;
      }
      setFormError(res.error);
      if (res.fieldErrors) {
        form.setErrors(res.fieldErrors);
        const badStep = STEPS.findIndex((s) => s.fields.some((f) => res.fieldErrors?.[f]));
        if (badStep >= 0) setStep(badStep);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Step {step + 1} of {STEPS.length}</p>
        <h1 className="mt-1 text-3xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-muted">You can change any of this later in your Profile.</p>
      </div>
      <Section state={form.state} set={form.set} errors={form.errors} />
      {formError && <p className="text-sm text-danger">{formError}</p>}
      <div className="flex justify-between">
        <Button variant="secondary" type="button" onClick={() => setStep(step - 1)} disabled={step === 0 || pending}>
          Back
        </Button>
        <Button type="button" onClick={next} disabled={pending}>
          {last ? (pending ? "Saving…" : "Finish and see my plan") : "Next"}
        </Button>
      </div>
    </div>
  );
}
