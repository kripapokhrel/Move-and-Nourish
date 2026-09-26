import { describe, expect, it } from "vitest";
import { toFormState, toProfileInput } from "./form";
import { profileInputSchema } from "./schema";
import type { Profile } from "@/types/database";
import type { Restriction } from "./options";

const base = () => ({
  ...toFormState(null),
  name: "Kripa", age: "28", sex: "female", height_cm: "165", weight: "62",
  fitness_level: "beginner", fitness_goal: "build_muscle", workout_location: "home",
  available_equipment: ["dumbbells"], workout_days_per_week: "3", dietary_type: "vegetarian",
  dietary_restrictions: ["peanut_free", "shellfish_free"] as Restriction[], preferred_cuisines: ["Indian", "Korean"],
});

describe("profile form conversion", () => {
  it("produces valid metric input", () => {
    const r = profileInputSchema.safeParse(toProfileInput(base()));
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.dietary_restrictions).toEqual(["peanut_free", "shellfish_free"]);
      expect(r.data.preferred_cuisines).toEqual(["Indian", "Korean"]);
      expect(r.data.allergies).toEqual([]);
    }
  });

  it("saves picked and typed restrictions together, and splits them again", () => {
    const input = toProfileInput({ ...base(), restrictions_other: "mushrooms,  low sodium ," });
    expect(input.dietary_restrictions).toEqual(["peanut_free", "shellfish_free", "mushrooms", "low sodium"]);
    const state = toFormState({ dietary_restrictions: input.dietary_restrictions, allergies: [] } as unknown as Profile);
    expect(state.dietary_restrictions).toEqual(["peanut_free", "shellfish_free"]);
    expect(state.restrictions_other).toBe("mushrooms, low sodium");
  });

  it("carries old free-text answers over to the lists", () => {
    const old = {
      dietary_type: "other", dietary_restrictions: ["halal"], allergies: ["Peanuts", "milk"], disliked_foods: ["olives"],
      preferred_cuisines: ["indian", "Ethiopian"],
    } as unknown as Profile;
    const state = toFormState(old);
    expect(state.dietary_restrictions.sort()).toEqual(["dairy_free", "halal", "peanut_free"]);
    expect(state.restrictions_other).toBe("");
    expect(state.preferred_cuisines).toEqual(["Indian"]);
    expect(state.dietary_type).toBe("");
  });

  it("converts imperial to metric", () => {
    const input = toProfileInput({ ...base(), unit_system: "imperial", height_ft: "5", height_in: "5", weight: "137" });
    expect(input.height_cm).toBeCloseTo(165.1, 1);
    expect(input.weight_kg).toBeCloseTo(62.1, 1);
  });

  it("flags missing required fields", () => {
    const r = profileInputSchema.safeParse(toProfileInput({ ...base(), name: "  ", age: "", sex: "" }));
    expect(r.success).toBe(false);
    const paths = r.success ? [] : r.error.issues.map((i) => i.path[0]);
    expect(paths).toContain("name");
    expect(paths).toContain("age");
    expect(paths).toContain("sex");
  });
});
