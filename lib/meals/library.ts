// The recipe library meal ideas are picked from. Add recipes here; nothing else needs to change.
//
// types:    meals it suits (breakfast, lunch, dinner, snack)
// diet:     the strictest diet it fits. "vegan" also suits vegetarians, pescatarians and everyone else
// contains: allergens and other things people avoid. The test checks these against the ingredient names,
//           so keep ingredient names plain ("yogurt", "tofu", "soy sauce")
// ingredients: [item, quantity, grams] for one serving, or [item, quantity, grams, OPTIONAL] for extras the dish works
//           without. Items stay short so preferences can be learned per ingredient. Optional ones still count for
//           allergies, but not for nutrition.
// Nutrition is worked out from the grams and USDA FoodData Central values in nutrients.ts, never typed in by hand.
// Every item needs an entry in scripts/fdc/mapping.json (a test checks this).

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type Diet = "vegan" | "vegetarian" | "pescatarian" | "meat";
export type Allergen =
  | "gluten" | "dairy" | "egg" | "soy" | "peanut" | "tree_nut" | "fish" | "shellfish" | "sesame" | "pork" | "beef";

import { NUTRIENTS_PER_100G } from "./nutrients";

export type Recipe = {
  id: string;
  name: string;
  types: MealType[];
  cuisine: string;
  diet: Diet;
  prep_time_min: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  calories: number;
  contains: Allergen[];
  ingredients: { item: string; quantity: string; grams: number; optional?: true }[];
  steps: string[];
};

export const OPTIONAL = "optional";
type Ingredient = [string, string, number] | [string, string, number, typeof OPTIONAL];

/** Per-serving nutrition from USDA values per 100 g. Optional extras aren't counted. */
export function nutritionOf(ingredients: Recipe["ingredients"]) {
  const total = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const i of ingredients) {
    if (i.optional) continue;
    const n = NUTRIENTS_PER_100G[i.item];
    if (!n) throw new Error(`No USDA nutrition for "${i.item}". Add it to scripts/fdc/mapping.json.`);
    for (const k of ["kcal", "protein", "carbs", "fat"] as const) total[k] += (n[k] * i.grams) / 100;
  }
  // Whole numbers: that's how meal_history stores them, and how they're shown
  return { calories: Math.round(total.kcal), protein_g: Math.round(total.protein), carbs_g: Math.round(total.carbs), fat_g: Math.round(total.fat) };
}

const r = (
  id: string, name: string, types: MealType[], cuisine: string, diet: Diet, prep: number,
  contains: Allergen[], ingredients: Ingredient[], steps: string[],
): Recipe => {
  const items = ingredients.map(([item, quantity, grams, opt]) => ({ item, quantity, grams, ...(opt ? { optional: true as const } : {}) }));
  return { id, name, types, cuisine, diet, prep_time_min: prep, ...nutritionOf(items), contains, ingredients: items, steps };
};

export const RECIPES: Recipe[] = [
  // ---------- Breakfast ----------
  r("pb-overnight-oats", "Peanut butter overnight oats", ["breakfast"], "American", "vegan", 5, ["gluten", "soy", "peanut"], [
    ["oats", "60 g", 60], ["soy milk", "200 ml", 206], ["peanut butter", "1 tbsp", 16], ["chia seeds", "1 tbsp", 12], ["banana", "½, sliced", 59],
  ], [
    "Stir the oats, soy milk and chia seeds together in a jar.",
    "Swirl in the peanut butter, cover and leave in the fridge overnight.",
    "Top with the banana in the morning. Eat cold or warm it for a minute.",
  ]),
  r("yogurt-berry-bowl", "Greek yogurt berry bowl", ["breakfast", "snack"], "Greek", "vegetarian", 5, ["dairy", "gluten"], [
    ["greek yogurt", "250 g, 2% fat", 250], ["mixed berries", "100 g", 100], ["oats", "30 g", 30], ["honey", "1 tsp", 7],
  ], [
    "Spoon the yogurt into a bowl.",
    "Top with the berries and oats.",
    "Drizzle with honey.",
  ]),
  r("veggie-scramble-toast", "Veggie egg scramble on toast", ["breakfast"], "American", "vegetarian", 10, ["egg", "gluten"], [
    ["eggs", "3", 150], ["spinach", "1 handful", 30], ["cherry tomatoes", "6, halved", 60], ["wholegrain bread", "1 slice", 32], ["olive oil", "1 tsp", 4.5],
  ], [
    "Warm the oil in a pan and wilt the spinach and tomatoes for 2 minutes.",
    "Beat the eggs, pour them in and stir gently over low heat until just set.",
    "Serve on the toast.",
  ]),
  r("tofu-scramble-wrap", "Tofu scramble wrap", ["breakfast", "lunch"], "Mexican", "vegan", 15, ["soy", "gluten"], [
    ["tofu", "150 g, firm", 150], ["wholewheat tortilla", "1 large", 60], ["bell pepper", "½, diced", 60], ["onion", "¼, diced", 28],
    ["turmeric", "½ tsp", 1.5, OPTIONAL], ["olive oil", "1 tsp", 4.5],
  ], [
    "Fry the onion and pepper in the oil for 3 minutes.",
    "Crumble in the tofu, add the turmeric and a pinch of salt, and cook for 5 minutes.",
    "Warm the tortilla, fill with the scramble and roll up.",
  ]),
  r("banana-oat-pancakes", "Banana oat pancakes", ["breakfast"], "American", "vegetarian", 20, ["gluten", "egg", "dairy"], [
    ["oats", "50 g", 50], ["banana", "1", 118], ["eggs", "2", 100], ["greek yogurt", "100 g, to serve", 100],
  ], [
    "Blend the oats, banana and eggs into a smooth batter.",
    "Cook small pancakes in a non-stick pan, about 2 minutes each side.",
    "Serve with the yogurt on top.",
  ]),
  r("masala-omelette", "Masala omelette with roti", ["breakfast"], "Indian", "vegetarian", 15, ["egg", "gluten"], [
    ["eggs", "3", 150], ["onion", "¼, finely chopped", 28], ["tomato", "½, chopped", 60], ["green chilli", "½, chopped", 5],
    ["coriander", "a few sprigs", 3, OPTIONAL], ["olive oil", "1 tsp", 4.5], ["wholewheat roti", "1", 43],
  ], [
    "Beat the eggs with the onion, tomato, chilli, coriander and a pinch of salt.",
    "Pour into a hot oiled pan and cook until the bottom sets, then fold over.",
    "Serve with a warm roti.",
  ]),
  r("poha", "Poha (flattened rice with peas)", ["breakfast"], "Indian", "vegan", 20, ["peanut"], [
    ["poha", "60 g, flattened rice", 60], ["peas", "50 g", 50], ["peanuts", "15 g", 15], ["onion", "½, chopped", 55],
    ["turmeric", "½ tsp", 1.5, OPTIONAL], ["olive oil", "1 tsp", 4.5], ["lemon", "½", 24, OPTIONAL],
  ], [
    "Rinse the poha in a sieve until soft, then let it drain.",
    "Fry the peanuts and onion in the oil, add the peas and turmeric and cook for 3 minutes.",
    "Stir in the poha, heat through, and finish with lemon juice.",
  ]),
  r("salmon-bagel", "Smoked salmon bagel", ["breakfast", "lunch"], "American", "pescatarian", 5, ["gluten", "dairy", "fish"], [
    ["wholegrain bagel", "1", 86], ["light cream cheese", "30 g", 30], ["smoked salmon", "60 g", 60], ["cucumber", "a few slices", 30], ["capers", "1 tsp", 3, OPTIONAL],
  ], [
    "Toast the bagel.",
    "Spread with cream cheese.",
    "Top with salmon, cucumber and capers.",
  ]),
  r("cottage-cheese-toast", "Cottage cheese and tomato toast", ["breakfast", "snack"], "American", "vegetarian", 5, ["gluten", "dairy"], [
    ["wholegrain bread", "2 slices", 64], ["cottage cheese", "150 g", 150], ["tomato", "1, sliced", 123], ["olive oil", "a drizzle", 5],
  ], [
    "Toast the bread.",
    "Spread the cottage cheese on top and add the tomato slices.",
    "Finish with a drizzle of oil, salt and black pepper.",
  ]),
  r("avocado-toast", "Smashed avocado toast", ["breakfast", "lunch", "snack"], "American", "vegan", 5, ["gluten"], [
    ["wholegrain bread", "2 slices", 64], ["avocado", "½", 68], ["lemon", "a squeeze", 5, OPTIONAL], ["sea salt", "a pinch", 0.4, OPTIONAL],
    ["chilli flakes", "a pinch", 0.3, OPTIONAL],
  ], [
    "Toast the bread.",
    "Mash the avocado with a fork, with a squeeze of lemon and a pinch of salt if you have them.",
    "Spread it on the toast and add chilli flakes if you like.",
  ]),
  r("avocado-egg-toast", "Avocado and egg toast", ["breakfast", "lunch"], "American", "vegetarian", 10, ["gluten", "egg"], [
    ["wholegrain bread", "2 slices", 64], ["avocado", "½", 68], ["eggs", "2", 100], ["sea salt", "a pinch", 0.4, OPTIONAL],
  ], [
    "Fry, poach or boil the eggs the way you like them.",
    "Toast the bread and mash the avocado on top.",
    "Add the eggs and a pinch of salt and pepper.",
  ]),
  r("besan-chilla", "Chickpea flour pancakes (chilla)", ["breakfast", "lunch"], "Indian", "vegan", 15, [], [
    ["chickpea flour", "60 g", 60], ["onion", "¼, finely chopped", 28], ["tomato", "½, finely chopped", 60], ["spinach", "1 handful, chopped", 30],
    ["olive oil", "2 tsp", 9],
  ], [
    "Whisk the chickpea flour with about 100 ml water and a pinch of salt into a pouring batter.",
    "Stir in the onion, tomato and spinach.",
    "Cook thin pancakes in an oiled pan, 2 to 3 minutes each side.",
  ]),
  r("bean-breakfast-burrito", "Black bean breakfast burrito", ["breakfast"], "Mexican", "vegetarian", 15, ["gluten", "egg", "dairy"], [
    ["wholewheat tortilla", "1 large", 60], ["eggs", "2", 100], ["black beans", "80 g", 80], ["cheddar", "20 g, grated", 20], ["salsa", "2 tbsp", 36],
  ], [
    "Scramble the eggs in a non-stick pan.",
    "Warm the beans, then pile beans, eggs, cheese and salsa onto the tortilla.",
    "Roll up tightly and toast seam-side down for a minute.",
  ]),
  r("mango-chia-pudding", "Mango chia pudding", ["breakfast", "snack"], "American", "vegan", 5, ["soy"], [
    ["chia seeds", "30 g", 30], ["soy milk", "250 ml", 257], ["mango", "100 g, diced", 100],
  ], [
    "Stir the chia seeds into the soy milk and wait 5 minutes, then stir again.",
    "Cover and leave in the fridge overnight.",
    "Top with the mango.",
  ]),
  r("turkey-egg-muffin", "Turkey sausage and egg muffin", ["breakfast"], "American", "meat", 15, ["gluten", "egg", "dairy"], [
    ["english muffin", "1, wholemeal", 66], ["egg", "1", 50], ["turkey sausage", "1 patty, 60 g", 60], ["cheese slice", "1", 21],
  ], [
    "Cook the sausage patty in a pan, about 4 minutes each side.",
    "Fry the egg in the same pan and toast the muffin.",
    "Stack the patty, egg and cheese in the muffin.",
  ]),

  // ---------- Lunch ----------
  r("chickpea-quinoa-salad", "Chickpea and quinoa salad", ["lunch"], "Mediterranean", "vegetarian", 15, ["dairy"], [
    ["quinoa", "150 g, cooked", 150], ["chickpeas", "120 g", 120], ["cucumber", "½, diced", 150], ["cherry tomatoes", "8, halved", 80],
    ["red onion", "¼, sliced", 28], ["feta", "40 g", 40], ["olive oil", "1 tbsp", 13.5], ["lemon", "½", 24, OPTIONAL],
  ], [
    "Mix the quinoa, chickpeas and vegetables in a bowl.",
    "Whisk the oil with the lemon juice, salt and pepper and pour over.",
    "Crumble the feta on top.",
  ]),
  r("chicken-burrito-bowl", "Chicken burrito bowl", ["lunch", "dinner"], "Mexican", "meat", 25, [], [
    ["chicken breast", "150 g", 150], ["brown rice", "150 g, cooked", 150], ["black beans", "80 g", 80], ["sweetcorn", "50 g", 50],
    ["avocado", "¼", 34], ["lettuce", "1 handful", 20], ["salsa", "2 tbsp", 36],
  ], [
    "Season the chicken with cumin, paprika and salt, then pan-fry for 6 to 7 minutes each side until cooked through.",
    "Warm the rice, beans and corn.",
    "Slice the chicken and build the bowl with lettuce, avocado and salsa.",
  ]),
  r("tuna-sandwich", "Tuna salad sandwich", ["lunch"], "American", "pescatarian", 10, ["gluten", "fish", "dairy"], [
    ["wholegrain bread", "2 slices", 64], ["tuna", "1 can, drained", 110], ["greek yogurt", "2 tbsp", 30], ["celery", "1 stick, diced", 40],
    ["lettuce", "a few leaves", 15], ["mustard", "1 tsp", 5],
  ], [
    "Mix the tuna, yogurt, celery and mustard with some black pepper.",
    "Spread onto one slice of bread and add the lettuce.",
    "Top with the second slice and cut in half.",
  ]),
  r("lentil-soup", "Red lentil soup", ["lunch", "dinner"], "Middle Eastern", "vegan", 30, [], [
    ["red lentils", "80 g, dry", 80], ["carrot", "1, diced", 61], ["onion", "½, diced", 55], ["vegetable stock", "500 ml", 500],
    ["cumin", "1 tsp", 2.1, OPTIONAL], ["olive oil", "1 tsp", 4.5], ["lemon", "½", 24, OPTIONAL],
  ], [
    "Soften the onion and carrot in the oil for 5 minutes, then add the cumin.",
    "Add the lentils and stock and simmer for 20 minutes until soft.",
    "Blend until smooth and finish with lemon juice.",
  ]),
  r("paneer-tikka-wrap", "Paneer tikka wrap", ["lunch"], "Indian", "vegetarian", 20, ["dairy", "gluten"], [
    ["paneer", "100 g, cubed", 100], ["yogurt", "50 g", 50], ["tikka spice", "1 tsp", 2.5], ["wholewheat tortilla", "1 large", 60],
    ["bell pepper", "½, sliced", 60], ["onion", "¼, sliced", 28], ["mint chutney", "1 tbsp", 15, OPTIONAL],
  ], [
    "Coat the paneer in the yogurt and tikka spice.",
    "Fry the paneer, pepper and onion in a hot pan until charred at the edges.",
    "Fill the warmed tortilla, add the chutney and roll up.",
  ]),
  r("teriyaki-salmon-bowl", "Teriyaki salmon rice bowl", ["lunch", "dinner"], "Japanese", "pescatarian", 25, ["fish", "soy", "gluten", "sesame"], [
    ["salmon fillet", "130 g", 130], ["rice", "150 g, cooked", 150], ["broccoli", "100 g", 100], ["teriyaki sauce", "1 tbsp", 18], ["sesame seeds", "1 tsp", 3, OPTIONAL],
  ], [
    "Bake the salmon at 200°C (400°F) for 12 minutes, brushing with teriyaki sauce halfway.",
    "Steam the broccoli for 4 minutes and warm the rice.",
    "Serve the salmon over the rice and broccoli, sprinkled with sesame seeds.",
  ]),
  r("falafel-pita", "Hummus and falafel pita", ["lunch"], "Middle Eastern", "vegan", 15, ["gluten", "sesame"], [
    ["pita", "1 wholemeal", 64], ["falafel", "4 baked", 68], ["hummus", "50 g", 50], ["cucumber", "a few slices", 30], ["tomato", "½, sliced", 60],
    ["lettuce", "1 handful", 20],
  ], [
    "Warm the falafel in the oven or air fryer.",
    "Warm the pita and spread the inside with hummus.",
    "Stuff with the falafel and salad.",
  ]),
  r("turkey-avocado-wrap", "Turkey and avocado wrap", ["lunch"], "American", "meat", 10, ["gluten"], [
    ["wholewheat tortilla", "1 large", 60], ["turkey slices", "100 g", 100], ["avocado", "¼, sliced", 34], ["spinach", "1 handful", 30],
    ["tomato", "½, sliced", 60], ["mustard", "1 tsp", 5],
  ], [
    "Spread the mustard over the tortilla.",
    "Layer the turkey, avocado, spinach and tomato.",
    "Roll up tightly and cut in half.",
  ]),
  r("egg-fried-rice", "Vegetable egg fried rice", ["lunch", "dinner"], "Chinese", "vegetarian", 20, ["egg", "soy", "gluten", "sesame"], [
    ["rice", "200 g, cooked and cooled", 200], ["eggs", "2", 100], ["peas and carrots", "100 g, frozen", 100], ["soy sauce", "1 tbsp", 16],
    ["sesame oil", "1 tsp", 4.5], ["spring onion", "2, sliced", 30, OPTIONAL],
  ], [
    "Heat the sesame oil in a wok and cook the peas and carrots for 2 minutes.",
    "Push them aside, scramble the eggs, then add the rice and stir-fry for 3 minutes.",
    "Add the soy sauce and spring onion and toss well.",
  ]),
  r("chicken-caesar", "Light chicken Caesar salad", ["lunch"], "American", "meat", 20, ["dairy", "gluten", "egg", "fish"], [
    ["chicken breast", "120 g", 120], ["romaine lettuce", "1 small head", 150], ["parmesan", "15 g, shaved", 15], ["croutons", "20 g", 20],
    ["caesar dressing", "2 tbsp, light (has anchovy and egg)", 30],
  ], [
    "Grill or pan-fry the chicken for 6 to 7 minutes each side, then slice.",
    "Toss the lettuce with the dressing.",
    "Top with chicken, croutons and parmesan.",
  ]),
  r("sweet-potato-tacos", "Black bean and sweet potato tacos", ["lunch", "dinner"], "Mexican", "vegan", 25, [], [
    ["corn tortillas", "2", 48], ["sweet potato", "150 g, cubed", 150], ["black beans", "100 g", 100], ["avocado", "⅕", 27], ["cabbage", "1 handful, shredded", 30],
    ["lime", "½", 22, OPTIONAL], ["salsa", "2 tbsp", 36],
  ], [
    "Roast the sweet potato with chilli powder and salt at 200°C (400°F) for 20 minutes.",
    "Warm the beans and the tortillas.",
    "Fill the tortillas with sweet potato, beans, cabbage, avocado and salsa, and squeeze over the lime.",
  ]),
  r("peanut-tofu-noodles", "Peanut tofu noodle bowl", ["lunch", "dinner"], "Thai", "vegan", 20, ["peanut", "soy", "gluten"], [
    ["rice noodles", "70 g, dry", 70], ["tofu", "120 g, firm", 120], ["peanut butter", "1 tbsp", 16], ["soy sauce", "1 tbsp", 16],
    ["cucumber", "½, cut in sticks", 150], ["carrot", "1, grated", 61], ["lime", "½", 22, OPTIONAL],
  ], [
    "Cook the noodles, then rinse in cold water.",
    "Pan-fry the tofu cubes until golden. Whisk the peanut butter, soy sauce, lime juice and a splash of hot water into a sauce.",
    "Toss the noodles and vegetables in the sauce and top with the tofu.",
  ]),
  r("caprese-pasta-salad", "Caprese pasta salad", ["lunch"], "Italian", "vegetarian", 20, ["gluten", "dairy"], [
    ["wholewheat pasta", "150 g, cooked", 150], ["mozzarella", "60 g", 60], ["cherry tomatoes", "8, halved", 80], ["basil", "a few leaves", 2, OPTIONAL],
    ["olive oil", "2 tsp", 9], ["balsamic vinegar", "1 tsp", 5, OPTIONAL],
  ], [
    "Cook the pasta, then cool it under cold water.",
    "Toss with the tomatoes, torn mozzarella and basil.",
    "Dress with the oil, vinegar, salt and pepper.",
  ]),
  r("shrimp-avocado-salad", "Shrimp and avocado salad", ["lunch"], "Mexican", "pescatarian", 15, ["shellfish"], [
    ["shrimp", "150 g, cooked", 150], ["avocado", "⅓, diced", 45], ["mixed greens", "2 handfuls", 40], ["sweetcorn", "50 g", 50],
    ["lime", "½", 22, OPTIONAL], ["olive oil", "1 tsp", 4.5],
  ], [
    "Toss the greens and corn in a bowl.",
    "Add the shrimp and avocado.",
    "Dress with the lime juice, oil and a pinch of chilli.",
  ]),
  r("rajma-rice", "Rajma (kidney bean curry) with rice", ["lunch", "dinner"], "Indian", "vegan", 30, [], [
    ["kidney beans", "150 g", 150], ["rice", "150 g, cooked", 150], ["tomato", "2, chopped", 246], ["onion", "½, chopped", 55],
    ["garam masala", "1 tsp", 2], ["olive oil", "2 tsp", 9],
  ], [
    "Fry the onion in the oil until golden, then add the garam masala and tomatoes and cook for 5 minutes.",
    "Add the beans and a splash of water and simmer for 15 minutes, mashing a few beans to thicken.",
    "Serve over the rice.",
  ]),

  // ---------- Dinner ----------
  r("chicken-tikka-masala", "Lighter chicken tikka masala", ["dinner"], "Indian", "meat", 35, ["dairy"], [
    ["chicken breast", "150 g, cubed", 150], ["yogurt", "60 g", 60], ["tomato passata", "150 g", 150], ["onion", "½, chopped", 55],
    ["tikka spice", "1 tbsp", 7], ["olive oil", "1 tsp", 4.5], ["rice", "150 g, cooked", 150],
  ], [
    "Coat the chicken in half the yogurt and the spice.",
    "Fry the onion in the oil, add the chicken and brown it, then add the passata and simmer for 15 minutes.",
    "Take off the heat, stir in the rest of the yogurt and serve with the rice.",
  ]),
  r("salmon-potatoes", "Baked salmon with potatoes and green beans", ["dinner"], "American", "pescatarian", 30, ["fish"], [
    ["salmon fillet", "150 g", 150], ["baby potatoes", "200 g", 200], ["green beans", "100 g", 100], ["olive oil", "1 tsp", 4.5], ["lemon", "½", 24, OPTIONAL],
  ], [
    "Halve the potatoes, toss in the oil and roast at 200°C (400°F) for 15 minutes.",
    "Add the salmon and green beans to the tray and roast for 12 more minutes.",
    "Squeeze the lemon over before serving.",
  ]),
  r("beef-broccoli", "Beef and broccoli stir-fry", ["dinner"], "Chinese", "meat", 25, ["beef", "soy", "gluten"], [
    ["lean beef strips", "130 g", 130], ["broccoli", "150 g", 150], ["rice", "150 g, cooked", 150], ["soy sauce", "1 tbsp", 16],
    ["garlic", "1 clove", 3, OPTIONAL], ["ginger", "1 tsp, grated", 2, OPTIONAL], ["cornflour", "1 tsp", 2.7], ["olive oil", "1 tsp", 4.5],
  ], [
    "Toss the beef in the cornflour, then sear it in the hot oil for 2 minutes and set aside.",
    "Stir-fry the broccoli, garlic and ginger with a splash of water for 3 minutes.",
    "Return the beef, add the soy sauce, toss and serve with the rice.",
  ]),
  r("chana-saag", "Chickpea and spinach curry", ["dinner", "lunch"], "Indian", "vegan", 30, [], [
    ["chickpeas", "200 g", 200], ["spinach", "100 g", 100], ["tomato", "1, chopped", 123], ["onion", "½, chopped", 55], ["light coconut milk", "60 ml", 60],
    ["curry powder", "1 tbsp", 6.3], ["olive oil", "1 tsp", 4.5], ["rice", "100 g, cooked", 100],
  ], [
    "Fry the onion in the oil, add the curry powder and tomato and cook for 3 minutes.",
    "Add the chickpeas and coconut milk and simmer for 10 minutes.",
    "Stir in the spinach until wilted and serve with the rice.",
  ]),
  r("turkey-meatball-spaghetti", "Turkey meatballs with spaghetti", ["dinner"], "Italian", "meat", 35, ["gluten", "dairy", "egg"], [
    ["turkey mince", "130 g, lean", 130], ["breadcrumbs", "15 g", 15], ["egg", "½, beaten", 25], ["wholewheat spaghetti", "75 g, dry", 75],
    ["tomato passata", "150 g", 150], ["parmesan", "10 g", 10],
  ], [
    "Mix the turkey, breadcrumbs, egg and a pinch of salt and roll into 6 meatballs.",
    "Brown them in a pan, add the passata and simmer for 15 minutes.",
    "Cook the spaghetti, then serve with the meatballs and sauce and top with parmesan.",
  ]),
  r("tofu-green-curry", "Tofu and vegetable green curry", ["dinner"], "Thai", "vegan", 30, ["soy"], [
    ["tofu", "150 g, firm", 150], ["light coconut milk", "100 ml", 100], ["green curry paste", "1 tbsp, vegan", 15], ["mixed vegetables", "150 g", 150],
    ["rice", "150 g, cooked", 150],
  ], [
    "Fry the curry paste for a minute, then add the coconut milk and 50 ml water.",
    "Add the vegetables and tofu cubes and simmer for 10 minutes.",
    "Serve over the rice.",
  ]),
  r("shrimp-tacos", "Shrimp tacos with lime slaw", ["dinner"], "Mexican", "pescatarian", 20, ["shellfish", "dairy"], [
    ["shrimp", "150 g, raw", 150], ["corn tortillas", "3", 72], ["cabbage", "1 handful, shredded", 30], ["yogurt", "40 g", 40],
    ["avocado", "⅕", 27], ["lime", "1", 44, OPTIONAL],
  ], [
    "Season the shrimp with chilli and cook in a hot pan for 2 minutes each side.",
    "Mix the cabbage with the yogurt and half the lime juice.",
    "Fill the warm tortillas with slaw, shrimp and avocado, and squeeze over the rest of the lime.",
  ]),
  r("lentil-bolognese", "Lentil bolognese", ["dinner"], "Italian", "vegan", 35, ["gluten"], [
    ["brown lentils", "150 g, cooked", 150], ["wholewheat spaghetti", "75 g, dry", 75], ["tomato passata", "200 g", 200], ["carrot", "1, diced", 61],
    ["onion", "½, diced", 55], ["olive oil", "1 tsp", 4.5],
  ], [
    "Soften the onion and carrot in the oil for 5 minutes.",
    "Add the lentils and passata and simmer for 15 minutes.",
    "Cook the spaghetti and serve with the sauce.",
  ]),
  r("chicken-fajitas", "Chicken fajitas", ["dinner"], "Mexican", "meat", 25, ["gluten", "dairy"], [
    ["chicken breast", "140 g, sliced", 140], ["bell pepper", "1, sliced", 120], ["onion", "½, sliced", 55], ["small tortillas", "2 wholewheat", 60],
    ["fajita spice", "1 tbsp", 7], ["olive oil", "1 tsp", 4.5], ["greek yogurt", "30 g", 30], ["salsa", "2 tbsp", 36],
  ], [
    "Toss the chicken and vegetables in the oil and spice.",
    "Cook in a very hot pan for 8 to 10 minutes until the chicken is cooked through.",
    "Serve in the warm tortillas with yogurt and salsa.",
  ]),
  r("pork-pineapple-stirfry", "Pork and pineapple stir-fry", ["dinner"], "Chinese", "meat", 25, ["pork", "soy", "gluten"], [
    ["pork tenderloin", "130 g, sliced", 130], ["pineapple", "80 g, chunks", 80], ["bell pepper", "1, sliced", 120], ["rice", "150 g, cooked", 150],
    ["soy sauce", "1 tbsp", 16], ["olive oil", "1 tsp", 4.5],
  ], [
    "Stir-fry the pork in the hot oil for 4 minutes until cooked through.",
    "Add the pepper and pineapple and cook for 3 minutes.",
    "Add the soy sauce and serve with the rice.",
  ]),
  r("stuffed-peppers", "Bean and rice stuffed peppers", ["dinner"], "Mexican", "vegetarian", 40, ["dairy"], [
    ["bell peppers", "2, halved", 240], ["brown rice", "100 g, cooked", 100], ["black beans", "100 g", 100], ["tomato", "1, chopped", 123],
    ["cheddar", "30 g, grated", 30], ["cumin", "1 tsp", 2.1, OPTIONAL],
  ], [
    "Mix the rice, beans, tomato and cumin.",
    "Fill the pepper halves, top with the cheese and cover with foil.",
    "Bake at 190°C (375°F) for 25 minutes, then uncover for 5.",
  ]),
  r("cod-couscous", "Cod with Mediterranean vegetables and couscous", ["dinner"], "Mediterranean", "pescatarian", 30, ["fish", "gluten"], [
    ["cod fillet", "170 g", 170], ["couscous", "60 g, dry", 60], ["courgette", "½, sliced", 100], ["bell pepper", "½, sliced", 60],
    ["cherry tomatoes", "6", 60], ["olives", "5", 22], ["olive oil", "1 tsp", 4.5],
  ], [
    "Roast the vegetables and olives in the oil at 200°C (400°F) for 15 minutes.",
    "Add the cod to the tray and roast for 10 to 12 more minutes.",
    "Pour boiling water over the couscous, cover for 5 minutes, fluff and serve.",
  ]),
  r("dal-tadka", "Dal tadka with brown rice", ["dinner", "lunch"], "Indian", "vegetarian", 35, ["dairy"], [
    ["yellow lentils", "70 g, dry", 70], ["brown rice", "150 g, cooked", 150], ["ghee", "1 tsp", 4.5], ["tomato", "1, chopped", 123],
    ["garlic", "2 cloves, sliced", 6, OPTIONAL], ["cumin seeds", "1 tsp", 2.1],
  ], [
    "Simmer the lentils in 400 ml water with a pinch of turmeric for 25 minutes until soft.",
    "Heat the ghee, fry the cumin and garlic until golden, then add the tomato for 2 minutes.",
    "Pour this over the dal and serve with the rice.",
  ]),
  r("bulgogi-bowl", "Korean-style beef rice bowl", ["dinner"], "Korean", "meat", 20, ["beef", "soy", "gluten", "sesame"], [
    ["beef mince", "120 g, lean", 120], ["rice", "150 g, cooked", 150], ["soy sauce", "1 tbsp", 16], ["sesame oil", "1 tsp", 4.5],
    ["garlic", "1 clove", 3, OPTIONAL], ["spinach", "1 handful", 30], ["carrot", "1, grated", 61],
  ], [
    "Brown the beef with the garlic, then add the soy sauce and a pinch of sugar.",
    "Wilt the spinach in the same pan.",
    "Serve over the rice with the carrot, and drizzle with the sesame oil.",
  ]),
  r("beef-burger", "Burger with avocado", ["lunch", "dinner"], "American", "meat", 15, ["beef", "gluten"], [
    ["beef burger patty", "1, about 110 g lean", 110], ["burger bun", "1 wholemeal (or 2 slices of bread)", 56], ["avocado", "¼, sliced", 34, OPTIONAL],
    ["lettuce", "a few leaves", 15, OPTIONAL], ["tomato", "a few slices", 40, OPTIONAL],
  ], [
    "Cook the patty in a hot pan or under the grill for 4 to 5 minutes each side, until cooked through with no pink inside.",
    "Toast the bun or bread.",
    "Build the burger with whatever toppings you have: avocado, lettuce and tomato.",
  ]),
  r("veggie-burger", "Veggie burger", ["lunch", "dinner"], "American", "vegan", 15, ["gluten", "soy"], [
    ["veggie burger patty", "1", 70], ["burger bun", "1 wholemeal (or 2 slices of bread)", 56], ["avocado", "¼, sliced", 34, OPTIONAL],
    ["lettuce", "a few leaves", 15, OPTIONAL], ["tomato", "a few slices", 40, OPTIONAL],
  ], [
    "Cook the patty as the packet says, usually 4 to 5 minutes each side in a pan or oven.",
    "Toast the bun or bread.",
    "Add whatever toppings you have. Check the patty's label if you avoid soy, gluten or dairy.",
  ]),
  r("halloumi-traybake", "Halloumi and roasted vegetable traybake", ["dinner"], "Mediterranean", "vegetarian", 35, ["dairy"], [
    ["halloumi", "80 g, sliced", 80], ["sweet potato", "150 g, cubed", 150], ["bell pepper", "1, chopped", 120], ["red onion", "½, wedges", 55],
    ["chickpeas", "80 g", 80], ["olive oil", "1 tsp", 4.5],
  ], [
    "Toss the sweet potato, pepper, onion and chickpeas in the oil and roast at 200°C (400°F) for 20 minutes.",
    "Add the halloumi slices on top.",
    "Roast for 10 more minutes until the halloumi is golden.",
  ]),

  // ---------- Snacks ----------
  r("apple-pb", "Apple with peanut butter", ["snack"], "American", "vegan", 2, ["peanut"], [
    ["apple", "1", 182], ["peanut butter", "1½ tbsp", 24],
  ], ["Slice the apple.", "Dip in the peanut butter."]),
  r("yogurt-walnuts", "Greek yogurt with honey and walnuts", ["snack"], "Greek", "vegetarian", 2, ["dairy", "tree_nut"], [
    ["greek yogurt", "170 g", 170], ["honey", "1 tsp", 7], ["walnuts", "10 g", 10],
  ], ["Spoon the yogurt into a bowl.", "Top with the walnuts and drizzle with honey."]),
  r("hummus-veg", "Hummus with veggie sticks", ["snack"], "Middle Eastern", "vegan", 5, ["sesame"], [
    ["hummus", "60 g", 60], ["carrot", "1, in sticks", 61], ["cucumber", "½, in sticks", 150], ["bell pepper", "½, in strips", 60],
  ], ["Cut the vegetables into sticks.", "Serve with the hummus for dipping."]),
  r("roasted-chickpeas", "Crunchy roasted chickpeas", ["snack"], "Mediterranean", "vegan", 30, [], [
    ["chickpeas", "120 g, drained and dried", 120], ["olive oil", "1 tsp", 4.5], ["smoked paprika", "½ tsp", 1.2, OPTIONAL],
  ], [
    "Toss the chickpeas with the oil, paprika and salt.",
    "Roast at 200°C (400°F) for 25 minutes, shaking halfway, until crunchy.",
    "Let them cool for a few minutes to crisp up.",
  ]),
  r("edamame", "Edamame with sea salt", ["snack"], "Japanese", "vegan", 5, ["soy"], [
    ["edamame", "120 g, shelled", 120], ["sea salt", "a pinch", 0.4],
  ], ["Boil or microwave the edamame for 3 to 4 minutes.", "Drain and sprinkle with salt."]),
  r("cottage-pineapple", "Cottage cheese with pineapple", ["snack"], "American", "vegetarian", 2, ["dairy"], [
    ["cottage cheese", "150 g", 150], ["pineapple", "80 g, chunks", 80],
  ], ["Spoon the cottage cheese into a bowl.", "Top with the pineapple."]),
  r("eggs-tomatoes", "Boiled eggs and cherry tomatoes", ["snack"], "American", "vegetarian", 12, ["egg"], [
    ["eggs", "2", 100], ["cherry tomatoes", "100 g", 100],
  ], [
    "Boil the eggs for 9 minutes, then cool them in cold water.",
    "Peel, halve and season with salt and pepper.",
    "Serve with the tomatoes.",
  ]),
  r("banana-smoothie", "Banana protein smoothie", ["snack", "breakfast"], "American", "vegetarian", 5, ["dairy", "gluten"], [
    ["banana", "1", 118], ["milk", "250 ml, semi-skimmed", 258], ["greek yogurt", "100 g", 100], ["oats", "20 g", 20],
  ], ["Put everything in a blender.", "Blend until smooth, adding ice if you like it cold."]),
  r("tuna-rice-cakes", "Tuna and cucumber rice cakes", ["snack"], "American", "pescatarian", 5, ["fish", "dairy"], [
    ["rice cakes", "2", 18], ["tuna", "80 g, drained", 80], ["light cream cheese", "20 g", 20], ["cucumber", "a few slices", 30],
  ], ["Spread the cream cheese on the rice cakes.", "Top with the tuna and cucumber, and add black pepper."]),
  r("trail-mix", "Almond and seed trail mix", ["snack"], "American", "vegan", 1, ["tree_nut"], [
    ["almonds", "15 g", 15], ["pumpkin seeds", "10 g", 10], ["raisins", "15 g", 15],
  ], ["Mix everything together.", "Keep a small tub ready for busy days."]),
  // ---------- Everyday staples: simple dishes from what most kitchens have ----------
  r("banana-porridge", "Banana oat porridge", ["breakfast"], "American", "vegetarian", 10, ["gluten", "dairy"], [
    ["oats", "50 g", 50], ["milk", "250 ml", 258], ["banana", "½, sliced", 59, OPTIONAL], ["honey", "1 tsp", 7, OPTIONAL],
  ], [
    "Simmer the oats and milk in a small pan for 4 to 5 minutes, stirring, until creamy.",
    "Top with banana and a drizzle of honey if you have them.",
  ]),
  r("pb-banana-toast", "Peanut butter banana toast", ["breakfast", "snack"], "American", "vegan", 5, ["gluten", "peanut"], [
    ["wholegrain bread", "2 slices", 64], ["peanut butter", "1 tbsp", 16], ["banana", "½, sliced", 59],
  ], [
    "Toast the bread and spread with peanut butter.",
    "Top with banana slices and a pinch of cinnamon if you like.",
  ]),
  r("eggs-on-toast", "Scrambled eggs on toast", ["breakfast", "lunch"], "American", "vegetarian", 10, ["egg", "gluten"], [
    ["eggs", "2", 100], ["wholegrain bread", "1 slice", 32], ["olive oil", "1 tsp", 4.5, OPTIONAL], ["spinach", "1 handful", 30, OPTIONAL],
  ], [
    "Beat the eggs with a pinch of salt.",
    "Cook gently in a non-stick pan (with a little oil if you have it), stirring until just set. Wilt in spinach if using.",
    "Serve on the toast.",
  ]),
  r("cheese-omelette", "Cheese omelette", ["breakfast", "lunch"], "American", "vegetarian", 10, ["egg", "dairy"], [
    ["eggs", "3", 150], ["cheddar", "20 g, grated", 20], ["olive oil", "1 tsp", 4.5, OPTIONAL], ["tomato", "½, chopped", 60, OPTIONAL],
    ["spinach", "1 handful", 30, OPTIONAL],
  ], [
    "Beat the eggs and pour into a hot pan.",
    "When the bottom sets, add the cheese and any tomato or spinach to one half.",
    "Fold over and cook for another minute.",
  ]),
  r("cheese-toastie", "Cheese toastie", ["lunch", "snack"], "American", "vegetarian", 10, ["gluten", "dairy"], [
    ["wholegrain bread", "2 slices", 64], ["cheddar", "40 g, sliced", 40], ["tomato", "a few slices", 40, OPTIONAL],
  ], [
    "Put the cheese (and tomato, if using) between the bread.",
    "Toast in a dry pan over medium heat, pressing down, 3 minutes each side until golden and melted.",
  ]),
  r("hummus-toast", "Hummus toast", ["breakfast", "lunch", "snack"], "Middle Eastern", "vegan", 5, ["gluten", "sesame"], [
    ["wholegrain bread", "2 slices", 64], ["hummus", "50 g", 50], ["cucumber", "a few slices", 30, OPTIONAL], ["tomato", "a few slices", 40, OPTIONAL],
  ], [
    "Toast the bread and spread thickly with hummus.",
    "Top with cucumber or tomato if you have them.",
  ]),
  r("avocado-chickpea-toast", "Avocado and chickpea smash toast", ["breakfast", "lunch"], "American", "vegan", 10, ["gluten"], [
    ["wholegrain bread", "2 slices", 64], ["avocado", "½", 68], ["chickpeas", "80 g", 80], ["lemon", "a squeeze", 5, OPTIONAL],
    ["chilli flakes", "a pinch", 0.3, OPTIONAL],
  ], [
    "Mash the avocado and chickpeas together with a fork, with lemon if you have it.",
    "Pile onto toast and add chilli flakes if you like.",
  ]),
  r("banana-yogurt-bowl", "Banana, yogurt and oat bowl", ["breakfast", "snack"], "Greek", "vegetarian", 5, ["dairy", "gluten"], [
    ["greek yogurt", "200 g", 200], ["banana", "1, sliced", 118], ["oats", "30 g", 30, OPTIONAL], ["honey", "1 tsp", 7, OPTIONAL],
  ], [
    "Spoon the yogurt into a bowl.",
    "Top with banana, and oats and honey if you have them.",
  ]),
  r("tomato-pasta", "Simple tomato pasta", ["lunch", "dinner"], "Italian", "vegan", 20, ["gluten"], [
    ["wholewheat pasta", "150 g, cooked", 150], ["tomato passata", "150 g", 150], ["olive oil", "1 tsp", 4.5, OPTIONAL],
    ["garlic", "1 clove", 3, OPTIONAL], ["onion", "¼, chopped", 28, OPTIONAL], ["basil", "a few leaves", 2, OPTIONAL],
  ], [
    "Cook the pasta.",
    "Meanwhile, soften any onion and garlic in the oil, add the passata and simmer for 10 minutes with a pinch of salt.",
    "Toss with the pasta and add basil if you have it.",
  ]),
  r("tuna-pasta", "Tuna pasta", ["lunch", "dinner"], "Italian", "pescatarian", 15, ["gluten", "fish"], [
    ["wholewheat pasta", "150 g, cooked", 150], ["tuna", "1 can, drained", 110], ["tomato passata", "100 g", 100, OPTIONAL],
    ["sweetcorn", "50 g", 50, OPTIONAL], ["olive oil", "1 tsp", 4.5, OPTIONAL],
  ], [
    "Cook the pasta.",
    "Warm the tuna with the passata and corn if using, or just toss the tuna through with a little oil.",
    "Mix with the pasta and season with pepper.",
  ]),
  r("chicken-rice", "Chicken and rice bowl", ["lunch", "dinner"], "American", "meat", 25, [], [
    ["chicken breast", "150 g", 150], ["rice", "150 g, cooked", 150], ["broccoli", "100 g", 100, OPTIONAL],
    ["olive oil", "1 tsp", 4.5, OPTIONAL], ["lemon", "½", 24, OPTIONAL],
  ], [
    "Season the chicken and pan-fry for 6 to 7 minutes each side until cooked through, then slice.",
    "Steam any broccoli and warm the rice.",
    "Serve together with a squeeze of lemon if you have it.",
  ]),
  r("salmon-rice", "Salmon and rice", ["lunch", "dinner"], "Japanese", "pescatarian", 20, ["fish"], [
    ["salmon fillet", "130 g", 130], ["rice", "150 g, cooked", 150], ["broccoli", "100 g", 100, OPTIONAL], ["lemon", "½", 24, OPTIONAL],
  ], [
    "Bake the salmon at 200°C (400°F) for 12 minutes, or pan-fry skin side down for 4 minutes each side.",
    "Serve with the rice and any broccoli, and lemon if you have it.",
  ]),
  r("rice-and-beans", "Rice and beans", ["lunch", "dinner"], "Mexican", "vegan", 15, [], [
    ["rice", "150 g, cooked", 150], ["black beans", "120 g", 120], ["onion", "¼, chopped", 28, OPTIONAL],
    ["salsa", "2 tbsp", 36, OPTIONAL], ["cumin", "½ tsp", 1, OPTIONAL], ["olive oil", "1 tsp", 4.5, OPTIONAL],
  ], [
    "Soften any onion in the oil, then add the beans (and cumin) and warm through.",
    "Serve over the rice, with salsa if you have it.",
  ]),
  r("bean-quesadilla", "Bean and cheese quesadilla", ["lunch", "dinner"], "Mexican", "vegetarian", 10, ["gluten", "dairy"], [
    ["wholewheat tortilla", "1 large", 60], ["black beans", "80 g, mashed", 80], ["cheddar", "30 g, grated", 30], ["salsa", "2 tbsp", 36, OPTIONAL],
  ], [
    "Spread the beans over half the tortilla, add the cheese and fold over.",
    "Cook in a dry pan for 2 to 3 minutes each side until crisp and melted.",
    "Cut into wedges and serve with salsa if you have it.",
  ]),
  r("chickpea-spinach-saute", "Chickpea and spinach sauté", ["lunch", "dinner"], "Mediterranean", "vegan", 10, [], [
    ["chickpeas", "150 g", 150], ["spinach", "100 g", 100], ["tomato", "1, chopped", 123, OPTIONAL], ["garlic", "1 clove", 3, OPTIONAL],
    ["olive oil", "1 tsp", 4.5, OPTIONAL], ["lemon", "½", 24, OPTIONAL],
  ], [
    "Warm any garlic in the oil, add the chickpeas (and tomato) and cook for 4 minutes.",
    "Stir in the spinach until it wilts, season, and finish with lemon if you have it.",
  ]),
  r("spinach-tomato-rice", "Spinach and tomato rice", ["lunch", "dinner"], "Indian", "vegan", 15, [], [
    ["rice", "150 g, cooked", 150], ["spinach", "100 g", 100], ["tomato", "1, chopped", 123], ["onion", "¼, chopped", 28, OPTIONAL],
    ["cumin", "½ tsp", 1, OPTIONAL], ["olive oil", "1 tsp", 4.5, OPTIONAL],
  ], [
    "Soften any onion (and cumin) in the oil, add the tomato and cook for 3 minutes.",
    "Stir in the spinach until wilted, then fold through the rice and heat.",
  ]),
  r("veg-soy-rice", "Vegetable soy rice", ["lunch", "dinner"], "Chinese", "vegan", 15, ["soy", "gluten"], [
    ["rice", "200 g, cooked", 200], ["mixed vegetables", "150 g, frozen", 150], ["soy sauce", "1 tbsp", 16],
    ["garlic", "1 clove", 3, OPTIONAL], ["olive oil", "1 tsp", 4.5, OPTIONAL],
  ], [
    "Stir-fry the vegetables (and garlic) in the oil for 4 minutes.",
    "Add the rice and soy sauce and toss until hot.",
  ]),
  r("tofu-stirfry", "Simple tofu stir-fry", ["dinner"], "Chinese", "vegan", 20, ["soy", "gluten"], [
    ["tofu", "150 g, firm", 150], ["mixed vegetables", "150 g", 150], ["soy sauce", "1 tbsp", 16], ["rice", "150 g, cooked", 150, OPTIONAL],
    ["garlic", "1 clove", 3, OPTIONAL],
  ], [
    "Pan-fry the tofu cubes until golden, then set aside.",
    "Stir-fry the vegetables (and garlic) for 4 minutes, return the tofu and add the soy sauce.",
    "Serve on its own or over rice.",
  ]),
  r("sweet-potato-beans", "Baked sweet potato with beans", ["lunch", "dinner"], "American", "vegan", 45, [], [
    ["sweet potato", "1 medium", 250], ["black beans", "100 g", 100], ["salsa", "2 tbsp", 36, OPTIONAL], ["avocado", "¼", 34, OPTIONAL],
  ], [
    "Prick the sweet potato and bake at 200°C (400°F) for 40 minutes (or microwave for 8 to 10) until soft.",
    "Split it open and fill with warm beans, then salsa and avocado if you have them.",
  ]),
  r("egg-rice-bowl", "Fried egg rice bowl", ["lunch", "dinner"], "Korean", "vegetarian", 10, ["egg"], [
    ["rice", "200 g, cooked", 200], ["eggs", "2", 100], ["spinach", "1 handful", 30, OPTIONAL], ["olive oil", "1 tsp", 4.5, OPTIONAL],
  ], [
    "Warm the rice and wilt any spinach.",
    "Fry the eggs until the whites are set and put them on top.",
  ]),
  r("banana-date-smoothie", "Banana and date smoothie", ["breakfast", "snack"], "American", "vegetarian", 5, ["dairy", "gluten"], [
    ["banana", "1", 118], ["dates", "2, pitted", 48], ["milk", "250 ml", 258], ["oats", "20 g", 20, OPTIONAL],
  ], [
    "Put everything in a blender with a few ice cubes if you like it cold.",
    "Blend until smooth.",
  ]),
  r("dates-pb", "Dates with peanut butter", ["snack"], "Middle Eastern", "vegan", 2, ["peanut"], [
    ["dates", "3, pitted", 72], ["peanut butter", "1 tbsp", 16],
  ], [
    "Split the dates open and remove the stones.",
    "Fill each with a little peanut butter.",
  ]),
];

export const findRecipe = (id: string | null | undefined) => RECIPES.find((r) => r.id === id);
