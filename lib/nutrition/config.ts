// All tunable nutrition numbers live here. Change them without touching the formulas.
import type { FitnessGoal, Sex } from "@/lib/profile/options";

export const CALCULATION_METHOD = "mifflin_st_jeor_v1";

// Mifflin-St Jeor sex constant. "other" uses the midpoint of male/female.
export const BMR_SEX_CONSTANT: Record<Sex, number> = { male: 5, female: -161, other: -78 };

// No separate activity question in onboarding, so workout frequency drives the multiplier.
export function activityMultiplier(workoutDaysPerWeek: number): number {
  if (workoutDaysPerWeek <= 1) return 1.2;   // sedentary
  if (workoutDaysPerWeek <= 3) return 1.375; // lightly active
  if (workoutDaysPerWeek <= 5) return 1.55;  // moderately active
  return 1.725;                              // very active
}

// Calories as a fraction of TDEE
export const GOAL_CALORIE_FACTOR: Record<FitnessGoal, number> = {
  lose_fat: 0.8,        // ~20% deficit
  build_muscle: 1.1,    // ~10% surplus
  maintain: 1.0,
  improve_fitness: 0.95 // slight deficit for recomposition
};

// Protein in grams per kg of (reference) body weight
export const PROTEIN_G_PER_KG: Record<FitnessGoal, number> = {
  lose_fat: 2.0,
  build_muscle: 1.8,
  maintain: 1.6,
  improve_fitness: 1.8,
};

export const FAT_PERCENT_OF_CALORIES = 0.25;
export const MIN_FAT_G_PER_KG = 0.6;

// Never recommend below these, regardless of formula output
export const CALORIE_FLOOR: Record<Sex, number> = { male: 1500, female: 1200, other: 1350 };

// Above this BMI, protein is based on the weight at BMI 25 so targets don't balloon
export const PROTEIN_REFERENCE_BMI_CAP = 30;
