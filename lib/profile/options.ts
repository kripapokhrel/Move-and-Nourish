// Single source of truth for profile enums. UI, validation and AI prompts all read from here.
// Values must match the check constraints in supabase/migrations/0001_init.sql.

export const SEX = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other / prefer not to say" },
] as const;

export const FITNESS_LEVEL = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
] as const;

export const FITNESS_GOAL = [
  { value: "lose_fat", label: "Lose fat" },
  { value: "build_muscle", label: "Build muscle" },
  { value: "maintain", label: "Maintain" },
  { value: "improve_fitness", label: "Improve fitness / tone" },
] as const;

export const WORKOUT_LOCATION = [
  { value: "home", label: "Home" },
  { value: "gym", label: "Gym" },
  { value: "both", label: "Both" },
] as const;

export const EQUIPMENT = [
  { value: "none", label: "None" },
  { value: "dumbbells", label: "Dumbbells" },
  { value: "resistance_bands", label: "Resistance bands" },
  { value: "full_gym", label: "Full gym" },
  { value: "other", label: "Other" },
] as const;

export const WORKOUT_DAYS = [
  { value: "2", label: "2 days" },
  { value: "3", label: "3 days" },
  { value: "4", label: "4 days" },
  { value: "5", label: "5 days" },
  { value: "6", label: "6+ days" },
] as const;

export const DIETARY_TYPE = [
  { value: "omnivore", label: "Omnivore" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "pescatarian", label: "Pescatarian" },
] as const;

// Allergies and other things to avoid. Picked from a list so every one can be enforced; lib/meals/diet.ts maps
// each value to the recipe tags it rules out.
export const RESTRICTIONS = [
  { value: "gluten_free", label: "Gluten-free" },
  { value: "dairy_free", label: "Dairy-free" },
  { value: "egg_free", label: "Egg-free" },
  { value: "nut_free", label: "Nut-free (all nuts)" },
  { value: "peanut_free", label: "Peanut-free" },
  { value: "soy_free", label: "Soy-free" },
  { value: "fish_free", label: "No fish" },
  { value: "shellfish_free", label: "No shellfish" },
  { value: "sesame_free", label: "Sesame-free" },
  { value: "no_pork", label: "No pork" },
  { value: "no_beef", label: "No beef" },
  { value: "halal", label: "Halal" },
  { value: "kosher", label: "Kosher" },
  { value: "low_carb", label: "Low-carb" },
] as const;

// Must match the cuisines used in lib/meals/library.ts (a test checks this)
export const CUISINES = [
  "American", "Chinese", "Greek", "Indian", "Italian", "Japanese", "Korean", "Mediterranean", "Mexican",
  "Middle Eastern", "Thai",
].map((c) => ({ value: c, label: c }));

type Values<T extends readonly { value: string }[]> = T[number]["value"];

export type Sex = Values<typeof SEX>;
export type FitnessLevel = Values<typeof FITNESS_LEVEL>;
export type FitnessGoal = Values<typeof FITNESS_GOAL>;
export type WorkoutLocation = Values<typeof WORKOUT_LOCATION>;
export type Equipment = Values<typeof EQUIPMENT>;
export type DietaryType = Values<typeof DIETARY_TYPE>;
export type Restriction = Values<typeof RESTRICTIONS>;

export const values = <T extends readonly { value: string }[]>(opts: T) =>
  opts.map((o) => o.value) as [Values<T>, ...Values<T>[]];

export const labelFor = (opts: readonly { value: string; label: string }[], v: string | null | undefined) =>
  opts.find((o) => o.value === v)?.label ?? v ?? "—";
