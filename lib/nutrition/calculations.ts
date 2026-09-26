// Deterministic nutrition math. No AI, no database. Easy to unit test.
import type { FitnessGoal, Sex } from "@/lib/profile/options";
import {
  BMR_SEX_CONSTANT, CALCULATION_METHOD, CALORIE_FLOOR, FAT_PERCENT_OF_CALORIES,
  GOAL_CALORIE_FACTOR, MIN_FAT_G_PER_KG, PROTEIN_G_PER_KG, PROTEIN_REFERENCE_BMI_CAP,
  activityMultiplier,
} from "./config";

export type NutritionInput = {
  age: number;
  sex: Sex;
  height_cm: number;
  weight_kg: number;
  fitness_goal: FitnessGoal;
  workout_days_per_week: number;
};

export type NutritionTargets = {
  bmi: number;
  bmr: number;
  activity_multiplier: number;
  tdee: number;
  calorie_target: number;
  protein_target_g: number;
  carb_target_g: number;
  fat_target_g: number;
  calculation_method: string;
};

const round = (n: number, dp = 0) => Math.round(n * 10 ** dp) / 10 ** dp;

export function calcBMI(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function calcBMR({ weight_kg, height_cm, age, sex }: NutritionInput): number {
  return 10 * weight_kg + 6.25 * height_cm - 5 * age + BMR_SEX_CONSTANT[sex];
}

/** Weight used for protein. Caps at the weight you'd have at BMI 25 when BMI is high. */
export function proteinReferenceWeight(weightKg: number, heightCm: number): number {
  if (calcBMI(weightKg, heightCm) <= PROTEIN_REFERENCE_BMI_CAP) return weightKg;
  const m = heightCm / 100;
  return 25 * m * m;
}

export function calculateNutrition(input: NutritionInput): NutritionTargets {
  const bmi = calcBMI(input.weight_kg, input.height_cm);
  const bmr = calcBMR(input);
  const multiplier = activityMultiplier(input.workout_days_per_week);
  const tdee = bmr * multiplier;

  const calories = Math.max(tdee * GOAL_CALORIE_FACTOR[input.fitness_goal], CALORIE_FLOOR[input.sex]);

  const protein = proteinReferenceWeight(input.weight_kg, input.height_cm) * PROTEIN_G_PER_KG[input.fitness_goal];
  const fat = Math.max((calories * FAT_PERCENT_OF_CALORIES) / 9, input.weight_kg * MIN_FAT_G_PER_KG);
  const carbs = Math.max((calories - protein * 4 - fat * 9) / 4, 0);

  return {
    bmi: round(bmi, 1),
    bmr: round(bmr),
    activity_multiplier: multiplier,
    tdee: round(tdee),
    calorie_target: round(calories / 10) * 10, // nearest 10 kcal
    protein_target_g: round(protein),
    carb_target_g: round(carbs),
    fat_target_g: round(fat),
    calculation_method: CALCULATION_METHOD,
  };
}

export function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Healthy range";
  if (bmi < 30) return "Overweight";
  return "Obese";
}
