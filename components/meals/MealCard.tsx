"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markMadeAction, rateMealAction, saveMealAction, viewMealAction, type MealActionResult } from "@/lib/meals/actions";
import { explain } from "@/lib/personalization/apply";
import { MEAL_DISLIKE_REASONS, type MealDislikeReason } from "@/lib/personalization/config";
import type { FridgeMatch } from "@/lib/meals/fridge";
import { MacroDonut } from "./MacroDonut";
import { NUTRIENTS_PER_100G } from "@/lib/meals/nutrients";
import type { MealWithSaved } from "@/types/database";

export type MealRating = { rating: "like" | "dislike"; reasons: MealDislikeReason[] } | null;

function Chip({ active, disabled, onClick, children, label }: {
  active: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode; label?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs disabled:opacity-50 ${
        active ? "border-brand bg-brand text-white" : "border-line bg-card text-ink hover:bg-brand-soft"
      }`}
    >
      {children}
    </button>
  );
}

const madeLabel = (iso: string) => {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString() ? "today" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

/** Where the numbers come from. Meals saved before USDA data have no gram weights, so they stay "approximate". */
function nutritionNote(meal: MealWithSaved) {
  if (!meal.ingredients.every((i) => i.grams)) return "Per serving, approximate.";
  const standIns = meal.ingredients.filter((i) => NUTRIENTS_PER_100G[i.item]?.standIn).map((i) => i.item);
  const optional = meal.ingredients.some((i) => i.optional);
  return [
    "Per serving, from USDA FoodData Central",
    optional ? ", not counting optional extras" : "",
    standIns.length ? `. ${standIns.join(", ")} use${standIns.length === 1 ? "s" : ""} the closest USDA match` : "",
    ".",
  ].join("");
}

export function MealCard({ meal, rating, fitNote, fridge }: {
  meal: MealWithSaved; rating: MealRating; fitNote: string | null;
  /** From "What's in my fridge?": what the user has and what they'd need */
  fridge?: FridgeMatch;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(meal.saved);
  const [current, setCurrent] = useState<MealRating>(rating);
  const viewed = useRef(false);

  const save = (fn: () => Promise<MealActionResult>) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  };

  const rate = (value: "like" | "dislike") => {
    const next: MealRating = current?.rating === value ? null : { rating: value, reasons: [] };
    setCurrent(next);
    save(() => rateMealAction({ mealId: meal.id, rating: next?.rating ?? null, reasons: [] }));
  };
  const toggleReason = (reason: MealDislikeReason) => {
    if (current?.rating !== "dislike") return;
    const reasons = current.reasons.includes(reason) ? current.reasons.filter((r) => r !== reason) : [...current.reasons, reason];
    setCurrent({ rating: "dislike", reasons });
    save(() => rateMealAction({ mealId: meal.id, rating: "dislike", reasons }));
  };

  const because = explain(meal.personalized_because ?? []);
  return (
    <article className="space-y-4 rounded-[var(--radius-card)] border border-line bg-card p-5 shadow-[0_8px_24px_-14px_rgba(184,67,95,0.18)]">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold leading-snug">{meal.meal_name}</h3>
        <p className="text-xs text-muted">
          {[meal.cuisine, meal.prep_time_min ? `${meal.prep_time_min} min` : null].filter(Boolean).join(" · ")}
        </p>
      </div>

      {fridge && (
        <div className="space-y-1 text-sm">
          <p><span className="text-brand">✓ Uses:</span> {fridge.have.join(", ")}</p>
          {/* Close matches from the fridge need a few things that weren't on the list */}
          {fridge.missing.length > 0 && <p><span className="text-muted">You&apos;d also need:</span> {fridge.missing.join(", ")}</p>}
        </div>
      )}

      <MacroDonut calories={meal.calories} protein={meal.protein_g} carbs={meal.carbs_g} fat={meal.fat_g} />
      <p className="text-xs text-muted">
        {nutritionNote(meal)}{" "}
        {fitNote && <span className="text-brand">✓ {fitNote}</span>}
      </p>

      {because && <p className="rounded-xl bg-brand-soft/50 p-2 text-sm text-muted">{because}</p>}

      <details
        className="rounded-xl border border-line p-3 text-sm"
        onToggle={(e) => {
          if (!(e.currentTarget as HTMLDetailsElement).open || viewed.current) return;
          viewed.current = true;
          viewMealAction(meal.id);
        }}
      >
        <summary className="cursor-pointer font-medium">Ingredients and steps</summary>
        <ul className="mt-2 space-y-0.5">
          {meal.ingredients.map((i) => (
            <li key={i.item}>
              <span className="font-medium">{i.item}</span>{" "}
              <span className="text-muted">· {i.quantity}{i.grams && !/\bg\b|ml/.test(i.quantity) ? ` (${i.grams} g)` : ""}{i.optional ? " (optional)" : ""}</span>
            </li>
          ))}
        </ul>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-muted">
          {meal.instructions.map((s) => <li key={s}>{s}</li>)}
        </ol>
      </details>

      <div className="flex flex-wrap items-center gap-2">
        <Chip active={saved} disabled={pending} onClick={() => {
          setSaved(!saved);
          save(() => saveMealAction({ mealId: meal.id, saved: !saved }));
        }}>
          {saved ? "♥ Saved" : "♡ Save"}
        </Chip>
        <Chip active={!!meal.made_at} disabled={pending} onClick={() => save(() => markMadeAction(meal.id))}>
          {meal.made_at ? `✓ Made ${madeLabel(meal.made_at)}` : "✓ I made this"}
        </Chip>
        <span className="ml-auto flex gap-2">
          <Chip label="Like" active={current?.rating === "like"} disabled={pending} onClick={() => rate("like")}>👍</Chip>
          <Chip label="Don't like" active={current?.rating === "dislike"} disabled={pending} onClick={() => rate("dislike")}>👎</Chip>
        </span>
      </div>

      {current?.rating === "dislike" && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted">Why not? (optional)</p>
          <div className="flex flex-wrap gap-1.5">
            {MEAL_DISLIKE_REASONS.map((r) => (
              <Chip key={r.value} active={current.reasons.includes(r.value)} disabled={pending} onClick={() => toggleReason(r.value)}>
                {r.label}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
    </article>
  );
}
