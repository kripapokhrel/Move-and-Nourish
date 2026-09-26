// Turns the profile's diet and restrictions into hard rules for recipes. Pure.
// Restrictions are picked from RESTRICTIONS in lib/profile/options.ts, and each maps to the tags it rules out.
// Profiles saved before that (free-text allergies and restrictions) are still read with the word rules below,
// and every old allergy is also matched against ingredient names. Anything we can't check is returned so the UI
// can say so honestly.

import type { Restriction } from "@/lib/profile/options";
import type { Profile } from "@/types/database";
import type { Allergen, Diet, Recipe } from "./library";

// Which recipe diets each profile diet accepts
const ALLOWED_DIETS: Record<string, Diet[]> = {
  vegan: ["vegan"],
  vegetarian: ["vegan", "vegetarian"],
  pescatarian: ["vegan", "vegetarian", "pescatarian"],
  omnivore: ["vegan", "vegetarian", "pescatarian", "meat"],
  other: ["vegan", "vegetarian", "pescatarian", "meat"],
};

// Every matching line applies, so "peanut and milk" blocks both
const WORDS: [RegExp, Allergen[]][] = [
  [/peanut/, ["peanut"]],
  [/shellfish|shrimp|prawn|crab|lobster|crustacean/, ["shellfish"]],
  [/(?<!shell)fish|salmon|tuna|\bcod\b|anchov/, ["fish"]],
  [/tree ?nut|almond|cashew|walnut|pecan|pistachio|hazelnut/, ["tree_nut"]],
  // "nuts" on its own: avoid both, to be safe
  [/(?<!tree ?)\bnuts?\b|(?<!tree ?)\bnut[- ]free/, ["tree_nut", "peanut"]],
  [/dairy|milk|lactose|cheese|casein|whey/, ["dairy"]],
  [/\beggs?\b/, ["egg"]],
  [/gluten|wheat|coeliac|celiac/, ["gluten"]],
  [/\bsoy|soya/, ["soy"]],
  [/sesame|tahini/, ["sesame"]],
  [/pork|bacon|ham\b/, ["pork"]],
  [/beef/, ["beef"]],
  // Halal: no pork. Kosher: no pork or shellfish (meat and dairy together is handled below)
  [/halal/, ["pork"]],
  [/kosher/, ["pork", "shellfish"]],
];
const DIET_WORDS: [RegExp, keyof typeof ALLOWED_DIETS][] = [
  [/vegan|plant[- ]based/, "vegan"],
  [/vegetarian/, "vegetarian"],
  [/pescatarian|pescetarian/, "pescatarian"],
];
const LOW_CARB = /low[- _]carb|keto/;

type Rule = { avoid?: Allergen[]; lowCarb?: true; kosher?: true };
export const RESTRICTION_RULES: Record<Restriction, Rule> = {
  gluten_free: { avoid: ["gluten"] },
  dairy_free: { avoid: ["dairy"] },
  egg_free: { avoid: ["egg"] },
  nut_free: { avoid: ["tree_nut", "peanut"] },
  peanut_free: { avoid: ["peanut"] },
  soy_free: { avoid: ["soy"] },
  fish_free: { avoid: ["fish"] },
  shellfish_free: { avoid: ["shellfish"] },
  sesame_free: { avoid: ["sesame"] },
  no_pork: { avoid: ["pork"] },
  no_beef: { avoid: ["beef"] },
  halal: { avoid: ["pork"] },
  kosher: { avoid: ["pork", "shellfish"], kosher: true },
  low_carb: { lowCarb: true },
};
const isRestriction = (v: string): v is Restriction => v in RESTRICTION_RULES;

// Which option covers each tag, for converting old free-text answers
const TAG_OPTION: Record<Allergen, Restriction> = {
  gluten: "gluten_free", dairy: "dairy_free", egg: "egg_free", peanut: "peanut_free", tree_nut: "nut_free",
  soy: "soy_free", fish: "fish_free", shellfish: "shellfish_free", sesame: "sesame_free", pork: "no_pork", beef: "no_beef",
};

/** Saved restrictions -> the picked options and what the user typed. */
export function splitRestrictions(saved: string[]) {
  return {
    options: saved.filter((s): s is Restriction => isRestriction(s)),
    typed: saved.filter((s) => !isRestriction(s)),
  };
}

/**
 * Old free-text allergies and restrictions -> the options that cover them, so nothing is lost when the profile
 * form switches to the list. "nuts" becomes Nut-free; "halal" stays Halal.
 */
export function restrictionsFromText(texts: string[]): Restriction[] {
  const out = new Set<Restriction>();
  for (const raw of texts) {
    const text = clean(raw);
    if (isRestriction(text)) { out.add(text); continue; }
    if (/halal/.test(text)) { out.add("halal"); continue; }
    if (/kosher/.test(text)) { out.add("kosher"); continue; }
    if (LOW_CARB.test(text)) out.add("low_carb");
    const tags = new Set(WORDS.filter(([re]) => re.test(text)).flatMap(([, t]) => t));
    if (tags.has("tree_nut") && tags.has("peanut")) { out.add("nut_free"); tags.delete("tree_nut"); tags.delete("peanut"); }
    tags.forEach((t) => out.add(TAG_OPTION[t]));
  }
  // Nut-free already covers peanuts
  if (out.has("nut_free")) out.delete("peanut_free");
  return [...out];
}
/** Low-carb meals: at most this many grams of carbs per serving. */
export const LOW_CARB_MAX_G = 25;

export type DietRules = {
  diets: Diet[];
  avoid: Set<Allergen>;
  /** Old allergies and typed restrictions, matched against ingredient names ("mushrooms" leaves out mushroom dishes) */
  allergyWords: string[];
  lowCarb: boolean;
  kosher: boolean;
  /** Restrictions we have no rule for, e.g. "low sodium". Shown to the user. */
  unchecked: string[];
};

const clean = (s: string) => s.trim().toLowerCase();

/** "tomatoes" -> "tomato", "berries" -> "berry", "eggs" -> "egg", so plural and singular match. */
export const stem = (word: string) => {
  const w = clean(word);
  if (w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.endsWith("oes")) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
};
export const mentions = (text: string, food: string) => clean(text).includes(stem(food));

export function dietRules(profile: Pick<Profile, "dietary_type" | "allergies" | "dietary_restrictions"> | null): DietRules {
  let diets = ALLOWED_DIETS[profile?.dietary_type ?? "omnivore"] ?? ALLOWED_DIETS.omnivore;
  const avoid = new Set<Allergen>();
  const unchecked: string[] = [];
  let lowCarb = false;
  let kosher = false;

  const apply = (text: string) => {
    let known = false;
    for (const [re, tags] of WORDS) {
      if (!re.test(text)) continue;
      tags.forEach((t) => avoid.add(t));
      known = true;
    }
    return known;
  };

  const allergies = (profile?.allergies ?? []).map(clean).filter(Boolean);
  for (const a of allergies) apply(a);

  for (const raw of (profile?.dietary_restrictions ?? []) as string[]) {
    const text = clean(raw);
    if (!text) continue;
    if (isRestriction(text)) {
      const rule = RESTRICTION_RULES[text];
      rule.avoid?.forEach((t) => avoid.add(t));
      if (rule.lowCarb) lowCarb = true;
      if (rule.kosher) kosher = true;
      continue;
    }
    let known = apply(text);
    const diet = DIET_WORDS.find(([re]) => re.test(text));
    if (diet) {
      diets = diets.filter((d) => ALLOWED_DIETS[diet[1]].includes(d));
      known = true;
    }
    if (LOW_CARB.test(text)) lowCarb = known = true;
    if (/kosher/.test(text)) kosher = true;
    // Typed by the user: always matched against ingredient names too
    allergies.push(text);
    if (!known) unchecked.push(raw.trim());
  }
  return { diets, avoid, allergyWords: allergies, lowCarb, kosher, unchecked };
}

/** Whether a recipe is safe for the user. Allergies and diet are never relaxed, even if few recipes are left. */
export function allowed(recipe: Recipe, rules: DietRules) {
  if (!rules.diets.includes(recipe.diet)) return false;
  if (recipe.contains.some((a) => rules.avoid.has(a))) return false;
  const names = [recipe.name, ...recipe.ingredients.map((i) => i.item)];
  if (rules.allergyWords.some((w) => names.some((n) => mentions(n, w)))) return false;
  if (rules.lowCarb && recipe.carbs_g > LOW_CARB_MAX_G) return false;
  if (rules.kosher && recipe.diet === "meat" && recipe.contains.includes("dairy")) return false;
  return true;
}
