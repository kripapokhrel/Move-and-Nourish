// The weekly summary: what happened this week, what the app has learned, and one thing to try next week.
// Pure and rule-based (no AI): the same data always gives the same email, and every sentence is backed by real numbers.

import type { Inference } from "@/lib/personalization/infer";
import { addDays, weightChange, weightTrend, type ProgressLog } from "@/lib/progress/stats";
import { kgToLb } from "@/lib/profile/units";

export type WeeklyInput = {
  weekStart: string; // Monday
  name: string | null;
  goalDaysPerWeek: number;
  unitSystem: "metric" | "imperial";
  workouts: { name: string; date: string; durationMin: number | null }[];
  mealsMade: { name: string; calories: number | null; protein: number | null }[];
  /** Logs from at least 7 days before weekStart to the end of the week, for the weight trend */
  logs: ProgressLog[];
  /** Learned preferences. Empty when personalization is off. */
  inferences: Inference[];
};

export type WeeklySummary = {
  weekStart: string;
  weekEnd: string;
  greeting: string;
  stats: {
    workouts: number;
    goal: number;
    minutes: number;
    mealsMade: number;
    weightChange: string | null;
    waterDays: number;
  };
  highlights: string[];
  learned: { workouts: string[]; meals: string[] };
  suggestion: string;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** Only confident guesses make it into the email, strongest first, a few per topic. */
const LEARNED_MIN_CONFIDENCE = 0.6;
const LEARNED_PER_TOPIC = 3;

export function buildWeeklySummary(input: WeeklyInput): WeeklySummary {
  const weekEnd = addDays(input.weekStart, 6);
  const inWeek = (d: string) => d >= input.weekStart && d <= weekEnd;
  const workouts = input.workouts.filter((w) => inWeek(w.date));
  const minutes = workouts.reduce((t, w) => t + (w.durationMin ?? 0), 0);
  const goal = input.goalDaysPerWeek;

  const trend = weightTrend(input.logs, addDays(input.weekStart, -7), weekEnd);
  const change = weightChange(trend);
  const imperial = input.unitSystem === "imperial";
  const weightText = change
    ? change.change === 0
      ? "steady"
      : `${change.change > 0 ? "+" : "−"}${Math.abs(imperial ? kgToLb(change.change) : change.change)} ${imperial ? "lb" : "kg"}`
    : null;
  const waterDays = input.logs.filter((l) => inWeek(l.log_date) && (l.water_ml ?? 0) > 0).length;

  const highlights: string[] = [];
  if (workouts.length >= goal && goal > 0) highlights.push(`You hit your goal of ${plural(goal, "workout")}. That's a full week.`);
  else if (workouts.length > 0) highlights.push(`You finished ${plural(workouts.length, "workout")}${minutes ? `, about ${minutes} minutes of movement` : ""}.`);
  if (input.mealsMade.length) {
    const top = input.mealsMade.slice(0, 2).map((m) => m.name).join(" and ");
    highlights.push(`You cooked ${plural(input.mealsMade.length, "meal")} from your ideas, including ${top}.`);
  }
  if (weightText && change) highlights.push(`Your 7-day average weight is ${weightText === "steady" ? "steady" : `${weightText}`} over the last ${change.days} days.`);
  if (waterDays >= 4) highlights.push(`You logged your water on ${waterDays} days.`);
  if (!highlights.length) highlights.push("A quiet week, and that's okay. Rest counts too.");

  const confident = input.inferences
    .filter((i) => i.confidence >= LEARNED_MIN_CONFIDENCE)
    .sort((a, b) => b.confidence - a.confidence);
  const learned = {
    workouts: confident.filter((i) => i.domain === "workout").slice(0, LEARNED_PER_TOPIC).map((i) => `${i.statement} (${i.evidence.charAt(0).toLowerCase()}${i.evidence.slice(1)})`),
    meals: confident.filter((i) => i.domain === "meal").slice(0, LEARNED_PER_TOPIC).map((i) => `${i.statement} (${i.evidence.charAt(0).toLowerCase()}${i.evidence.slice(1)})`),
  };

  return {
    weekStart: input.weekStart,
    weekEnd,
    greeting: input.name?.trim() ? `Hi ${input.name.trim().split(" ")[0]},` : "Hi there,",
    stats: { workouts: workouts.length, goal, minutes, mealsMade: input.mealsMade.length, weightChange: weightText, waterDays },
    highlights,
    learned,
    suggestion: suggestNextWeek(workouts.length, goal, input.inferences),
  };
}

/** One gentle, specific thing to try next week, from the week's numbers and learned patterns. */
export function suggestNextWeek(done: number, goal: number, inferences: Inference[]) {
  const has = (key: string) => inferences.some((i) => i.key === key || i.kind === key);
  if (done === 0) return "Start small: pick one day this week for a 20-minute session and put it in your calendar.";
  if (done < goal) return `You did ${plural(done, "workout")} of ${goal}. Try adding one more session next week, even a short one.`;
  if (inferences.some((i) => i.key === "difficulty:too_easy")) return "Your workouts have felt easy lately. Consider moving your fitness level up in your Profile.";
  if (inferences.some((i) => i.key === "difficulty:too_hard")) return "Your workouts have felt tough. It's fine to take lighter weights or an extra rest day.";
  if (has("skips_cardio")) return "You often skip the cardio finisher. Try just the first two rounds next week.";
  return "Keep your rhythm going, and try one new meal idea this week for variety.";
}
