import { describe, expect, it } from "vitest";
import type { Inference } from "@/lib/personalization/infer";
import { renderWeeklyEmail } from "./email";
import { buildWeeklySummary, suggestNextWeek, type WeeklyInput } from "./summary";

const inference = (over: Partial<Inference>): Inference => ({
  key: "quick_meals:30", kind: "quick_meals", domain: "meal", value: 30, statement: "Prefers meals ready in 30 minutes or less",
  evidence: "Most of the 5 meals you kept took 30 minutes or less", confidence: 0.7, n: 5, last: null, ...over,
});
const input = (over: Partial<WeeklyInput> = {}): WeeklyInput => ({
  weekStart: "2026-09-21",
  name: "Kripa Pokhrel",
  goalDaysPerWeek: 3,
  unitSystem: "metric",
  workouts: [
    { name: "Legs Workout", date: "2026-09-22", durationMin: 40 },
    { name: "Push Workout", date: "2026-09-24", durationMin: 35 },
    { name: "Last week", date: "2026-09-15", durationMin: 30 },
  ],
  mealsMade: [{ name: "Chicken burrito bowl", calories: 578, protein: 48 }],
  logs: [
    { log_date: "2026-09-15", weight_kg: 71, steps: null, water_ml: null, measurements: null, notes: null },
    { log_date: "2026-09-26", weight_kg: 70, steps: null, water_ml: 1500, measurements: null, notes: null },
  ],
  inferences: [inference({}), inference({ key: "weak", confidence: 0.52, statement: "Weak guess" })],
  ...over,
});

describe("buildWeeklySummary", () => {
  it("counts only this week, and uses real numbers", () => {
    const s = buildWeeklySummary(input());
    expect(s.weekEnd).toBe("2026-09-27");
    expect(s.greeting).toBe("Hi Kripa,");
    expect(s.stats).toMatchObject({ workouts: 2, goal: 3, minutes: 75, mealsMade: 1, weightChange: "−1 kg" });
    expect(s.highlights[0]).toBe("You finished 2 workouts, about 75 minutes of movement.");
  });

  it("only includes confident learned patterns", () => {
    const s = buildWeeklySummary(input());
    expect(s.learned.meals).toEqual(["Prefers meals ready in 30 minutes or less (most of the 5 meals you kept took 30 minutes or less)"]);
    expect(JSON.stringify(s)).not.toContain("Weak guess");
  });

  it("is kind about a quiet week", () => {
    const s = buildWeeklySummary(input({ workouts: [], mealsMade: [], logs: [], inferences: [] }));
    expect(s.highlights).toEqual(["A quiet week, and that's okay. Rest counts too."]);
    expect(s.suggestion).toMatch(/Start small/);
  });
});

describe("suggestNextWeek", () => {
  it("nudges toward the goal, then toward learned patterns", () => {
    expect(suggestNextWeek(1, 3, [])).toMatch(/1 workout of 3/);
    expect(suggestNextWeek(3, 3, [inference({ key: "difficulty:too_easy", kind: "difficulty", domain: "workout" })])).toMatch(/fitness level/);
  });
});

describe("renderWeeklyEmail", () => {
  it("escapes names and meals, and links to the app and the opt-out", () => {
    const s = buildWeeklySummary(input({ name: "<script>", mealsMade: [{ name: "Toast & <b>jam</b>", calories: 1, protein: 1 }] }));
    const { subject, html, text } = renderWeeklyEmail(s, "https://example.com");
    expect(subject).toBe("Your week with Move & Nourish · Sep 21 – Sep 27");
    expect(html).not.toContain("<script>");
    expect(html).toContain("Toast &amp; &lt;b&gt;jam&lt;/b&gt;");
    expect(html).toContain("https://example.com/dashboard");
    expect(text).toContain("Profile → Emails");
  });
});
