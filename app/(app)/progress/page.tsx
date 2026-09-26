import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart, WeightChart } from "@/components/progress/Charts";
import { CheckInForm } from "@/components/progress/CheckInForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { requireUser } from "@/lib/auth/session";
import { getCompletedWorkoutDates, getMealsMadeOn, getProgressLogs } from "@/lib/db/progress";
import { getNutritionProfile } from "@/lib/db/nutrition";
import { getProfile } from "@/lib/db/profiles";
import { LOG_WINDOW_DAYS } from "@/lib/progress/schema";
import { addDays, weightChange, weightTrend, workoutsPerWeek } from "@/lib/progress/stats";
import { kgToLb } from "@/lib/profile/units";
import { todayISO } from "@/lib/workouts/service";

const RANGES = [30, 90] as const;
const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-3xl border border-line bg-card p-5">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-display text-3xl font-semibold">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { supabase, userId } = await requireUser();
  const { range: rawRange } = await searchParams;
  const range = RANGES.find((r) => String(r) === rawRange) ?? 30;
  const today = todayISO();
  const earliest = addDays(today, -Math.max(range, LOG_WINDOW_DAYS) - 7);

  const [profile, nutrition, logs, workoutDates, madeToday] = await Promise.all([
    getProfile(supabase, userId),
    getNutritionProfile(supabase, userId),
    getProgressLogs(supabase, userId, earliest, today),
    getCompletedWorkoutDates(supabase, userId, addDays(today, -7 * 8)),
    getMealsMadeOn(supabase, userId, today),
  ]);
  if (!profile) redirect("/onboarding");

  const imperial = profile.unit_system === "imperial";
  const unit = imperial ? "lb" : "kg";
  const show = (kg: number) => (imperial ? kgToLb(kg) : kg);

  const trend = weightTrend(logs, addDays(today, -range + 1), today);
  const change = weightChange(trend);
  const weeks = workoutsPerWeek(workoutDates, today, 8);
  const thisWeek = weeks[weeks.length - 1].count;
  const goal = profile.workout_days_per_week;
  const eaten = madeToday.reduce((t, m) => ({ kcal: t.kcal + (m.calories ?? 0), protein: t.protein + (m.protein_g ?? 0) }), { kcal: 0, protein: 0 });

  const minDate = addDays(today, -LOG_WINDOW_DAYS);
  const editable = Object.fromEntries(logs.filter((l) => l.log_date >= minDate).map((l) => [l.log_date, l]));
  const latest = trend[trend.length - 1];

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="How it's going" title="Progress">Small check-ins add up. Log what you like, when you like.</PageHeader>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Weight, 7-day average"
          value={latest ? `${show(latest.average)} ${unit}` : "–"}
          sub={change
            ? `${change.change === 0 ? "No change" : `${change.change > 0 ? "+" : "−"}${Math.abs(show(change.change))} ${unit}`} over ${change.days} days`
            : "Log a few weigh-ins to see a trend"}
        />
        <Stat label="Workouts this week" value={`${thisWeek} of ${goal}`} sub={thisWeek >= goal ? "Weekly goal reached" : `${goal - thisWeek} to go`} />
        <Stat
          label="Eaten today (meals you made)"
          value={madeToday.length ? `${eaten.kcal.toLocaleString()} kcal` : "–"}
          sub={madeToday.length
            ? `${eaten.protein} g protein${nutrition ? ` · targets ${nutrition.calorie_target.toLocaleString()} kcal, ${nutrition.protein_target_g} g` : ""}`
            : "Tap “I made this” on a meal to count it"}
        />
      </div>

      <CheckInForm
        key={today}
        today={today}
        minDate={minDate}
        logs={editable}
        imperial={imperial}
        profileWeightKg={profile.weight_kg ?? null}
      />

      <div className="flex items-center gap-2 text-sm" role="group" aria-label="Chart range">
        <span className="text-muted">Weight chart:</span>
        {RANGES.map((r) => (
          <Link
            key={r}
            href={`/progress?range=${r}`}
            scroll={false}
            aria-current={r === range ? "true" : undefined}
            className={`rounded-full border px-3 py-1 ${r === range ? "border-brand bg-brand-soft font-medium text-brand" : "border-line bg-card"}`}
          >
            Last {r} days
          </Link>
        ))}
      </div>

      <Card title="Weight">
        {trend.length ? (
          <WeightChart
            unit={unit}
            points={trend.map((p) => ({ date: p.date, label: shortDate(p.date), weight: show(p.weight), average: show(p.average) }))}
          />
        ) : (
          <p className="text-sm text-muted">No weigh-ins in the last {range} days. Log your weight above to start the chart.</p>
        )}
      </Card>

        <Card title="Workouts per week">
          <BarChart
            caption={`Workouts finished per week, last 8 weeks. Goal ${goal} a week.`}
            unit="workouts"
            goal={goal}
            goalLabel={`Goal ${goal}`}
            data={weeks.map((w) => ({ key: w.week, label: shortDate(w.week), value: w.count, detail: `Week of ${shortDate(w.week)}` }))}
          />
        </Card>
    </div>
  );
}
