import { describe, expect, it } from "vitest";
import { calcBMI, calculateNutrition, proteinReferenceWeight } from "./calculations";

describe("calculateNutrition", () => {
  it("female, fat loss, 3 days/week", () => {
    const r = calculateNutrition({
      age: 25, sex: "female", height_cm: 165, weight_kg: 60,
      fitness_goal: "lose_fat", workout_days_per_week: 3,
    });
    expect(r.bmr).toBe(1345);            // 600 + 1031.25 - 125 - 161
    expect(r.activity_multiplier).toBe(1.375);
    expect(r.tdee).toBe(1850);
    expect(r.calorie_target).toBe(1480); // 20% deficit
    expect(r.protein_target_g).toBe(120);// 2.0 g/kg
    expect(r.fat_target_g).toBe(41);
    expect(r.carb_target_g).toBe(157);
  });

  it("male, muscle gain, 4 days/week", () => {
    const r = calculateNutrition({
      age: 30, sex: "male", height_cm: 180, weight_kg: 80,
      fitness_goal: "build_muscle", workout_days_per_week: 4,
    });
    expect(r.bmr).toBe(1780);
    expect(r.tdee).toBe(2759);
    expect(r.calorie_target).toBe(3030);
    expect(r.protein_target_g).toBe(144);
  });

  it("never goes below the calorie floor", () => {
    const r = calculateNutrition({
      age: 70, sex: "female", height_cm: 150, weight_kg: 42,
      fitness_goal: "lose_fat", workout_days_per_week: 2,
    });
    expect(r.calorie_target).toBeGreaterThanOrEqual(1200);
    expect(r.carb_target_g).toBeGreaterThanOrEqual(0);
  });

  it("macros add up to roughly the calorie target", () => {
    const r = calculateNutrition({
      age: 40, sex: "other", height_cm: 170, weight_kg: 75,
      fitness_goal: "maintain", workout_days_per_week: 5,
    });
    const kcal = r.protein_target_g * 4 + r.carb_target_g * 4 + r.fat_target_g * 9;
    expect(Math.abs(kcal - r.calorie_target)).toBeLessThan(20);
  });
});

describe("protein reference weight", () => {
  it("uses actual weight at normal BMI", () => {
    expect(proteinReferenceWeight(70, 175)).toBe(70);
  });
  it("caps at BMI 25 weight when BMI > 30", () => {
    expect(calcBMI(120, 170)).toBeGreaterThan(30);
    expect(proteinReferenceWeight(120, 170)).toBeCloseTo(72.25, 1);
  });
});
