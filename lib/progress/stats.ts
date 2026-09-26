// Progress numbers for the charts and summaries. Pure: dates come in as YYYY-MM-DD strings and "today" is passed in.

export type ProgressLog = {
  log_date: string;
  weight_kg: number | null;
  steps: number | null;
  water_ml: number | null;
  measurements: { waist_cm?: number } | null;
  notes: string | null;
};

const DAY = 86_400_000;
const toTime = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
export const addDays = (iso: string, days: number) => new Date(toTime(iso) + days * DAY).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => Math.round((toTime(b) - toTime(a)) / DAY);

/** Monday of the week a date falls in. */
export function weekStart(iso: string) {
  const day = new Date(toTime(iso)).getUTCDay(); // 0 = Sunday
  return addDays(iso, -((day + 6) % 7));
}

export type WeightPoint = { date: string; weight: number; average: number };

/**
 * Weight readings with a 7-day rolling average. Daily weight swings 1–2 kg with water and food, so the average is
 * what shows the real trend.
 */
export function weightTrend(logs: ProgressLog[], from: string, to: string): WeightPoint[] {
  const readings = logs
    .filter((l) => l.weight_kg !== null && l.log_date >= addDays(from, -6) && l.log_date <= to)
    .map((l) => ({ date: l.log_date, weight: Number(l.weight_kg) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return readings
    .filter((r) => r.date >= from)
    .map((r) => {
      const window = readings.filter((x) => x.date <= r.date && daysBetween(x.date, r.date) < 7);
      const average = window.reduce((t, x) => t + x.weight, 0) / window.length;
      return { ...r, average: Math.round(average * 10) / 10 };
    });
}

/** Change in the 7-day average between the first and last reading in range. Needs readings a week apart. */
export function weightChange(points: WeightPoint[]) {
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const days = daysBetween(first.date, last.date);
  if (days < 7) return null;
  return { change: Math.round((last.average - first.average) * 10) / 10, days };
}

export type WeekCount = { week: string; count: number };

/** Workouts finished per week (weeks start Monday), oldest first, including weeks with none. */
export function workoutsPerWeek(completedDates: string[], today: string, weeks = 8): WeekCount[] {
  const current = weekStart(today);
  return Array.from({ length: weeks }, (_, i) => {
    const week = addDays(current, -7 * (weeks - 1 - i));
    const end = addDays(week, 7);
    return { week, count: completedDates.filter((d) => d >= week && d < end).length };
  });
}

/** Glass size for the water buttons. */
export const GLASS_ML = 250;
