// "What's in my fridge?": recipes built around what the user said they have. Recipes they can make with exactly
// their list come first; the rest are the closest matches, each showing what else they'd need. Nothing is assumed
// to be in the kitchen, not even oil or spices, so "what else you'd need" is honest. We also ask about the
// ingredients that would complete the most recipes. Pure, and safe to run in the browser (the form uses it as you type).

import { rankMeals } from "@/lib/personalization/apply";
import type { Explicit, Inference } from "@/lib/personalization/infer";
import { allowed, dietRules, stem } from "./diet";
import { toCandidate } from "./generator";
import { RECIPES, type MealType, type Recipe } from "./library";

/** Cooking basics many people have. Offered as quick-add buttons, never assumed. */
export const BASICS = [
  "olive oil", "sea salt", "cumin", "turmeric", "curry powder", "garam masala", "smoked paprika", "balsamic vinegar",
  "soy sauce", "garlic", "onion",
];

// Other names that count as a recipe ingredient. Only names that really are the same thing (or close enough to cook
// with): "rice" never counts as rice noodles, "milk" never counts as coconut milk.
const ACCEPTS: Record<string, string[]> = {
  "chicken breast": ["chicken", "chicken breasts"],
  "wholewheat tortilla": ["tortilla", "tortillas", "wrap", "wraps", "flour tortilla", "flour tortillas"],
  "small tortillas": ["tortilla", "tortillas", "wrap", "wraps", "flour tortilla", "flour tortillas"],
  "wholegrain bread": ["bread", "toast", "wholemeal bread", "whole wheat bread"],
  "wholegrain bagel": ["bagel", "bagels"],
  "english muffin": ["english muffins"],
  "wholewheat pasta": ["pasta"],
  "wholewheat spaghetti": ["spaghetti", "pasta"],
  "wholewheat roti": ["roti", "chapati"],
  "light coconut milk": ["coconut milk"],
  "light cream cheese": ["cream cheese"],
  "baby potatoes": ["potato", "potatoes", "new potatoes"],
  "lean beef strips": ["beef", "steak", "beef strips"],
  "beef mince": ["ground beef", "minced beef", "mince"],
  "turkey mince": ["ground turkey", "minced turkey"],
  "turkey slices": ["sliced turkey", "deli turkey"],
  "salmon fillet": ["salmon"],
  "cod fillet": ["cod", "white fish"],
  "romaine lettuce": ["lettuce", "romaine"],
  lettuce: ["romaine", "romaine lettuce", "iceberg lettuce", "salad leaves"],
  "mixed greens": ["salad leaves", "lettuce", "salad greens"],
  "mixed vegetables": ["frozen vegetables", "frozen mixed vegetables", "vegetables"],
  "mixed berries": ["berries", "strawberries", "blueberries", "raspberries", "frozen berries"],
  "peas and carrots": ["frozen peas and carrots"],
  "bell pepper": ["pepper", "peppers", "capsicum", "red pepper", "green pepper"],
  "bell peppers": ["pepper", "peppers", "capsicum", "red pepper", "green pepper"],
  "red onion": ["onion", "onions"],
  onion: ["red onion", "white onion", "yellow onion", "brown onion"],
  "spring onion": ["scallion", "scallions", "green onion", "green onions"],
  "cherry tomatoes": ["tomato", "tomatoes"],
  tomato: ["cherry tomatoes", "tomatoes"],
  "tomato passata": ["passata", "canned tomatoes", "tinned tomatoes", "tomato sauce", "crushed tomatoes"],
  rice: ["white rice", "brown rice", "basmati rice", "jasmine rice"],
  "brown rice": ["rice"],
  yogurt: ["greek yogurt", "plain yogurt", "yoghurt", "greek yoghurt"],
  "greek yogurt": ["yogurt", "plain yogurt", "yoghurt", "greek yoghurt"],
  "red lentils": ["lentils"],
  "brown lentils": ["lentils", "green lentils"],
  "yellow lentils": ["lentils", "toor dal", "moong dal"],
  sweetcorn: ["corn"],
  "chickpea flour": ["besan", "gram flour"],
  chickpeas: ["garbanzo beans", "garbanzos"],
  "green chilli": ["chilli", "chili", "green chili", "chillies", "chilies"],
  cheddar: ["cheese", "cheddar cheese"],
  "cheese slice": ["cheese", "cheddar", "sliced cheese"],
  courgette: ["zucchini"],
  coriander: ["cilantro"],
  shrimp: ["prawn", "prawns"],
  oats: ["rolled oats", "oatmeal"],
  "sea salt": ["salt"],
  "olive oil": ["oil", "vegetable oil", "cooking oil"],
  "smoked paprika": ["paprika"],
  "cumin seeds": ["cumin"],
  "rice noodles": ["rice vermicelli"],
  "beef burger patty": ["burger", "burgers", "burger patty", "burger patties", "beef burger", "hamburger", "patty", "patties"],
  "veggie burger patty": ["veggie burger", "veggie patty", "plant-based burger", "vegan burger", "bean burger"],
  "burger bun": ["bun", "buns", "burger buns", "bread", "hamburger bun", "brioche bun"],
  "chilli flakes": ["chili flakes", "red pepper flakes"],
  dates: ["date", "medjool dates", "medjool"],
  "salsa": ["tomato salsa", "jarred salsa"],
};

const words = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ").split(" ").map(stem).join(" ");

/** Tidies what the user typed: lower case, spaces trimmed, duplicates removed. Their words are kept. */
export function normalizeItems(items: string[]) {
  return [...new Set(items.map((i) => i.trim().toLowerCase().replace(/\s+/g, " ")).filter(Boolean))];
}

/** Does what the user has count as this recipe ingredient? Same thing (plural or not), or an accepted other name. */
export const matches = (have: string, recipeItem: string) => {
  const h = words(have);
  const r = recipeItem.toLowerCase();
  return h === words(r) || (ACCEPTS[r] ?? []).some((a) => words(a) === h);
};

/** Ingredient names to suggest while typing: exactly what the recipes use. */
export const FRIDGE_SUGGESTIONS = [...new Set(RECIPES.flatMap((r) => r.ingredients.map((i) => i.item)))].sort();

export type FridgeMatch = { have: string[]; missing: string[] };

/** Which of a recipe's ingredients the user has, and which required ones they don't. Optional ones never block it. */
export function fridgeMatch(recipe: { ingredients: { item: string; optional?: true }[] }, items: string[]): FridgeMatch {
  const has = (item: string) => items.some((h) => matches(h, item));
  return {
    have: recipe.ingredients.filter((i) => has(i.item)).map((i) => i.item),
    missing: recipe.ingredients.filter((i) => !i.optional && !has(i.item)).map((i) => i.item),
  };
}

type Rules = { profile: Parameters<typeof dietRules>[0]; mealType: MealType | "any" };

/** Recipes safe for the user and the chosen meal, with what they have and what's missing. */
function candidates({ profile, mealType }: Rules, items: string[]) {
  const rules = dietRules(profile);
  return RECIPES
    .filter((r) => (mealType === "any" || r.types.includes(mealType)) && allowed(r, rules))
    .map((recipe) => ({ recipe, ...fridgeMatch(recipe, items) }));
}

const isBasic = (item: string) => BASICS.some((b) => matches(b, item));

/**
 * Recipes worth suggesting for this list: ones that use at least one real ingredient from it. Oil, salt and spices
 * alone don't count (almost every recipe uses them), unless basics are all the list matches.
 */
function usable(req: Rules, items: string[]) {
  const all = candidates(req, items).filter((c) => c.have.length > 0);
  const real = all.filter((c) => c.have.some((h) => !isBasic(h)));
  return real.length ? real : all;
}

export const MAX_IDEAS = 3;
export const MAX_QUESTIONS = 5;

export type FridgeQuestion = { item: string; unlocks: string[] };

/**
 * "Do you have …?" questions: missing ingredients that would complete the most recipes. An ingredient that is the
 * last thing a recipe needs counts most; one of the last two counts half. Things the user said no to are never asked.
 */
export function fridgeQuestions(req: Rules & { items: string[]; declined: string[] }): FridgeQuestion[] {
  const items = normalizeItems(req.items);
  const declined = new Set(normalizeItems(req.declined));
  const open = candidates(req, items).filter((c) => c.have.length && !c.missing.some((m) => declined.has(m.toLowerCase())));
  // Recipes 1 or 2 ingredients away first; if that gives too few questions, look a step further so there's always a way on
  const score = new Map<string, { score: number; unlocks: string[] }>();
  for (const reach of [2, 3, 4]) {
    for (const c of open.filter((c) => c.missing.length === reach || (reach === 2 && c.missing.length === 1))) {
      for (const m of c.missing) {
        const entry = score.get(m) ?? { score: 0, unlocks: [] };
        entry.score += 1 / c.missing.length;
        if (c.missing.length === 1) entry.unlocks.push(c.recipe.name);
        score.set(m, entry);
      }
    }
    if (score.size >= 3) break;
  }
  return [...score.entries()]
    // Things that complete a recipe right away come first, then things that get several recipes closer
    .sort((a, b) => b[1].unlocks.length - a[1].unlocks.length || b[1].score - a[1].score || a[0].localeCompare(b[0]))
    .slice(0, MAX_QUESTIONS)
    .map(([item, { unlocks }]) => ({ item, unlocks }));
}

export type FridgeRequest = Rules & {
  items: string[];
  /** Recipe ids shown last time, tried last so "Show other recipes" shows something new when it can */
  recent?: string[];
  /** Things the user said they don't have. Recipes needing them sink down the list. */
  declined?: string[];
  inferences: Inference[];
  explicit: Explicit;
  count?: number;
  random?: () => number;
};

/**
 * Up to 3 recipes for what the user has. Ones they can make with exactly their list come first, then the closest:
 * fewest missing ingredients, using the most of their list. Within the same number missing: most-liked first, and
 * different cuisines where possible.
 */
export function suggestFromFridge(req: FridgeRequest) {
  const random = req.random ?? Math.random;
  const items = normalizeItems(req.items);
  const declined = new Set(normalizeItems(req.declined ?? []));
  const pool = usable(req, items);
  const recent = new Set(req.recent ?? []);
  const type = (r: Recipe) => (req.mealType === "any" ? r.types[0] : req.mealType);
  const ranked = rankMeals(pool.map((c) => toCandidate(c.recipe, type(c.recipe))), req.inferences, req.explicit)
    .map(({ meal, score, because }) => {
      const c = pool.find((p) => p.recipe.id === meal.id)!;
      return {
        ...c, because,
        // Something they said they don't have counts as missing twice: they'd have to go and buy it
        away: c.missing.length + c.missing.filter((m) => declined.has(m.toLowerCase())).length,
        total: score + c.have.filter((h) => !isBasic(h)).length * 0.3 + random() * 0.5 - (recent.has(meal.id as string) ? 2 : 0),
      };
    })
    .sort((a, b) => a.away - b.away || b.total - a.total);

  const count = req.count ?? MAX_IDEAS;
  const picks: typeof ranked = [];
  // Spread cuisines, but never at the cost of a recipe that needs more shopping than one that was skipped
  for (const tier of [...new Set(ranked.map((x) => x.away))]) {
    const group = ranked.filter((x) => x.away === tier);
    for (const x of group) if (picks.length < count && !picks.some((p) => p.recipe.cuisine === x.recipe.cuisine)) picks.push(x);
    for (const x of group) if (picks.length < count && !picks.includes(x)) picks.push(x);
    if (picks.length >= count) break;
  }

  return {
    items,
    ideas: picks,
    total: pool.filter((c) => c.missing.length === 0).length,
    unchecked: dietRules(req.profile).unchecked,
  };
}

/** How many recipes can be made from exactly this list (for "that's all you can make" messages). */
export const makeableCount = (req: Rules & { items: string[] }) =>
  candidates(req, normalizeItems(req.items)).filter((c) => c.missing.length === 0).length;

/** How many recipes use something real from this list, including ones that need a few more things. */
export const matchingCount = (req: Rules & { items: string[] }) => usable(req, normalizeItems(req.items)).length;

/** The fridge list is saved with the ideas as JSON. Older saves were a comma-separated list. */
export type FridgeInput = { items: string[]; declined: string[]; mealType: MealType | "any" };
export function parseFridgeInput(text: string | null | undefined): FridgeInput {
  const empty: FridgeInput = { items: [], declined: [], mealType: "any" };
  if (!text) return empty;
  try {
    const parsed = JSON.parse(text) as Partial<FridgeInput>;
    return { items: parsed.items ?? [], declined: parsed.declined ?? [], mealType: parsed.mealType ?? "any" };
  } catch {
    return { ...empty, items: text.split(",").map((i) => i.trim()).filter(Boolean) };
  }
}
