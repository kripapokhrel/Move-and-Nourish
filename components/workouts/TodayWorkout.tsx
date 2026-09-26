"use client";
import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextInput } from "@/components/ui/Field";
import { OptionGroup } from "@/components/ui/OptionGroup";
import {
  addExerciseAction, finishWorkoutAction, generateWorkoutAction, removeExerciseAction, saveWorkoutNotesAction,
  setExerciseDoneAction, skipWorkoutAction, swapExerciseAction, type WorkoutActionResult,
} from "@/lib/workouts/actions";
import { IMAGE_BASE, findExercise } from "@/lib/workouts/library";
import { WORKOUT_FOCUS, isWorkoutFocus } from "@/lib/workouts/options";
import type { WorkoutExercise, WorkoutWithExercises } from "@/types/database";
import { ExerciseRating, WorkoutRating, type ExerciseFeedback } from "./WorkoutFeedback";

export type SwapOption = { name: string; muscle: string; image: string | null };
export type WorkoutFeedbackState = { workout: string | null; exercises: Record<string, ExerciseFeedback> };
type Run = (fn: () => Promise<WorkoutActionResult>, onOk?: () => void) => void;

const NO_FEEDBACK: ExerciseFeedback = { rating: null, preference: null };

export function TodayWorkout({ workout, swapOptions, feedback }: {
  workout: WorkoutWithExercises | null;
  swapOptions: Record<string, SwapOption[]>;
  feedback: WorkoutFeedbackState;
}) {
  const router = useRouter();
  const [picking, setPicking] = useState(!workout);
  const [editing, setEditing] = useState(false);
  // Workouts saved under a focus that no longer exists (e.g. "upper_body") refresh as "unsure"
  const savedFocus = isWorkoutFocus(workout?.focus) ? workout.focus : null;
  const [focus, setFocus] = useState<string>(savedFocus ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(() => new Set(workout?.workout_exercises.filter((e) => e.completed).map((e) => e.id)));
  const [finishing, setFinishing] = useState(false);
  const [generating, startGenerating] = useTransition();
  const [saving, startSaving] = useTransition();

  const generate = (f: string) => {
    setError(null);
    if (!f) return setError("Pick what you want to train.");
    startGenerating(async () => {
      const res = await generateWorkoutAction(f);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  };

  // Edits keep the workout on screen and just refresh it once saved
  const run: Run = (fn, onOk) => {
    setError(null);
    startSaving(async () => {
      const res = await fn();
      if (res.ok) {
        onOk?.();
        router.refresh();
      } else setError(res.error);
    });
  };

  if (generating) {
    return (
      <Card title="Building your workout…">
        <p className="text-sm text-muted">Picking exercises for your level, equipment and time.</p>
      </Card>
    );
  }

  if (picking || !workout) {
    return (
      <Card title="What do you want to hit today?">
        <div className="space-y-4">
          <OptionGroup name="Workout focus" options={WORKOUT_FOCUS} value={focus} onChange={setFocus} />
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => generate(focus)}>Generate workout</Button>
            {workout && <Button variant="secondary" onClick={() => setPicking(false)}>Keep current workout</Button>}
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      </Card>
    );
  }

  // Ticks show straight away and save in the background; Finish sends the final list anyway
  const toggleDone = (exerciseId: string) => {
    const next = new Set(done);
    if (next.has(exerciseId)) next.delete(exerciseId);
    else next.add(exerciseId);
    setDone(next);
    setExerciseDoneAction({ exerciseId, done: next.has(exerciseId) }).then((res) => !res.ok && setError(res.error));
  };

  if (workout.status === "skipped") {
    return (
      <Card title={workout.name}>
        <div className="space-y-3">
          <p className="text-sm text-muted">You skipped today&apos;s workout. That&apos;s fine, rest days count too.</p>
          <Button variant="secondary" onClick={() => setPicking(true)}>Pick a new workout</Button>
        </div>
      </Card>
    );
  }

  const canEdit = workout.status === "planned";
  const completed = workout.status === "completed";
  const focusLabel = WORKOUT_FOCUS.find((f) => f.value === workout.focus)?.label;
  const doneCount = workout.workout_exercises.filter((e) => (completed ? e.completed : done.has(e.id))).length;
  return (
    <Card
      title={workout.name}
      action={
        completed ? (
          <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
            ✓ Done · {doneCount} of {workout.workout_exercises.length}
          </span>
        ) : canEdit ? (
          <Button variant={editing ? "primary" : "secondary"} onClick={() => setEditing((v) => !v)}>
            {editing ? "Done editing" : "✎ Edit workout"}
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">
          {workout.duration_min ? `~${workout.duration_min} min. ` : ""}
          {workout.notes}
        </p>

        {!!workout.personalized_because?.length && (
          <div className="rounded-xl bg-brand-soft/50 p-3">
            <p className="mb-1 text-xs font-medium">Personalized for you</p>
            <ul className="list-disc space-y-0.5 pl-4 text-sm text-muted">
              {workout.personalized_because.map((w) => <li key={w}>{w}</li>)}
            </ul>
          </div>
        )}

        {completed && <WorkoutRating workoutId={workout.id} rating={feedback.workout} />}

        <NotesBox workout={workout} editing={editing} busy={saving} run={run} />

        <ol className="divide-y divide-line">
          {workout.workout_exercises.map((e, i) => (
            <ExerciseRow
              key={e.id}
              exercise={e}
              index={i}
              total={workout.workout_exercises.length}
              editing={editing}
              options={swapOptions[e.id] ?? []}
              busy={saving}
              run={run}
              check={canEdit && !editing ? { done: done.has(e.id), toggle: () => toggleDone(e.id) } : undefined}
              feedback={completed ? feedback.exercises[e.id] ?? NO_FEEDBACK : undefined}
            />
          ))}
        </ol>

        {editing && <AddExerciseForm workoutId={workout.id} busy={saving} run={run} />}

        {error && <p className="text-sm text-danger">{error}</p>}

        {canEdit && !editing && (
          <FinishPanel
            workout={workout}
            done={done}
            open={finishing}
            setOpen={setFinishing}
            busy={saving}
            run={run}
          />
        )}

        {canEdit && !editing && !finishing && (
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
            <Button variant="secondary" onClick={() => generate(savedFocus ?? "unsure")}>↻ Refresh</Button>
            <Button variant="secondary" onClick={() => setPicking(true)}>Change focus</Button>
            {focusLabel && <span className="text-xs text-muted">Focus: {focusLabel}</span>}
          </div>
        )}
        {canEdit && !editing && !finishing && (
          <p className="text-xs text-muted">Refresh builds a new workout. Your notes stay, but swaps and added exercises are replaced.</p>
        )}
      </div>
    </Card>
  );
}

function FinishPanel({ workout, done, open, setOpen, busy, run }: {
  workout: WorkoutWithExercises; done: Set<string>; open: boolean; setOpen: (v: boolean) => void; busy: boolean; run: Run;
}) {
  const [minutes, setMinutes] = useState(String(workout.duration_min ?? 45));
  const total = workout.workout_exercises.length;
  const ticked = workout.workout_exercises.filter((e) => done.has(e.id)).length;

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setOpen(true)}>✓ Finish workout</Button>
        <Button variant="secondary" disabled={busy} onClick={() => run(() => skipWorkoutAction(workout.id))}>Skip today</Button>
        <span className="text-xs text-muted">Tick exercises as you go.</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-line p-3">
      <p className="text-sm">
        You ticked <strong>{ticked} of {total}</strong> exercises.
        {ticked < total && <span className="text-muted"> Unticked ones are saved as skipped.</span>}
      </p>
      <label className="flex items-center gap-2 text-sm">
        How long did it take?
        <span className="w-20">
          <TextInput aria-label="Minutes" type="number" min={1} max={300} value={minutes} onChange={(ev) => setMinutes(ev.target.value)} />
        </span>
        min
      </label>
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={busy}
          onClick={() => run(() => finishWorkoutAction({ workoutId: workout.id, durationMin: Number(minutes), done: [...done] }))}
        >
          Save workout
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>Not yet</Button>
      </div>
    </div>
  );
}

function NotesBox({ workout, editing, busy, run }: {
  workout: WorkoutWithExercises; editing: boolean; busy: boolean; run: Run;
}) {
  const [text, setText] = useState(workout.user_notes ?? "");
  const [saved, setSaved] = useState(false);

  if (!editing) {
    return workout.user_notes ? (
      <div className="rounded-xl border border-line p-3">
        <p className="mb-1 text-xs font-medium">My notes for today</p>
        <p className="whitespace-pre-wrap text-sm">{workout.user_notes}</p>
      </div>
    ) : null;
  }

  const dirty = text.trim() !== (workout.user_notes ?? "");
  return (
    <div className="space-y-2 rounded-xl border border-line p-3">
      <label htmlFor="workout-notes" className="block text-xs font-medium">My notes for today</label>
      <textarea
        id="workout-notes"
        value={text}
        onChange={(ev) => { setText(ev.target.value); setSaved(false); }}
        rows={3}
        maxLength={1000}
        placeholder="What do you want to do today? e.g. go lighter on squats, knee feels sore"
        className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm"
      />
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          disabled={busy || !dirty}
          onClick={() => run(() => saveWorkoutNotesAction({ workoutId: workout.id, notes: text }), () => setSaved(true))}
        >
          Save notes
        </Button>
        {saved && !dirty && <span className="text-xs text-brand">Saved</span>}
      </div>
    </div>
  );
}

function AddExerciseForm({ workoutId, busy, run }: { workoutId: string; busy: boolean; run: Run }) {
  const [name, setName] = useState("");
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("10");

  const add = () =>
    run(
      () => addExerciseAction({ workoutId, name, sets: Number(sets), reps }),
      () => { setName(""); setSets("3"); setReps("10"); },
    );

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-line p-3">
      <p className="text-xs font-medium">Add your own exercise</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_5rem_7rem_auto]">
        <TextInput aria-label="Exercise name" placeholder="Exercise name" value={name} onChange={(ev) => setName(ev.target.value)} />
        <TextInput aria-label="Sets" type="number" min={1} max={10} value={sets} onChange={(ev) => setSets(ev.target.value)} />
        <TextInput aria-label="Reps or time" placeholder="10 or 30 sec" value={reps} onChange={(ev) => setReps(ev.target.value)} />
        <Button variant="secondary" disabled={busy || !name.trim()} onClick={add}>Add</Button>
      </div>
      <p className="text-xs text-muted">Sets · reps or time. It goes before the cardio finisher.</p>
    </div>
  );
}

// Labels the bookends of the session. Older workouts without them just show no label.
function stageLabel(pattern: string | undefined, index: number, total: number) {
  if (index === 0 && pattern === "warmup") return "Warm-up stretch";
  if (index === total - 1 && pattern === "cooldown") return "Cool-down stretch";
  if (index === total - 2 && pattern === "cardio") return "Cardio finisher";
  return null;
}

function ExerciseRow({ exercise: e, index, total, editing, options, busy, run, check, feedback }: {
  exercise: WorkoutExercise; index: number; total: number;
  editing: boolean; options: SwapOption[]; busy: boolean; run: Run;
  /** Shown while the workout is in progress */
  check?: { done: boolean; toggle: () => void };
  /** Shown once the workout is finished */
  feedback?: ExerciseFeedback;
}) {
  const [swapping, setSwapping] = useState(false);
  const info = findExercise(e.exercise_name);
  const stage = stageLabel(info?.pattern, index, total);
  const tips = e.instructions?.split("\n").filter(Boolean) ?? [];

  return (
    <li className="flex gap-3 py-4">
      {check ? (
        <input
          type="checkbox"
          checked={check.done}
          onChange={check.toggle}
          aria-label={`Done: ${e.exercise_name}`}
          className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-brand)]"
        />
      ) : (
        <span className="w-5 shrink-0 text-sm text-muted">{feedback ? (e.completed ? "✓" : "–") : index + 1}</span>
      )}
      <div className="min-w-0 flex-1 space-y-2">
        <div className="space-y-0.5">
          {stage && <p className="text-xs font-medium uppercase tracking-wide text-brand">{stage}</p>}
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className={`font-medium ${check?.done ? "text-muted line-through" : ""}`}>{e.exercise_name}</span>
            <span className="text-sm">
              {e.sets && e.sets > 1 ? `${e.sets} × ${e.reps}` : e.reps}
              {e.rest_seconds ? <span className="text-muted"> · rest {e.rest_seconds}s</span> : null}
            </span>
          </div>
          {e.muscle_group && <p className="text-xs text-muted">{e.muscle_group}</p>}
          {!info && <p className="text-xs text-muted">Your own exercise</p>}
        </div>

        {editing && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => setSwapping((v) => !v)}>
              {swapping ? "Cancel swap" : "⇄ Swap"}
            </Button>
            {total > 1 && (
              <Button variant="secondary" disabled={busy} onClick={() => run(() => removeExerciseAction(e.id))}>
                Remove
              </Button>
            )}
          </div>
        )}

        {editing && swapping && (
          <SwapPanel
            options={options}
            busy={busy}
            onPick={(choice) => run(() => swapExerciseAction({ exerciseId: e.id, choice }), () => setSwapping(false))}
          />
        )}

        {!editing && info?.image && (
          <div className="grid max-w-sm grid-cols-2 gap-2">
            {["Start", "Finish"].map((label, n) => (
              <figure key={label} className="space-y-1">
                <Image
                  src={`${IMAGE_BASE}/${info.image}/${n}.jpg`}
                  alt={`${e.exercise_name}: ${label.toLowerCase()} position`}
                  width={320}
                  height={240}
                  className="aspect-[4/3] w-full rounded-xl border border-line object-cover"
                />
                <figcaption className="text-xs text-muted">{label}</figcaption>
              </figure>
            ))}
          </div>
        )}

        {feedback && (
          <ExerciseRating exerciseId={e.id} name={e.exercise_name} inLibrary={!!info} feedback={feedback} />
        )}

        {!editing && !feedback && tips.length > 0 && (
          <div className="rounded-xl bg-brand-soft/50 p-3">
            <p className="mb-1 text-xs font-medium">How to do it</p>
            <ol className="list-decimal space-y-1 pl-4 text-sm text-muted">
              {tips.map((t) => <li key={t}>{t}</li>)}
            </ol>
          </div>
        )}
      </div>
    </li>
  );
}

function SwapPanel({ options, busy, onPick }: {
  options: SwapOption[];
  busy: boolean;
  onPick: (choice: { kind: "library" | "custom"; name: string }) => void;
}) {
  const [typed, setTyped] = useState("");

  return (
    <div className="space-y-3 rounded-xl border border-line bg-paper p-3">
      {options.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium">Swap for</p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {options.map((o) => (
              <li key={o.name}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onPick({ kind: "library", name: o.name })}
                  className="flex w-full items-center gap-2 rounded-xl border border-line bg-card p-1.5 text-left text-sm hover:bg-brand-soft disabled:opacity-50"
                >
                  {o.image && (
                    <Image src={`${IMAGE_BASE}/${o.image}/0.jpg`} alt="" width={48} height={36} className="h-9 w-12 rounded object-cover" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate">{o.name}</span>
                    <span className="block text-xs text-muted">{o.muscle}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="space-y-1.5">
        <p className="text-xs font-medium">{options.length ? "Or type your own" : "Type the exercise you want instead"}</p>
        <div className="flex gap-2">
          <TextInput aria-label="Your exercise" placeholder="e.g. Kettlebell swings" value={typed} onChange={(ev) => setTyped(ev.target.value)} />
          <Button variant="secondary" disabled={busy || !typed.trim()} onClick={() => onPick({ kind: "custom", name: typed })}>
            Use
          </Button>
        </div>
      </div>
    </div>
  );
}
