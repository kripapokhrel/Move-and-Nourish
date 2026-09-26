"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  deletePersonalizationAction, removePreferenceAction, setPersonalizationAction, type PersonalizationActionResult,
} from "@/lib/personalization/actions";
import type { UserPreference } from "@/types/database";

const CATEGORY_LABEL: Record<UserPreference["category"], string> = {
  exercise: "Exercise", ingredient: "Food", cuisine: "Cuisine", meal_type: "Meal type", workout_focus: "Workout",
};

export function PersonalizationSettings({ enabled, preferences, needsMigration }: {
  enabled: boolean;
  preferences: UserPreference[];
  needsMigration: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<PersonalizationActionResult>, onOk?: () => void) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.ok) {
        onOk?.();
        router.refresh();
      } else setError(res.error);
    });
  };

  if (needsMigration) {
    return (
      <Card title="Personalization">
        <p className="text-sm text-muted">
          Run <code>supabase/migrations/0004_personalization.sql</code> in the Supabase SQL editor to turn this on.
        </p>
      </Card>
    );
  }


  return (
    <Card title="Personalization">
      <div className="space-y-5">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={enabled}
            disabled={pending}
            onChange={(e) => run(() => setPersonalizationAction(e.target.checked))}
          />
          <span>
            Learn from how I use Move &amp; Nourish
            <span className="block text-xs text-muted">
              When off, nothing new is recorded and workouts ignore past activity. Favourites and &ldquo;don&apos;t suggest
              again&rdquo; still apply.
            </span>
          </span>
        </label>

        <details className="rounded-xl border border-line p-3 text-sm">
          <summary className="cursor-pointer font-medium">What we record</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            <li>Workouts you generate, finish or skip, how long they took, and the day of the week.</li>
            <li>Exercises you tick as done, skip, swap, remove or add yourself.</li>
            <li>Ratings you choose to give (too easy, just right, too hard).</li>
            <li>Once meal ideas arrive: meals you save, cook, like or pass on, with their cuisine, ingredients and prep time.</li>
          </ul>
          <p className="mt-2 text-muted">
            What we learn from this is included in your Sunday email. We don&apos;t record your notes, location or device. Only the last 90 days count, and older activity counts less.
            Only you can see this data.
          </p>
        </details>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">What you told us</h3>
          {preferences.length === 0 ? (
            <p className="text-sm text-muted">
              Mark exercises as ★ Favourite or &ldquo;Don&apos;t suggest again&rdquo; after a workout. Restrictions and
              cuisines are in the Nutrition section above.
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {preferences.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span>
                    <span className="text-muted">{CATEGORY_LABEL[p.category]}:</span> {p.value}{" "}
                    <span className={p.sentiment === "like" ? "text-brand" : "text-danger"}>
                      {p.sentiment === "like" ? "★ Favourite" : "Don't suggest"}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => removePreferenceAction(p.id))}
                    className="text-xs text-muted underline hover:text-ink disabled:opacity-50"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2 border-t border-line pt-4">
          <p className="text-sm">
            Delete everything personalization has recorded or learned, including ratings and favourites. Your workouts
            and profile stay.
          </p>
          {confirmDelete ? (
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={pending}
                className="bg-danger!"
                onClick={() => run(deletePersonalizationAction, () => setConfirmDelete(false))}
              >
                Yes, delete my history
              </Button>
              <Button variant="secondary" disabled={pending} onClick={() => setConfirmDelete(false)}>Cancel</Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setConfirmDelete(true)}>Delete my history</Button>
          )}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Card>
  );
}
