"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { OptionGroup } from "@/components/ui/OptionGroup";
import { generateMealsAction } from "@/lib/meals/actions";
import type { MealType } from "@/lib/meals/library";
import { MEAL_TYPES, mealLabel } from "@/lib/meals/options";
import type { MealWithSaved } from "@/types/database";
import { MealCard, type MealRating } from "./MealCard";

export type MealView = { meal: MealWithSaved; rating: MealRating; fitNote: string | null };

/**
 * Each meal type has its own page (/meals?type=dinner) showing its latest ideas. The first visit to a type makes
 * ideas straight away; "Show different ideas" makes a new set.
 */
export function MealIdeas({ mealType, ideas, unchecked, hasRestrictions }: {
  mealType: MealType;
  ideas: MealView[];
  unchecked: string[];
  hasRestrictions: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [generating, startGenerating] = useTransition();
  const [switching, startSwitching] = useTransition();
  const tried = useRef(new Set<MealType>());

  const generate = () => {
    setError(null);
    startGenerating(async () => {
      const res = await generateMealsAction(mealType);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  };

  // No ideas for this meal yet: make some once, without waiting for a click
  useEffect(() => {
    if (ideas.length || tried.current.has(mealType)) return;
    tried.current.add(mealType);
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the meal type or its ideas change
  }, [mealType, ideas.length]);

  const choose = (type: string) => {
    setError(null);
    startSwitching(() => router.push(`/meals?type=${type}`, { scroll: false }));
  };

  const busy = generating || switching;
  return (
    <div className="space-y-4">
      <OptionGroup name="Meal" options={MEAL_TYPES} value={mealType} onChange={choose} />

      {error && <p className="text-sm text-danger">{error}</p>}

      {busy && !ideas.length ? (
        <p className="text-sm text-muted">Finding {mealLabel(mealType).toLowerCase()} ideas…</p>
      ) : ideas.length > 0 && (
        <section className={`space-y-3 ${busy ? "opacity-50" : ""}`} aria-busy={busy}>
          <div className="grid gap-3 md:grid-cols-3">
            {ideas.map((v) => <MealCard key={v.meal.id} {...v} />)}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={generate} disabled={busy}>
          {generating ? "Finding ideas…" : "↻ Show different ideas"}
        </Button>
        <span className="text-xs text-muted">Save what you like and tap 👍 or 👎. New ideas lean toward what you pick.</span>
      </div>

      <div className="space-y-1 text-xs text-muted">
        <p>Ideas follow your diet and restrictions from your profile.</p>
        {unchecked.length > 0 && (
          <p>
            We leave out recipes whose ingredients mention {unchecked.join(", ")}, but can&apos;t fully check them, so
            please check recipes yourself.
          </p>
        )}
        {hasRestrictions && <p>With allergies, always check ingredient labels. Packaged foods can contain traces.</p>}
      </div>
    </div>
  );
}
