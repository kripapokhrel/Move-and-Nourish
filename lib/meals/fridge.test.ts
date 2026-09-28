import { describe, expect, it } from "vitest";
import { findRecipe } from "./library";
import {
  MAX_IDEAS, fridgeMatch, fridgeQuestions, makeableCount, matches, matchingCount, normalizeItems, parseFridgeInput, suggestFromFridge, type FridgeRequest,
} from "./fridge";

const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const omnivore = { dietary_type: "omnivore" as const, allergies: [], dietary_restrictions: [] };
const request = (over: Partial<FridgeRequest> = {}): FridgeRequest => ({
  profile: omnivore,
  items: [],
  mealType: "any",
  inferences: [],
  explicit: { profile: null, preferences: [] },
  random: seeded(5),
  ...over,
});
const NOODLES = ["tofu", "rice noodles", "peanut butter", "soy sauce", "cucumber", "carrot", "lime"];

describe("matching what you have", () => {
  it("counts the same thing, plurals, and accepted other names", () => {
    expect(matches("eggs", "egg")).toBe(true);
    expect(matches("Chicken", "chicken breast")).toBe(true);
    expect(matches("zucchini", "courgette")).toBe(true);
    expect(matches("cheese", "cheddar")).toBe(true);
    expect(matches("greek yogurt", "yogurt")).toBe(true);
  });

  it("doesn't stretch what you have into something else", () => {
    expect(matches("rice", "rice noodles")).toBe(false);
    expect(matches("rice noodles", "rice")).toBe(false);
    expect(matches("coconut milk", "milk")).toBe(false);
    expect(matches("soy milk", "milk")).toBe(false);
    expect(matches("peanut butter", "peanuts")).toBe(false);
    expect(matches("chicken", "turkey mince")).toBe(false);
  });

  it("keeps the user's own words", () => {
    expect(normalizeItems(["Zucchini", " brown  rice ", "zucchini", ""])).toEqual(["zucchini", "brown rice"]);
  });

  it("assumes nothing: oil counts as an ingredient you need to have", () => {
    expect(fridgeMatch(findRecipe("lentil-soup")!, ["red lentils"]).missing).toContain("olive oil");
  });
});

describe("suggestFromFridge", () => {
  it("puts recipes you can make with exactly your list first, then the closest, at most 3", () => {
    const { ideas, total } = suggestFromFridge(request({ items: NOODLES }));
    expect(total).toBe(1);
    expect(ideas[0].recipe.id).toBe("peanut-tofu-noodles");
    expect(ideas[0].missing).toEqual([]);
    expect(ideas).toHaveLength(MAX_IDEAS);
    for (const i of ideas.slice(1)) expect(i.missing.length).toBeGreaterThan(0);
    // Closest first: never more missing than the one after it
    for (let n = 1; n < ideas.length; n++) expect(ideas[n].missing.length).toBeGreaterThanOrEqual(ideas[n - 1].missing.length);
    const many = suggestFromFridge(request({
      items: ["apple", "peanut butter", "edamame", "sea salt", "hummus", "carrot", "cucumber", "bell pepper", "greek yogurt",
        "honey", "walnuts", "eggs", "cherry tomatoes", "cottage cheese", "pineapple"],
      mealType: "snack",
    })).ideas;
    expect(many).toHaveLength(MAX_IDEAS);
    for (const i of many) expect(i.missing).toEqual([]);
    expect(new Set(many.map((i) => i.recipe.cuisine)).size).toBeGreaterThan(1);
  });

  it("still follows diet and restrictions, even for close matches", () => {
    const { ideas } = suggestFromFridge(request({
      profile: { dietary_type: "vegan", allergies: [], dietary_restrictions: ["soy_free"] },
      items: NOODLES,
    }));
    expect(ideas.map((i) => i.recipe.id)).not.toContain("peanut-tofu-noodles");
    for (const i of ideas) {
      expect(i.recipe.diet).toBe("vegan");
      expect(i.recipe.ingredients.map((x) => x.item)).not.toEqual(expect.arrayContaining(["tofu"]));
    }
  });

  it("suggests close recipes when nothing can be made exactly (soy chunks and olive oil)", () => {
    const veggie = { dietary_type: "vegetarian" as const, allergies: [], dietary_restrictions: [] };
    const { ideas, total } = suggestFromFridge(request({ profile: veggie, items: ["soy chunks", "olive oil"], mealType: "breakfast" }));
    expect(total).toBe(0);
    expect(ideas.length).toBeGreaterThan(0);
    for (const i of ideas) {
      expect(i.have).toContain("olive oil");
      expect(i.missing.length).toBeGreaterThan(0);
    }
  });

  it("needs a real ingredient from your list, not just oil or salt, when one matches", () => {
    const { ideas } = suggestFromFridge(request({ items: ["red lentils", "olive oil", "sea salt"] }));
    for (const i of ideas) expect(i.have).toContain("red lentils");
  });

  it("finds nothing when no recipe uses anything on the list", () => {
    expect(suggestFromFridge(request({ items: ["soy chunks"] })).ideas).toEqual([]);
    expect(matchingCount({ profile: omnivore, mealType: "any", items: ["soy chunks"] })).toBe(0);
  });

  it("moves recipes needing something you said you don't have further down", () => {
    const items = ["oats", "banana"];
    const first = (declined: string[]) => suggestFromFridge(request({ items, declined, random: () => 0.5 })).ideas[0].recipe.id;
    expect(first([])).toBe("banana-porridge");
    expect(first(["milk"])).not.toBe("banana-porridge");
  });
});

describe("fridgeQuestions", () => {
  it("asks about what would complete the most recipes, and says what it unlocks", () => {
    const qs = fridgeQuestions({ profile: omnivore, mealType: "any", items: ["red lentils", "carrot", "onion", "vegetable stock", "cumin", "lemon"], declined: [] });
    expect(qs[0]).toEqual({ item: "olive oil", unlocks: ["Red lentil soup"] });
  });

  it("never asks again about something you don't have, or about anything unsafe", () => {
    const base = { profile: omnivore, mealType: "any" as const, items: ["apple"] };
    expect(fridgeQuestions({ ...base, declined: [] }).map((q) => q.item)).toContain("peanut butter");
    expect(fridgeQuestions({ ...base, declined: ["peanut butter"] }).map((q) => q.item)).not.toContain("peanut butter");
    const peanutFree = { ...base, profile: { ...omnivore, dietary_restrictions: ["peanut_free" as const] }, declined: [] };
    expect(fridgeQuestions(peanutFree).map((q) => q.item)).not.toContain("peanut butter");
  });
});

describe("parseFridgeInput", () => {
  it("reads new and old saves", () => {
    expect(parseFridgeInput(JSON.stringify({ items: ["tofu"], declined: ["rice"], mealType: "dinner" })))
      .toEqual({ items: ["tofu"], declined: ["rice"], mealType: "dinner" });
    expect(parseFridgeInput("tofu, rice")).toEqual({ items: ["tofu", "rice"], declined: [], mealType: "any" });
  });
});

describe("common fridge staples", () => {
  it("makes something from burger, bread and avocado", () => {
    const { ideas } = suggestFromFridge(request({ items: ["burger", "bread", "avocado"] }));
    expect(ideas.slice(0, 2).map((i) => i.recipe.id).sort()).toEqual(["avocado-toast", "beef-burger"]);
    const burger = ideas.find((i) => i.recipe.id === "beef-burger")!;
    expect(burger.have).toEqual(["beef burger patty", "burger bun", "avocado"]);
  });

  it("never lets an optional garnish block a recipe", () => {
    expect(fridgeMatch(findRecipe("avocado-toast")!, ["bread", "avocado"]).missing).toEqual([]);
  });

  it("always has something to ask when nothing is close", () => {
    const qs = fridgeQuestions({ profile: omnivore, mealType: "any", items: ["bread"], declined: [] });
    expect(qs.length).toBeGreaterThanOrEqual(3);
  });
});

describe("variety", () => {
  const veggie = { dietary_type: "vegetarian" as const, allergies: [], dietary_restrictions: [] };
  const fridge = ["bread", "avocado", "tomato", "onion", "olive oil", "rice", "chickpeas", "spinach", "greek yogurt", "honey", "oats", "banana"];

  it("an everyday fridge makes several recipes, not just one", () => {
    expect(makeableCount({ profile: veggie, mealType: "any", items: fridge })).toBeGreaterThanOrEqual(5);
  });

  it("shows different recipes next time when there are more than 3", () => {
    const first = suggestFromFridge(request({ profile: veggie, items: fridge })).ideas.map((i) => i.recipe.id);
    const next = suggestFromFridge(request({ profile: veggie, items: fridge, recent: first, random: seeded(9) })).ideas.map((i) => i.recipe.id);
    expect(first).toHaveLength(3);
    expect(next.filter((id) => first.includes(id))).toEqual([]);
  });

  it("never lets a squeeze of lemon or a pinch of spice block a recipe", () => {
    const soup = fridgeMatch(findRecipe("lentil-soup")!, ["red lentils", "carrot", "onion", "vegetable stock", "olive oil"]);
    expect(soup.missing).toEqual([]);
  });
});

describe("banana and dates (reported case)", () => {
  const veggie = { dietary_type: "vegetarian" as const, allergies: [], dietary_restrictions: [] };
  it("nothing for lunch, but asking across meals finds a way forward", () => {
    const base = { profile: veggie, items: ["banana", "dates"], declined: [] };
    expect(makeableCount({ ...base, mealType: "lunch" })).toBe(0);
    expect(fridgeQuestions({ ...base, mealType: "lunch" })).toEqual([]);
    const anyMeal = fridgeQuestions({ ...base, mealType: "any" });
    expect(anyMeal.map((q) => q.item)).toEqual(expect.arrayContaining(["milk", "peanut butter"]));
    expect(makeableCount({ ...base, items: ["banana", "dates", "milk"], mealType: "any" })).toBeGreaterThan(0);
  });
});
