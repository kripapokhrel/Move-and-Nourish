import Link from "next/link";
import { NutritionTargets } from "@/components/nutrition/NutritionTargets";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireUser } from "@/lib/auth/session";
import { getRecentMeals } from "@/lib/db/meals";
import { getNutritionProfile } from "@/lib/db/nutrition";
import { isMissingSchema } from "@/lib/db/personalization";
import { getCompletedWorkoutDates, getProgressLogs } from "@/lib/db/progress";
import { getProfile } from "@/lib/db/profiles";
import { getWorkoutForDate } from "@/lib/db/workouts";
import { isMealType, mealLabel } from "@/lib/meals/options";
import { FITNESS_GOAL, labelFor } from "@/lib/profile/options";
import { formatWeight, kgToLb } from "@/lib/profile/units";
import { addDays, weekStart, weightChange, weightTrend } from "@/lib/progress/stats";
import { WORKOUT_FOCUS } from "@/lib/workouts/options";
import { todayISO } from "@/lib/workouts/service";

const ACTIONS = [
  { href: "/workouts", label: "Today's workout" },
  { href: "/meals", label: "Meal ideas" },
  { href: "/meals/fridge", label: "What's in my fridge?" },
  { href: "/progress", label: "Log progress" },
];

// A different gentle nudge each day of the week
const REMINDERS = [
  "Rest is part of the plan, too. Listen to your body today.",
  "Small steps count. A short walk is still movement.",
  "Drink a glass of water before your next meal.",
  "Progress isn't a straight line. Be kind to yourself.",
  "Sleep is when your muscles recover. Aim for a restful night.",
  "Try a new meal this week. Variety keeps things fun.",
  "Stretch for five minutes. Your future self will thank you.",
];

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

function Flower({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="18" cy="10.5" rx="5" ry="6.5" fill="#8faa84" transform={`rotate(${a} 18 18)`} />
      ))}
      <circle cx="18" cy="18" r="4.5" fill="#f3d27a" />
    </svg>
  );
}

/** Decorative sun and dumbbell for the hero card. */
function SunIllustration() {
  return (
    <svg viewBox="0 0 200 200" className="h-40 w-40 sm:h-48 sm:w-48" aria-hidden>
      <circle cx="100" cy="100" r="92" fill="#f8dfa0" />
      <circle cx="100" cy="100" r="70" fill="none" stroke="#fffbf7" strokeWidth="3" opacity="0.8" />
      <g transform="rotate(-20 100 100)">
        <rect x="52" y="94" width="96" height="12" rx="6" fill="#3b322c" />
        <rect x="40" y="70" width="16" height="60" rx="8" fill="#c94f6d" />
        <rect x="58" y="78" width="12" height="44" rx="6" fill="#c94f6d" />
        <rect x="144" y="70" width="16" height="60" rx="8" fill="#c94f6d" />
        <rect x="130" y="78" width="12" height="44" rx="6" fill="#c94f6d" />
      </g>
    </svg>
  );
}

export default async function DashboardPage() {
  const { supabase, userId } = await requireUser();
  const today = todayISO();
  const monday = weekStart(today);
  const [profile, nutrition, workout, recentMeals, logs, workoutDates] = await Promise.all([
    getProfile(supabase, userId),
    getNutritionProfile(supabase, userId),
    getWorkoutForDate(supabase, userId, today),
    // Before migration 0005 the card just shows its empty state
    getRecentMeals(supabase, userId).catch((e) => {
      if (!isMissingSchema(e)) throw e;
      return { meals: [], kept: false };
    }),
    getProgressLogs(supabase, userId, addDays(today, -36), today),
    getCompletedWorkoutDates(supabase, userId, monday),
  ]);

  const done = new Set(workoutDates);
  const week = DAYS.map((d, i) => ({ letter: d, date: addDays(monday, i) }));
  const thisWeek = week.filter((d) => done.has(d.date)).length;
  const goal = profile?.workout_days_per_week ?? 3;
  const trend = weightTrend(logs, addDays(today, -29), today);
  const latest = trend[trend.length - 1];
  const change = weightChange(trend);
  const unit = profile?.unit_system ?? "metric";
  const dayIndex = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const focus = WORKOUT_FOCUS.find((f) => f.value === workout?.focus)?.label.split(" (")[0];
  const firstName = profile?.name?.trim().split(" ")[0];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={new Date(`${today}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })}
        title={<>{firstName ? `Hey ${firstName}, move` : "Move"} in a way that <span className="italic text-peach-deep">feels good</span></>}
      >
        {labelFor(FITNESS_GOAL, profile?.fitness_goal)} · {goal} sessions a week, made for your goals and your schedule.
      </PageHeader>

      <nav aria-label="Quick actions" className="flex flex-wrap gap-2">
        {ACTIONS.map((a) => (
          <Link key={a.href} href={a.href} className="rounded-full border border-line bg-card px-4 py-2 text-sm font-medium hover:bg-brand-soft">
            {a.label}
          </Link>
        ))}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          {/* Hero: today's workout */}
          <section className="relative overflow-hidden rounded-[var(--radius-card)] bg-brand-soft p-6 sm:p-8">
            <div className="flex flex-col-reverse items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-md space-y-4">
                <span className="eyebrow inline-block rounded-full bg-card px-3 py-1.5">
                  Today{focus ? ` · ${focus}` : ""}
                </span>
                <h2 className="text-3xl font-semibold sm:text-4xl">
                  {workout ? workout.name : "Ready when you are"}
                </h2>
                <p className="text-muted">
                  {workout
                    ? workout.status === "completed" ? "Done for today. Nice work." : workout.notes
                    : "Pick what you feel like training and we'll build a session for you."}
                </p>
                {workout && (
                  <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-medium">
                    {workout.duration_min && <span>⏱ ~{workout.duration_min} min</span>}
                    <span>⇄ {workout.workout_exercises.length} exercises</span>
                  </p>
                )}
                <Link
                  href="/workouts"
                  className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-card hover:bg-ink/85"
                >
                  {workout ? (workout.status === "completed" ? "See workout" : "Start workout") : "Plan today's workout"} <span aria-hidden>→</span>
                </Link>
              </div>
              <SunIllustration />
            </div>
          </section>

          <Card eyebrow="Your fuel" title="Daily targets" action={<Link href="/profile" className="text-sm font-medium text-brand">Edit</Link>}>
            {nutrition ? <NutritionTargets n={nutrition} /> : <p className="text-sm text-muted">No targets yet. Save your profile to calculate them.</p>}
          </Card>

          <Card eyebrow="Kitchen" title="Recent meals" action={<Link href="/meals" className="text-sm font-medium text-brand">{recentMeals.meals.length ? "Open" : "Get ideas"} →</Link>}>
            {recentMeals.meals.length ? (
              <div className="space-y-2">
                {!recentMeals.kept && <p className="text-xs text-muted">Your latest ideas. Save or make one and it stays here.</p>}
                <ul className="divide-y divide-line">
                  {recentMeals.meals.map((m) => (
                    <li key={m.id} className="flex items-baseline justify-between gap-3 py-3 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{m.meal_name}</span>
                        <span className="text-xs text-muted">
                          {[m.made_at ? "✓ Made" : null, m.saved ? "♥ Saved" : null, isMealType(m.meal_type) ? mealLabel(m.meal_type) : null].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-muted">{m.calories} kcal · {m.protein_g} g protein</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-muted">Meals you save or make will show here.</p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card
            eyebrow="This week"
            title="Your rhythm"
            action={<span className="rounded-full bg-sage-soft px-3 py-1 text-xs font-semibold">{thisWeek}/{goal}</span>}
          >
            <ol className="grid grid-cols-7 gap-1.5" aria-label="Workouts this week">
              {week.map((d) => {
                const isDone = done.has(d.date);
                const isToday = d.date === today;
                return (
                  <li
                    key={d.date}
                    aria-label={`${d.date}${isDone ? ", workout done" : ""}${isToday ? ", today" : ""}`}
                    className={`flex h-16 flex-col items-center justify-center gap-1.5 rounded-2xl text-xs font-semibold ${
                      isDone ? "bg-sage-soft" : isToday ? "bg-brand text-card" : "text-muted"
                    }`}
                  >
                    {d.letter}
                    <span aria-hidden className="text-sm leading-none">{isDone ? "✓" : isToday ? "•" : ""}</span>
                  </li>
                );
              })}
            </ol>
            <div className="mt-5 space-y-4 border-t border-line pt-4 text-sm">
              <div className="flex gap-3">
                <span className="w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                <div>
                  <p className="font-semibold">Today</p>
                  <p className="text-muted">{workout ? `${workout.name}${workout.status === "completed" ? " · done" : ""}` : "No workout planned yet"}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="w-1.5 shrink-0 rounded-full bg-sage" aria-hidden />
                <div>
                  <p className="font-semibold">This week</p>
                  <p className="text-muted">{thisWeek >= goal ? "Weekly goal reached" : `${goal - thisWeek} more to reach your goal of ${goal}`}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="w-1.5 shrink-0 rounded-full bg-butter" aria-hidden />
                <div>
                  <p className="font-semibold">Weight trend</p>
                  <p className="text-muted">
                    {latest
                      ? `${formatWeight(latest.average, unit)} 7-day average${change ? `, ${change.change > 0 ? "+" : change.change < 0 ? "−" : "±"}${Math.abs(unit === "imperial" ? kgToLb(change.change) : change.change)} ${unit === "imperial" ? "lb" : "kg"} in ${change.days} days` : ""}`
                      : <Link href="/progress" className="text-brand">Log your weight to see it</Link>}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <section className="flex items-center gap-4 rounded-[var(--radius-card)] bg-sage-soft p-6">
            <Flower className="h-12 w-12 shrink-0" />
            <div>
              <h2 className="text-lg font-semibold">Gentle reminder</h2>
              <p className="text-sm text-muted">{REMINDERS[dayIndex]}</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
