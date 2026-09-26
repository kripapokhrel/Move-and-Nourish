import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { MealCard } from "@/components/meals/MealCard";
import { MealIdeas, type MealView } from "@/components/meals/MealIdeas";
import { Card } from "@/components/ui/Card";
import { requireUser } from "@/lib/auth/session";
import { getLatestBatch, getSavedMeals } from "@/lib/db/meals";
import { getNutritionProfile } from "@/lib/db/nutrition";
import { describeError, getFeedbackFor, isMissingSchema } from "@/lib/db/personalization";
import { getProfile } from "@/lib/db/profiles";
import { dietRules } from "@/lib/meals/diet";
import { fitOf, mealTarget } from "@/lib/meals/generator";
import type { MealType } from "@/lib/meals/library";
import { isMealType, mealTypeForHour } from "@/lib/meals/options";
import type { MealDislikeReason } from "@/lib/personalization/config";
import type { MealWithSaved } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

async function loadMeals(db: SupabaseClient, userId: string, mealType: MealType) {
  try {
    const [latest, saved] = await Promise.all([getLatestBatch(db, userId, "recommend", mealType), getSavedMeals(db, userId)]);
    return { latest, saved, needsMigration: false };
  } catch (e) {
    if (!isMissingSchema(e)) throw e;
    return { latest: [], saved: [], needsMigration: true };
  }
}

async function loadRatings(db: SupabaseClient, userId: string, ids: string[]) {
  try {
    return await getFeedbackFor(db, userId, "meal", ids);
  } catch (e) {
    if (!isMissingSchema(e)) console.error("couldn't load meal ratings", describeError(e));
    return [];
  }
}

export default async function MealsPage({ searchParams }: { searchParams: Promise<{ type?: string | string[] }> }) {
  const { supabase, userId } = await requireUser();
  const { type } = await searchParams;
  const mealType: MealType = isMealType(type) ? type : mealTypeForHour(new Date().getHours());
  const [profile, nutrition, meals] = await Promise.all([
    getProfile(supabase, userId),
    getNutritionProfile(supabase, userId),
    loadMeals(supabase, userId, mealType),
  ]);
  if (!profile) redirect("/onboarding");

  const { latest, needsMigration } = meals;
  // Saved meals that are also in the latest ideas show once, up top
  const latestIds = new Set(latest.map((m) => m.id));
  const saved = meals.saved.filter((m) => !latestIds.has(m.id));
  const feedback = await loadRatings(supabase, userId, [...latest, ...saved].map((m) => m.id));
  const ratings = new Map(feedback.map((f) => [f.target_id, f]));

  const view = (meal: MealWithSaved): MealView => {
    const f = ratings.get(meal.id);
    const type = isMealType(meal.meal_type) ? meal.meal_type : null;
    return {
      meal,
      rating: f && (f.rating === "like" || f.rating === "dislike") ? { rating: f.rating, reasons: f.reasons as MealDislikeReason[] } : null,
      // Only a positive note: per-meal numbers are a rough split of the day, not rules to hit
      fitNote: type && meal.calories !== null && meal.protein_g !== null
        && fitOf({ calories: meal.calories, protein_g: meal.protein_g }, mealTarget(nutrition, type), type).fits
        ? "Fits your daily targets"
        : null,
    };
  };

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Your kitchen"
        title="Meals"
        action={
          <Link href="/meals/fridge" className="rounded-full border border-line bg-card px-4 py-2 text-sm font-semibold hover:bg-brand-soft">
            🧊 What&apos;s in my fridge?
          </Link>
        }
      >
        Ideas that fit your diet, your restrictions and your taste.
      </PageHeader>
      {needsMigration ? (
        <Card title="One setup step">
          <p className="text-sm text-muted">
            Run <code>supabase/migrations/0005_meal_ideas.sql</code> in the Supabase SQL editor, then refresh this page.
          </p>
        </Card>
      ) : (
        <>
          <MealIdeas
            key={mealType}
            mealType={mealType}
            ideas={latest.map(view)}
            unchecked={dietRules(profile).unchecked}
            hasRestrictions={profile.dietary_restrictions.length > 0 || profile.allergies.length > 0}
          />
          <section className="space-y-3">
            <h2 className="font-semibold">Saved meals</h2>
            {saved.length === 0 && latest.every((m) => !m.saved) ? (
              <p className="text-sm text-muted">Tap ♡ Save on an idea to keep it here.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {saved.map((m) => <MealCard key={m.id} {...view(m)} />)}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
