import { describe, expect, it } from "vitest";
import type { Inference } from "@/lib/personalization/infer";
import { CUISINES, RESTRICTIONS, type Restriction } from "@/lib/profile/options";
import { allowed, dietRules, mentions, restrictionsFromText } from "./diet";
import { fitOf, mealTarget, suggestMeals, type MealRequest } from "./generator";
import { RECIPES, nutritionOf, type Allergen, type Diet, type MealType } from "./library";
import { NUTRIENTS_PER_100G } from "./nutrients";

const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const profile = (over: Partial<NonNullable<MealRequest["profile"]>> = {}): NonNullable<MealRequest["profile"]> => ({
  dietary_type: "omnivore", allergies: [], dietary_restrictions: [], disliked_foods: [], preferred_cuisines: [], ...over,
});
const request = (over: Partial<MealRequest> = {}): MealRequest => ({
  profile: profile(),
  nutrition: { calorie_target: 2000, protein_target_g: 140 },
  mealType: "lunch",
  inferences: [],
  explicit: { profile: null, preferences: [] },
  random: seeded(3),
  ...over,
});
/** Profiles saved before restrictions became a list hold free text */
const legacy = (xs: string[]) => xs as Restriction[];
const TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

// Ingredient words that mean a recipe must carry a tag. Kept separate from diet.ts so the two check each other.
const TAG_WORDS: [Allergen, RegExp][] = [
  ["dairy", /(?<!soy |coconut )milk|yogurt|cheese|cheddar|feta|mozzarella|parmesan|paneer|halloumi|ghee|(?<!peanut )butter|cream/],
  ["egg", /\beggs?\b|caesar dressing/],
  ["gluten", /bread|\bbuns?\b|(?<!corn )tortilla|pita|pasta|spaghetti|couscous|bagel|muffin|breadcrumbs|croutons|oats|roti|soy sauce|teriyaki/],
  ["soy", /tofu|soy|edamame|teriyaki/],
  ["peanut", /peanut/],
  ["tree_nut", /almond|walnut|cashew|pecan|pistachio|hazelnut/],
  ["fish", /salmon|tuna|\bcod\b|anchov|caesar dressing/],
  ["shellfish", /shrimp|prawn|crab|lobster/],
  ["sesame", /sesame|tahini|hummus/],
  ["pork", /pork|bacon|\bham\b/],
  ["beef", /beef/],
];
const MEAT = /chicken|beef|pork|turkey|lamb|bacon|\bham\b|sausage/;
const SEAFOOD = /salmon|tuna|\bcod\b|shrimp|anchov|fish/;
const ANIMAL = /yogurt|cheese|cheddar|feta|mozzarella|parmesan|paneer|halloumi|ghee|\beggs?\b|honey|(?<!soy |coconut )milk|cream/;

describe("recipe library", () => {
  it("has unique ids, USDA-based nutrition and complete recipes", () => {
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
    for (const r of RECIPES) {
      for (const i of r.ingredients) {
        expect(NUTRIENTS_PER_100G[i.item], `${r.name}: ${i.item} needs a USDA entry`).toBeDefined();
        expect(i.grams, `${r.name}: ${i.item}`).toBeGreaterThan(0);
      }
      expect(nutritionOf(r.ingredients)).toEqual({ calories: r.calories, protein_g: r.protein_g, carbs_g: r.carbs_g, fat_g: r.fat_g });
      // USDA energy should roughly agree with 4/4/9 kcal per gram of protein/carbs/fat
      const atwater = r.protein_g * 4 + r.carbs_g * 4 + r.fat_g * 9;
      expect(Math.abs(r.calories - atwater) / atwater, r.name).toBeLessThan(0.12);
      expect(r.calories, r.name).toBeGreaterThan(90);
      expect(r.calories, r.name).toBeLessThan(900);
      expect(r.ingredients.length, r.name).toBeGreaterThanOrEqual(2);
      expect(r.steps.length, r.name).toBeGreaterThanOrEqual(2);
      expect(r.types.length, r.name).toBeGreaterThan(0);
    }
  });

  it("tags every allergen its ingredients contain", () => {
    for (const r of RECIPES) {
      const text = r.ingredients.map((i) => `${i.item} ${i.quantity}`).join(" | ").toLowerCase();
      for (const [tag, re] of TAG_WORDS) {
        if (re.test(text)) expect(r.contains, `${r.name} should be tagged ${tag}`).toContain(tag);
      }
    }
  });

  it("labels diets correctly", () => {
    const rank: Record<Diet, number> = { vegan: 0, vegetarian: 1, pescatarian: 2, meat: 3 };
    for (const r of RECIPES) {
      const text = r.ingredients.map((i) => `${i.item} ${i.quantity}`).join(" | ").toLowerCase();
      if (MEAT.test(text)) expect(r.diet, r.name).toBe("meat");
      if (SEAFOOD.test(text)) expect(rank[r.diet], r.name).toBeGreaterThanOrEqual(rank.pescatarian);
      if (ANIMAL.test(text)) expect(rank[r.diet], r.name).toBeGreaterThanOrEqual(rank.vegetarian);
    }
  });

  it("has at least 3 choices for every diet and meal", () => {
    for (const diet of ["vegan", "vegetarian", "pescatarian", "omnivore"] as const) {
      const rules = dietRules(profile({ dietary_type: diet }));
      for (const type of TYPES) {
        expect(RECIPES.filter((r) => r.types.includes(type) && allowed(r, rules)).length, `${diet} ${type}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe("dietRules", () => {
  it("reads several allergies without mixing them up", () => {
    expect([...dietRules(profile({ allergies: ["peanuts", "milk"] })).avoid].sort()).toEqual(["dairy", "peanut"]);
    expect([...dietRules(profile({ allergies: ["tree nuts"] })).avoid]).toEqual(["tree_nut"]);
    expect([...dietRules(profile({ allergies: ["shellfish"] })).avoid]).toEqual(["shellfish"]);
    expect([...dietRules(profile({ allergies: ["nuts"] })).avoid].sort()).toEqual(["peanut", "tree_nut"]);
    expect([...dietRules(profile({ allergies: ["eggplant"] })).avoid]).toEqual([]);
  });

  it("enforces every restriction option", () => {
    for (const { value } of RESTRICTIONS) {
      const rules = dietRules(profile({ dietary_restrictions: [value] }));
      expect(rules.unchecked).toEqual([]);
      expect(rules.avoid.size > 0 || rules.lowCarb, value).toBe(true);
    }
    const nutFree = dietRules(profile({ dietary_restrictions: ["nut_free"] }));
    expect(RECIPES.filter((r) => allowed(r, nutFree)).some((r) => r.contains.includes("peanut") || r.contains.includes("tree_nut"))).toBe(false);
  });

  it("converts old free-text allergies and restrictions to options", () => {
    expect(restrictionsFromText(["peanuts", "Milk", "shellfish"]).sort()).toEqual(["dairy_free", "peanut_free", "shellfish_free"]);
    expect(restrictionsFromText(["nuts", "peanuts"])).toEqual(["nut_free"]);
    expect(restrictionsFromText(["Halal", "keto", "gluten-free"]).sort()).toEqual(["gluten_free", "halal", "low_carb"]);
    expect(restrictionsFromText(["low sodium", "vegetarian"])).toEqual([]);
  });

  it("offers every cuisine the recipes use, and no others", () => {
    expect(new Set(RECIPES.map((r) => r.cuisine))).toEqual(new Set(CUISINES.map((c) => c.value)));
  });

  it("applies old free-text restrictions it knows and lists the ones it can't check", () => {
    const rules = dietRules(profile({ dietary_restrictions: legacy(["Gluten-free", "halal", "low sodium", "vegetarian"]) }));
    expect(rules.avoid.has("gluten")).toBe(true);
    expect(rules.avoid.has("pork")).toBe(true);
    expect(rules.diets).toEqual(["vegan", "vegetarian"]);
    expect(rules.unchecked).toEqual(["low sodium"]);
    const lowCarb = dietRules(profile({ dietary_restrictions: legacy(["keto"]) }));
    expect(RECIPES.filter((r) => allowed(r, lowCarb)).every((r) => r.carbs_g <= 25)).toBe(true);
  });

  it("leaves out recipes that mention a typed restriction", () => {
    const rules = dietRules(profile({ dietary_restrictions: legacy(["chickpeas"]) }));
    const left = RECIPES.filter((r) => allowed(r, rules));
    expect(left.some((r) => r.ingredients.some((i) => i.item === "chickpeas"))).toBe(false);
    expect(left.length).toBeGreaterThan(30);
  });

  it("also blocks unusual allergies by ingredient name, plural or not", () => {
    const rules = dietRules(profile({ allergies: ["tomatoes"] }));
    expect(RECIPES.filter((r) => allowed(r, rules)).some((r) => r.ingredients.some((i) => mentions(i.item, "tomato")))).toBe(false);
  });
});

describe("suggestMeals", () => {
  it("never suggests anything unsafe", () => {
    const p = profile({ dietary_type: "vegan", allergies: ["peanuts", "soy"] });
    for (let seed = 1; seed < 30; seed++) {
      for (const type of TYPES) {
        const { ideas } = suggestMeals(request({ profile: p, mealType: type, random: seeded(seed) }));
        for (const { recipe } of ideas) {
          expect(recipe.diet).toBe("vegan");
          expect(recipe.contains).not.toContain("peanut");
          expect(recipe.contains).not.toContain("soy");
        }
      }
    }
  });

  it("leaves out foods the user doesn't like", () => {
    const explicit = { profile: { disliked_foods: ["chickpeas"], allergies: [], preferred_cuisines: [], dietary_type: "omnivore" as const }, preferences: [] };
    for (let seed = 1; seed < 20; seed++) {
      const { ideas } = suggestMeals(request({ explicit, mealType: "dinner", random: seeded(seed) }));
      expect(ideas.flatMap((i) => i.recipe.ingredients.map((x) => x.item))).not.toContain("chickpeas");
    }
  });

  it("gives 3 ideas from different cuisines, and new ones next time", () => {
    const first = suggestMeals(request()).ideas;
    expect(first).toHaveLength(3);
    expect(new Set(first.map((i) => i.recipe.cuisine)).size).toBe(3);
    const next = suggestMeals(request({ recent: first.map((i) => i.recipe.id), random: seeded(4) })).ideas;
    expect(next.some((i) => first.some((f) => f.recipe.id === i.recipe.id))).toBe(false);
  });

  it("leans toward learned tastes and explains why", () => {
    const indian: Inference = {
      key: "favor_cuisine:indian", kind: "favor_cuisine", domain: "meal", value: "indian", statement: "", evidence: "",
      confidence: 0.8, n: 6, last: null,
    };
    let withTaste = 0, without = 0;
    for (let seed = 1; seed < 40; seed++) {
      if (suggestMeals(request({ random: seeded(seed) })).ideas[0].recipe.cuisine === "Indian") without++;
      const top = suggestMeals(request({ inferences: [indian], random: seeded(seed) })).ideas[0];
      if (top.recipe.cuisine === "Indian") {
        withTaste++;
        expect(top.because).toContain("you often save Indian meals");
      }
    }
    expect(withTaste).toBeGreaterThan(without);
  });
});

describe("meal targets", () => {
  it("splits the daily target and says honestly how a meal fits", () => {
    const target = mealTarget({ calorie_target: 2000, protein_target_g: 140 }, "lunch")!;
    expect(target).toEqual({ calories: 700, protein_g: 49 });
    expect(fitOf({ calories: 680, protein_g: 45 }, target, "lunch")).toEqual({ fits: true, note: "Fits your lunch target." });
    expect(fitOf({ calories: 400, protein_g: 45 }, target, "lunch").note).toMatch(/Lighter/);
    expect(fitOf({ calories: 700, protein_g: 20 }, target, "lunch").note).toMatch(/lower in protein/);
    expect(fitOf({ calories: 700, protein_g: 20 }, null, "lunch").fits).toBeUndefined();
  });
});
