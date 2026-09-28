"use client";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { OptionGroup } from "@/components/ui/OptionGroup";
import { generateFridgeIdeasAction } from "@/lib/meals/actions";
import {
  BASICS, FRIDGE_SUGGESTIONS, fridgeQuestions, makeableCount, matches, normalizeItems, type FridgeInput,
} from "@/lib/meals/fridge";
import type { MealType } from "@/lib/meals/library";
import { MEAL_TYPES } from "@/lib/meals/options";
import type { Profile } from "@/types/database";

const MEAL_CHOICES = [{ value: "any", label: "Any meal" }, ...MEAL_TYPES];

// Recipes wait this long after the last change to the list, so tapping several chips makes one search
const AUTO_SEARCH_MS = 600;

/** Identifies a search: the same list and meal give the same key, in any order. */
const searchKey = (items: string[], mealType: string) => `${mealType}|${normalizeItems(items).sort().join(",")}`;

/**
 * The user lists exactly what they have. Recipes only use those things. How many recipes the list makes, the
 * "Do you have …?" questions and items no recipe uses are all worked out here as the list changes.
 * Recipes update on their own shortly after the list or meal changes; there's no button to press.
 * `results` are the saved recipes from the last search (`saved`); they're hidden when they no longer match.
 */
export function FridgeForm({ saved, dietProfile, results }: {
  /** The list and meal the current `results` were found for */
  saved: FridgeInput;
  dietProfile: Pick<Profile, "dietary_type" | "dietary_restrictions" | "allergies">;
  /** Recipe cards from the last successful search, if any */
  results: ReactNode;
}) {
  const router = useRouter();
  const [items, setItems] = useState(saved.items);
  const [declined, setDeclined] = useState(saved.declined);
  const [typed, setTyped] = useState("");
  const [mealType, setMealType] = useState<MealType | "any">(saved.mealType);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // A search that failed isn't retried on its own until the list changes (the button can still retry it)
  const [failedKey, setFailedKey] = useState<string | null>(null);
  // The last search that succeeded. Its recipes take a moment to arrive, so it isn't searched again meanwhile.
  const [doneKey, setDoneKey] = useState<string | null>(null);

  const current = useMemo(() => normalizeItems([...items, ...typed.split(",")]), [items, typed]);
  const canMake = useMemo(() => makeableCount({ profile: dietProfile, mealType, items: current }), [dietProfile, mealType, current]);
  const canMakeAny = useMemo(
    () => (mealType === "any" ? canMake : makeableCount({ profile: dietProfile, mealType: "any", items: current })),
    [dietProfile, mealType, current, canMake],
  );
  // Things no recipe uses at all, so the person knows they won't help
  const unknown = items.filter((i) => !FRIDGE_SUGGESTIONS.some((r) => matches(i, r)));
  const hasResults = !!results && saved.items.length > 0;
  const wantedKey = searchKey(items, mealType);
  const resultsAreOld = hasResults && searchKey(saved.items, saved.mealType) !== wantedKey;
  // Only the added chips count here, not a half-typed word, so the search doesn't jump around while typing
  const chipsCanMake = useMemo(() => makeableCount({ profile: dietProfile, mealType, items }), [dietProfile, mealType, items]);

  const forMeal = useMemo(
    () => (items.length ? fridgeQuestions({ profile: dietProfile, mealType, items, declined }) : []),
    [dietProfile, mealType, items, declined],
  );
  // Nothing to ask for this meal? Look across all meals, so there's always a way forward
  const forAnyMeal = useMemo(
    () => (items.length && mealType !== "any" && !forMeal.length ? fridgeQuestions({ profile: dietProfile, mealType: "any", items, declined }) : []),
    [dietProfile, mealType, items, declined, forMeal.length],
  );
  const questions = forMeal.length ? forMeal : forAnyMeal;
  const questionsAreForOtherMeals = !forMeal.length && forAnyMeal.length > 0;

  const withTyped = () => normalizeItems([...items, ...typed.split(",")]);

  const add = () => {
    setItems(withTyped().slice(0, 30));
    setTyped("");
  };

  const find = (list: string[], no: string[], meal: MealType | "any") => {
    setError(null);
    start(async () => {
      const res = await generateFridgeIdeasAction({ items: list, declined: no, mealType: meal });
      if (res.ok) {
        setFailedKey(null);
        setDoneKey(searchKey(list, meal));
        router.refresh();
      } else {
        setFailedKey(searchKey(list, meal));
        setError(res.error);
      }
    });
  };

  // Search by itself once the list settles, whenever it can make something the saved results weren't found for
  const arriving = doneKey === wantedKey && (!hasResults || resultsAreOld);
  const loading = pending || arriving;
  const needsSearch = chipsCanMake > 0 && items.length > 0 && (!hasResults || resultsAreOld) && !arriving && failedKey !== wantedKey;
  useEffect(() => {
    if (!needsSearch || loading) return;
    const timer = setTimeout(() => find(items, declined, mealType), AUTO_SEARCH_MS);
    return () => clearTimeout(timer);
    // find is recreated every render; the search only depends on the list and meal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsSearch, loading, wantedKey]);

  const answer = (item: string, yes: boolean) => {
    if (yes) {
      // A question from another meal only helps if we search all meals. The new list searches by itself.
      if (questionsAreForOtherMeals) setMealType("any");
      setItems(normalizeItems([...items, item]));
    }
    else setDeclined([...declined, item]);
  };

  const basicsLeft = BASICS.filter((b) => !items.includes(b));
  return (
    <div className="space-y-4">
      <Card title="What's in your fridge?">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            List exactly what you have. Be specific, like &ldquo;chicken breast&rdquo;, &ldquo;brown rice&rdquo; or
            &ldquo;cheddar&rdquo;. Recipes will only use what&apos;s on your list, including oil and spices.
          </p>
          <div className="flex gap-2">
            <input
              list="fridge-suggestions"
              aria-label="Add an ingredient"
              placeholder="e.g. chicken breast, spinach, brown rice"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); add(); }
              }}
              className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm"
            />
            <Button variant="secondary" disabled={!typed.trim()} onClick={add}>Add</Button>
          </div>
          <datalist id="fridge-suggestions">
            {FRIDGE_SUGGESTIONS.filter((s) => !items.includes(s)).map((s) => <option key={s} value={s} />)}
          </datalist>

          {items.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Your ingredients">
              {items.map((i) => (
                <li key={i}>
                  <button type="button" onClick={() => setItems(items.filter((x) => x !== i))} aria-label={`Remove ${i}`}
                    className="rounded-full border border-brand bg-brand-soft px-3 py-1 text-sm text-brand">
                    {i} ✕
                  </button>
                </li>
              ))}
              <li>
                <button type="button" onClick={() => { setItems([]); setDeclined([]); }} className="px-2 py-1 text-xs text-muted underline">
                  Clear all
                </button>
              </li>
            </ul>
          )}

          {basicsLeft.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted">Have any basics? Tap to add:</p>
              <div className="flex flex-wrap gap-1.5">
                {basicsLeft.map((b) => (
                  <button key={b} type="button" onClick={() => setItems(normalizeItems([...items, b]))}
                    className="rounded-full border border-line bg-card px-3 py-1 text-xs hover:bg-brand-soft">
                    + {b}
                  </button>
                ))}
              </div>
            </div>
          )}

          <OptionGroup name="Meal" options={MEAL_CHOICES} value={mealType} onChange={(v) => setMealType(v as MealType | "any")} />

          {current.length > 0 && (
            <div className="space-y-1.5 rounded-2xl bg-paper p-3 text-sm" aria-live="polite">
              <p>
                {canMake === 0
                  ? "Nothing can be made from exactly this list yet."
                  : `With this list you can make ${canMake} ${canMake === 1 ? "recipe" : "recipes"}${mealType === "any" ? "" : ` for ${MEAL_CHOICES.find((m) => m.value === mealType)?.label.toLowerCase()}`}.`}
              </p>
              {mealType !== "any" && (canMakeAny > canMake || questionsAreForOtherMeals) && (
                <p>
                  {canMakeAny > canMake
                    ? `${canMakeAny} ${canMakeAny === 1 ? "recipe works" : "recipes work"} for other meals.`
                    : `Nothing for ${MEAL_CHOICES.find((m) => m.value === mealType)?.label.toLowerCase()} uses these yet.`}{" "}
                  <button type="button" className="font-semibold text-brand underline" onClick={() => setMealType("any")}>Show any meal</button>
                </p>
              )}
              {unknown.length > 0 && (
                <p className="text-muted">No recipes use {unknown.join(", ")} yet, so {unknown.length === 1 ? "it" : "they"} won&apos;t change the results.</p>
              )}
              {canMake === 0 && questions.length > 0 && (
                <p className="text-muted">See &ldquo;Do you have any of these?&rdquo; below for the quickest way to a recipe.</p>
              )}
            </div>
          )}

          {loading && <p className="text-sm text-muted" aria-live="polite">Finding recipes for your list…</p>}
          {error && !loading && (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-danger">{error}</p>
              <Button variant="secondary" onClick={() => find(items, declined, mealType)}>Try again</Button>
            </div>
          )}
        </div>
      </Card>

      {/* Old recipes are only kept on screen (faded) while new ones load; a list that makes nothing shows none */}
      {hasResults && (!resultsAreOld || (loading && chipsCanMake > 0)) && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Recipes you can make with only what you have</h2>
          {resultsAreOld ? (
            <p className="text-sm text-muted">Updating for your new list…</p>
          ) : (() => {
            const total = makeableCount({ profile: dietProfile, mealType: saved.mealType, items: saved.items });
            return total > 3 ? (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                You can make {total} recipes with this list.
                <button type="button" disabled={pending} onClick={() => find(items, declined, mealType)}
                  className="font-semibold text-brand underline disabled:opacity-50">
                  {pending ? "Loading…" : "Show other recipes"}
                </button>
              </p>
            ) : (
              <p className="text-sm text-muted">That&apos;s {total === 1 ? "the only recipe" : `all ${total} recipes`} you can make with exactly this list.</p>
            );
          })()}
          <div className={resultsAreOld ? "pointer-events-none opacity-50" : ""}>{results}</div>
        </section>
      )}

      {questions.length > 0 && (
        <Card title="Do you have any of these?">
          {questionsAreForOtherMeals && (
            <p className="-mt-2 mb-2 text-sm text-muted">These would unlock recipes for other meals. Saying yes shows any meal.</p>
          )}
          <ul className="divide-y divide-line">
            {questions.map((q) => (
              <li key={q.item} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <span className="min-w-0 text-sm">
                  <span className="font-medium">{q.item}</span>
                  <span className="block text-xs text-muted">
                    {q.unlocks.length
                      ? `Lets you make ${q.unlocks[0]}${q.unlocks.length > 1 ? ` and ${q.unlocks.length - 1} more` : ""}`
                      : "Gets you closer to a recipe"}
                  </span>
                </span>
                <span className="flex gap-2">
                  <Button variant="secondary" disabled={pending} onClick={() => answer(q.item, true)}>Yes</Button>
                  <Button variant="secondary" disabled={pending} onClick={() => answer(q.item, false)}>No</Button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
