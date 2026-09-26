import { bmiCategory } from "@/lib/nutrition/calculations";
import type { NutritionProfile } from "@/types/database";

export const NUTRITION_DISCLAIMER =
  "These numbers are estimates from standard formulas, not medical advice. Talk to a doctor or registered dietitian before making big changes, especially if you have a health condition, are pregnant, or have a history of disordered eating.";

export function NutritionTargets({ n, detailed = false }: { n: NutritionProfile; detailed?: boolean }) {
  const rows = [
    ["Calories", `${n.calorie_target} kcal`],
    ["Protein", `${n.protein_target_g} g`],
    ["Carbs", `${n.carb_target_g} g`],
    ["Fat", `${n.fat_target_g} g`],
  ];
  // What each number means, in plain words, with the user's own value
  const extra = [
    {
      name: "BMI", full: "Body mass index", value: `${n.bmi} (${bmiCategory(n.bmi).toLowerCase()})`,
      text: "Your weight compared with your height. A rough guide only: it can't tell muscle from fat.",
    },
    {
      name: "BMR", full: "Basal metabolic rate", value: `${n.bmr.toLocaleString()} kcal`,
      text: "The energy your body uses a day at complete rest, just to keep you alive: breathing, heartbeat, warmth.",
    },
    {
      name: "TDEE", full: "Total daily energy expenditure", value: `${n.tdee.toLocaleString()} kcal`,
      text: `Your BMR plus everything you do in a day, estimated from how often you work out (BMR × ${n.activity_multiplier}). Eating this much keeps your weight steady.`,
    },
  ];
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="text-lg font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      {detailed && (
        <dl className="space-y-3 border-t border-line pt-3">
          {extra.map((e) => (
            <div key={e.name} className="text-sm">
              <dt><span className="font-semibold">{e.name}</span> <span className="text-muted">· {e.full}</span></dt>
              <dd>
                <span className="font-medium">{e.value}</span>
                <span className="block text-xs text-muted">{e.text}</span>
              </dd>
            </div>
          ))}
          <p className="text-xs text-muted">
            Your calorie target starts from your TDEE and is adjusted for your goal: less to lose fat, a little more to build
            muscle.
          </p>
        </dl>
      )}
      <p className="text-xs text-muted">{NUTRITION_DISCLAIMER}</p>
    </div>
  );
}
