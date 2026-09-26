import Link from "next/link";
import { redirect } from "next/navigation";
import { FridgeForm } from "@/components/meals/FridgeForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { MealCard } from "@/components/meals/MealCard";
import { Card } from "@/components/ui/Card";
import { requireUser } from "@/lib/auth/session";
import { getLatestBatch } from "@/lib/db/meals";
import { describeError, getFeedbackFor, isMissingSchema } from "@/lib/db/personalization";
import { getProfile } from "@/lib/db/profiles";
import { dietRules } from "@/lib/meals/diet";
import { fridgeMatch, parseFridgeInput } from "@/lib/meals/fridge";
import type { MealDislikeReason } from "@/lib/personalization/config";

export default async function FridgePage() {
  const { supabase, userId } = await requireUser();
  const profile = await getProfile(supabase, userId);
  if (!profile) redirect("/onboarding");

  let latest: Awaited<ReturnType<typeof getLatestBatch>> = [];
  let needsMigration = false;
  try {
    latest = await getLatestBatch(supabase, userId, "fridge");
  } catch (e) {
    if (!isMissingSchema(e)) throw e;
    needsMigration = true;
  }
  const ratings = new Map(
    (await getFeedbackFor(supabase, userId, "meal", latest.map((m) => m.id)).catch((e) => {
      if (!isMissingSchema(e)) console.error("couldn't load meal ratings", describeError(e));
      return [];
    })).map((f) => [f.target_id, f]),
  );
  // The list used for these ideas is saved with them, so it comes back when you return
  const input = parseFridgeInput(latest[0]?.source_input);
  const unchecked = dietRules(profile).unchecked;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Use what you have"
        title="What's in my fridge?"
        action={<Link href="/meals" className="text-sm font-semibold text-brand">← Meal ideas</Link>}
      >
        Tell us what you have and we&apos;ll only suggest recipes you can make with it.
      </PageHeader>

      {needsMigration ? (
        <Card title="One setup step">
          <p className="text-sm text-muted">
            Run <code>supabase/migrations/0005_meal_ideas.sql</code> in the Supabase SQL editor, then refresh this page.
          </p>
        </Card>
      ) : (
        <>
          <FridgeForm
            key={latest[0]?.batch_id ?? "none"}
            initial={input}
            dietProfile={{ dietary_type: profile.dietary_type, dietary_restrictions: profile.dietary_restrictions, allergies: profile.allergies }}
            results={latest.length > 0 && (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {latest.map((meal) => {
                  const f = ratings.get(meal.id);
                  return (
                    <MealCard
                      key={meal.id}
                      meal={meal}
                      rating={f && (f.rating === "like" || f.rating === "dislike") ? { rating: f.rating, reasons: f.reasons as MealDislikeReason[] } : null}
                      fitNote={meal.fits_targets ? "Fits your daily targets" : null}
                      fridge={fridgeMatch(meal, input.items)}
                    />
                  );
                })}
              </div>
            )}
          />

          <div className="space-y-1 text-xs text-muted">
            <p>Recipes follow your diet and restrictions from your profile.</p>
            {unchecked.length > 0 && (
              <p>We leave out recipes whose ingredients mention {unchecked.join(", ")}, but can&apos;t fully check them.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
