import { describe, expect, it } from "vitest";
import { addDays, weekStart, weightChange, weightTrend, workoutsPerWeek, type ProgressLog } from "./stats";

const log = (log_date: string, weight_kg: number | null, steps: number | null = null): ProgressLog =>
  ({ log_date, weight_kg, steps, water_ml: null, measurements: null, notes: null });

describe("dates", () => {
  it("adds days across months and finds Monday", () => {
    expect(addDays("2026-09-30", 2)).toBe("2026-10-02");
    expect(weekStart("2026-09-27")).toBe("2026-09-21"); // Sunday -> previous Monday
    expect(weekStart("2026-09-21")).toBe("2026-09-21");
  });
});

describe("weightTrend", () => {
  it("smooths daily swings with a 7-day average, using readings from before the range too", () => {
    const logs = [log("2026-09-01", 70), log("2026-09-05", 72), log("2026-09-08", 71), log("2026-09-20", 69)];
    const points = weightTrend(logs, "2026-09-08", "2026-09-26");
    expect(points.map((p) => p.date)).toEqual(["2026-09-08", "2026-09-20"]);
    expect(points[0].average).toBe(71.5); // 72 and 71 are within 7 days; 70 on the 1st is not
    expect(points[1].average).toBe(69);
  });

  it("only reports a change once readings are a week apart", () => {
    expect(weightChange(weightTrend([log("2026-09-20", 70), log("2026-09-24", 69)], "2026-09-01", "2026-09-26"))).toBeNull();
    expect(weightChange(weightTrend([log("2026-09-01", 70), log("2026-09-20", 68.5)], "2026-09-01", "2026-09-26")))
      .toEqual({ change: -1.5, days: 19 });
  });
});

describe("workoutsPerWeek", () => {
  it("counts per Monday-start week, including empty weeks", () => {
    const weeks = workoutsPerWeek(["2026-09-21", "2026-09-23", "2026-09-26", "2026-09-10"], "2026-09-26", 3);
    expect(weeks).toEqual([
      { week: "2026-09-07", count: 1 },
      { week: "2026-09-14", count: 0 },
      { week: "2026-09-21", count: 3 },
    ]);
  });
});
