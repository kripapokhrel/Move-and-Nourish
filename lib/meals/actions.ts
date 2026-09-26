"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { MEAL_DISLIKE_REASONS, type MealDislikeReason } from "@/lib/personalization/config";
import { MEAL_TYPES } from "./options";
import { generateFridgeIdeas, generateMealIdeas, markMade, rateMeal, setMealSaved, viewMeal } from "./service";
import type { MealType } from "./library";

export type MealActionResult = { ok: true } | { ok: false; error: string };

const id = z.uuid();
const mealTypeSchema = z.enum(MEAL_TYPES.map((m) => m.value) as [MealType, ...MealType[]]);
const reasonSchema = z.enum(MEAL_DISLIKE_REASONS.map((r) => r.value) as [MealDislikeReason, ...MealDislikeReason[]]);
const fridgeSchema = z.object({
  items: z.array(z.string().trim().min(1).max(40, "Keep each item under 40 characters")).min(1, "Add at least one thing you have").max(30, "30 items max"),
  declined: z.array(z.string().trim().min(1).max(40)).max(100).default([]),
  mealType: z.union([mealTypeSchema, z.literal("any")]),
});
const saveSchema = z.object({ mealId: id, saved: z.boolean() });
const rateSchema = z.object({ mealId: id, rating: z.enum(["like", "dislike"]).nullable(), reasons: z.array(reasonSchema).max(5).default([]) });

async function run(label: string, fn: (u: Awaited<ReturnType<typeof requireUser>>) => Promise<unknown>, refresh = true): Promise<MealActionResult> {
  const user = await requireUser();
  try {
    await fn(user);
  } catch (e) {
    console.error(`${label} failed`, e);
    const message = (e as { message?: string })?.message ?? "";
    if (/library_id|batch_id|made_at|fits_targets|personalized_because/.test(message)) {
      return { ok: false, error: "The database needs an update: run supabase/migrations/0005_meal_ideas.sql in the Supabase SQL editor." };
    }
    if (/recommendation_feedback/.test(message)) {
      return { ok: false, error: "The database needs an update: run supabase/migrations/0004_personalization.sql in the Supabase SQL editor." };
    }
    return { ok: false, error: message || "Something went wrong. Try again." };
  }
  if (refresh) revalidatePath("/", "layout");
  return { ok: true };
}

export async function generateMealsAction(rawType: unknown): Promise<MealActionResult> {
  const parsed = mealTypeSchema.safeParse(rawType);
  if (!parsed.success) return { ok: false, error: "Pick which meal you want ideas for." };
  return run("generateMeals", ({ supabase, userId }) => generateMealIdeas(supabase, userId, parsed.data));
}

/** Opening a recipe's ingredients and steps. Recorded only; nothing on screen changes. */
export async function viewMealAction(mealId: unknown): Promise<MealActionResult> {
  const parsed = id.safeParse(mealId);
  if (!parsed.success) return { ok: false, error: "Couldn't find that meal." };
  return run("viewMeal", ({ supabase, userId }) => viewMeal(supabase, userId, parsed.data), false);
}

export async function saveMealAction(raw: unknown): Promise<MealActionResult> {
  const parsed = saveSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Couldn't find that meal." };
  const { mealId, saved } = parsed.data;
  return run("saveMeal", ({ supabase, userId }) => setMealSaved(supabase, userId, mealId, saved));
}

export async function markMadeAction(mealId: unknown): Promise<MealActionResult> {
  const parsed = id.safeParse(mealId);
  if (!parsed.success) return { ok: false, error: "Couldn't find that meal." };
  return run("markMade", ({ supabase, userId }) => markMade(supabase, userId, parsed.data));
}

export async function rateMealAction(raw: unknown): Promise<MealActionResult> {
  const parsed = rateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Pick a rating." };
  const { mealId, rating, reasons } = parsed.data;
  return run("rateMeal", ({ supabase, userId }) => rateMeal(supabase, userId, mealId, rating, reasons));
}

export async function generateFridgeIdeasAction(raw: unknown): Promise<MealActionResult> {
  const parsed = fridgeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your list." };
  const { items, declined, mealType } = parsed.data;
  return run("generateFridgeIdeas", ({ supabase, userId }) => generateFridgeIdeas(supabase, userId, items, declined, mealType));
}
