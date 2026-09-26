"use client";
// The three groups of profile questions. Onboarding shows one per step, Settings shows all three.
import { Field, TextInput } from "@/components/ui/Field";
import { MultiOptionGroup, OptionGroup } from "@/components/ui/OptionGroup";
import {
  CUISINES, DIETARY_TYPE, FITNESS_GOAL, FITNESS_LEVEL, RESTRICTIONS, SEX, WORKOUT_DAYS, WORKOUT_LOCATION,
  type Restriction,
} from "@/lib/profile/options";
import type { ProfileFormState, SetField } from "@/lib/profile/form";
import { bmiCategory, calcBMI } from "@/lib/nutrition/calculations";
import { cmToFtIn, ftInToCm, kgToLb, lbToKg } from "@/lib/profile/units";

type Props = { state: ProfileFormState; set: SetField; errors: Record<string, string> };

export function AboutSection({ state, set, errors }: Props) {
  const imperial = state.unit_system === "imperial";

  // Convert the typed values when switching units so nothing is lost
  const switchUnits = (next: "metric" | "imperial") => {
    if (next === state.unit_system) return;
    if (next === "imperial") {
      if (state.height_cm) {
        const { ft, inches } = cmToFtIn(Number(state.height_cm));
        set("height_ft", String(ft)); set("height_in", String(inches));
      }
      if (state.weight) set("weight", String(kgToLb(Number(state.weight))));
    } else {
      if (state.height_ft) set("height_cm", String(ftInToCm(Number(state.height_ft), Number(state.height_in || 0))));
      if (state.weight) set("weight", String(lbToKg(Number(state.weight))));
    }
    set("unit_system", next);
  };

  return (
    <div className="space-y-5">
      <Field label="Name" error={errors.name}>
        <TextInput autoComplete="given-name" value={state.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label="Units">
        <OptionGroup name="Units" value={state.unit_system} onChange={(v) => switchUnits(v as "metric" | "imperial")}
          options={[{ value: "metric", label: "cm / kg" }, { value: "imperial", label: "ft / lb" }]} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Age" error={errors.age}>
          <TextInput type="number" inputMode="numeric" value={state.age} onChange={(e) => set("age", e.target.value)} />
        </Field>
        <Field label={`Weight (${imperial ? "lb" : "kg"})`} error={errors.weight_kg}>
          <TextInput type="number" inputMode="decimal" step="0.1" value={state.weight}
            onChange={(e) => set("weight", e.target.value)} />
        </Field>
      </div>
      <Field label="Height" error={errors.height_cm}>
        {imperial ? (
          <div className="grid grid-cols-2 gap-4">
            <TextInput type="number" placeholder="ft" aria-label="Feet" value={state.height_ft}
              onChange={(e) => set("height_ft", e.target.value)} />
            <TextInput type="number" placeholder="in" aria-label="Inches" value={state.height_in}
              onChange={(e) => set("height_in", e.target.value)} />
          </div>
        ) : (
          <TextInput type="number" placeholder="cm" value={state.height_cm} onChange={(e) => set("height_cm", e.target.value)} />
        )}
      </Field>
      <BmiPreview state={state} />
      <Field label="Sex" hint="Used for the calorie formula" error={errors.sex}>
        <OptionGroup name="Sex" options={SEX} value={state.sex} onChange={(v) => set("sex", v)} />
      </Field>
    </div>
  );
}

/** BMI worked out from height and weight as they're typed. Nothing to fill in. */
function BmiPreview({ state }: { state: ProfileFormState }) {
  const imperial = state.unit_system === "imperial";
  const heightCm = imperial
    ? state.height_ft ? ftInToCm(Number(state.height_ft), Number(state.height_in || 0)) : 0
    : Number(state.height_cm);
  const weightKg = imperial ? lbToKg(Number(state.weight)) : Number(state.weight);
  const valid = heightCm >= 100 && heightCm <= 250 && weightKg >= 30 && weightKg <= 350;
  const bmi = valid ? Math.round(calcBMI(weightKg, heightCm) * 10) / 10 : 0;
  return (
    <div className="rounded-xl bg-brand-soft/60 p-3 text-sm">
      <p className="font-medium">BMI {valid ? <span>{bmi} · {bmiCategory(bmi).toLowerCase()}</span> : <span className="font-normal text-muted">(worked out from your height and weight)</span>}</p>
      <p className="text-xs text-muted">
        Body mass index is weight compared with height. It&apos;s a rough guide that doesn&apos;t tell muscle from fat, so it&apos;s
        just for your information.
      </p>
    </div>
  );
}

export function FitnessSection({ state, set, errors }: Props) {
  return (
    <div className="space-y-5">
      <Field label="Fitness level" error={errors.fitness_level}>
        <OptionGroup name="Fitness level" options={FITNESS_LEVEL} value={state.fitness_level}
          onChange={(v) => set("fitness_level", v)} />
      </Field>
      <Field label="Goal" error={errors.fitness_goal}>
        <OptionGroup name="Goal" options={FITNESS_GOAL} value={state.fitness_goal} onChange={(v) => set("fitness_goal", v)} />
      </Field>
      <Field label="Where do you work out?" hint="Gym or both: machines, dumbbells and bands. Home: bodyweight exercises." error={errors.workout_location}>
        <OptionGroup name="Location" options={WORKOUT_LOCATION} value={state.workout_location}
          onChange={(v) => set("workout_location", v)} />
      </Field>
      <Field label="Days per week" error={errors.workout_days_per_week}>
        <OptionGroup name="Days per week" options={WORKOUT_DAYS} value={state.workout_days_per_week}
          onChange={(v) => set("workout_days_per_week", v)} />
      </Field>
    </div>
  );
}

export function NutritionSection({ state, set, errors }: Props) {
  return (
    <div className="space-y-5">
      <Field label="Diet" error={errors.dietary_type}>
        <OptionGroup name="Diet" options={DIETARY_TYPE} value={state.dietary_type} onChange={(v) => set("dietary_type", v)} />
      </Field>
      <Field label="Restrictions" description="Allergies and anything you avoid. Meal ideas never include these." error={errors.dietary_restrictions}>
        <MultiOptionGroup name="Restrictions" options={RESTRICTIONS} value={state.dietary_restrictions}
          onChange={(v) => set("dietary_restrictions", v as Restriction[])} />
        <div className="pt-1">
          <TextInput aria-label="Other restrictions" placeholder="Anything else? e.g. mushrooms, coconut, low sodium"
            value={state.restrictions_other} onChange={(e) => set("restrictions_other", e.target.value)} />
          <p className="mt-1 text-xs text-muted">Separate with commas. We leave out recipes whose ingredients mention these.</p>
        </div>
      </Field>
      <Field label="Cuisines you like" description="Meal ideas lean toward these." error={errors.preferred_cuisines}>
        <CuisinePicker value={state.preferred_cuisines} onChange={(v) => set("preferred_cuisines", v)} />
      </Field>
    </div>
  );
}

/** A dropdown to add cuisines, with the picked ones shown as chips you can remove. */
function CuisinePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const left = CUISINES.filter((c) => !value.includes(c.value));
  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Chosen cuisines">
          {value.map((c) => (
            <li key={c}>
              <button type="button" onClick={() => onChange(value.filter((x) => x !== c))} aria-label={`Remove ${c}`}
                className="rounded-full border border-brand bg-brand-soft px-3 py-1.5 text-sm font-medium text-brand">
                {c} ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {left.length > 0 && (
        <select
          aria-label="Add a cuisine"
          value=""
          onChange={(e) => e.target.value && onChange([...value, e.target.value])}
          className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm"
        >
          <option value="">{value.length ? "Add another cuisine…" : "Choose a cuisine…"}</option>
          {left.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      )}
    </div>
  );
}
