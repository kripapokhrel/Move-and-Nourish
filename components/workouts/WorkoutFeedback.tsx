"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  rateExerciseAction, rateWorkoutAction, setExercisePreferenceAction, type WorkoutActionResult,
} from "@/lib/workouts/actions";

export type ExerciseFeedback = { rating: "too_easy" | "too_hard" | null; preference: "like" | "dislike" | null };

/** Small toggle chip. Feedback is always optional, so every chip can be clicked again to undo. */
function Chip({ active, disabled, onClick, children }: {
  active: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
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

function useSave() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = (fn: () => Promise<WorkoutActionResult>) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  };
  return { save, pending, error };
}

const WORKOUT_RATINGS = [
  { value: "too_easy", label: "Too easy" },
  { value: "just_right", label: "Just right" },
  { value: "too_hard", label: "Too hard" },
] as const;

export function WorkoutRating({ workoutId, rating }: { workoutId: string; rating: string | null }) {
  const { save, pending, error } = useSave();
  const [current, setCurrent] = useState(rating);

  const pick = (value: (typeof WORKOUT_RATINGS)[number]["value"]) => {
    const next = current === value ? null : value;
    setCurrent(next);
    save(() => rateWorkoutAction({ workoutId, rating: next }));
  };

  return (
    <div className="space-y-2 rounded-xl border border-line p-3">
      <p className="text-sm font-medium">How did it feel? <span className="font-normal text-muted">(optional)</span></p>
      <div className="flex flex-wrap gap-2">
        {WORKOUT_RATINGS.map((r) => (
          <Chip key={r.value} active={current === r.value} disabled={pending} onClick={() => pick(r.value)}>{r.label}</Chip>
        ))}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function ExerciseRating({ exerciseId, name, inLibrary, feedback }: {
  exerciseId: string; name: string; inLibrary: boolean; feedback: ExerciseFeedback;
}) {
  const { save, pending, error } = useSave();
  const [rating, setRating] = useState(feedback.rating);
  const [preference, setPreference] = useState(feedback.preference);

  const rate = (value: "too_easy" | "too_hard") => {
    const next = rating === value ? null : value;
    setRating(next);
    save(() => rateExerciseAction({ exerciseId, rating: next }));
  };
  const prefer = (value: "like" | "dislike") => {
    const next = preference === value ? null : value;
    setPreference(next);
    save(() => setExercisePreferenceAction({ name, sentiment: next }));
  };

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1.5">
        <Chip active={rating === "too_easy"} disabled={pending} onClick={() => rate("too_easy")}>Too easy</Chip>
        <Chip active={rating === "too_hard"} disabled={pending} onClick={() => rate("too_hard")}>Too hard</Chip>
        {/* Only library exercises can be suggested, so only they can be favourited or blocked */}
        {inLibrary && (
          <>
            <Chip active={preference === "like"} disabled={pending} onClick={() => prefer("like")}>★ Favourite</Chip>
            <Chip active={preference === "dislike"} disabled={pending} onClick={() => prefer("dislike")}>Don&apos;t suggest again</Chip>
          </>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
