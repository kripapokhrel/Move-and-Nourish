// Stage 2 prep: a short text profile an AI can read instead of the user's whole history.
// Only confident inferences and explicit answers go in; raw events never leave the database.

import { DIETARY_TYPE, FITNESS_GOAL, FITNESS_LEVEL, labelFor } from "@/lib/profile/options";
import type { Profile } from "@/types/database";
import { byKind, type Explicit, type Inference } from "./infer";
import type { Signals } from "./signals";

const list = (xs: (string | number)[], max = 4) => xs.slice(0, max).join(", ");

export function buildPreferenceSummary(
  profile: Pick<Profile, "fitness_goal" | "fitness_level" | "dietary_type" | "session_duration_min" | "preferred_cuisines" | "disliked_foods" | "allergies"> | null,
  inferences: Inference[],
  x: Explicit,
  signals: Pick<Signals, "workouts"> | null,
): string {
  const lines: string[] = [];
  const line = (label: string, value: string | null | undefined) => value && lines.push(`${label}: ${value}`);
  const values = (kind: Parameters<typeof byKind>[1]) => byKind(inferences, kind).map((i) => i.value);
  const explicit = (category: string, sentiment: "like" | "dislike") =>
    x.preferences.filter((p) => p.category === category && p.sentiment === sentiment).map((p) => p.value);

  if (profile) {
    line("User goal", profile.fitness_goal && labelFor(FITNESS_GOAL, profile.fitness_goal));
    line("Fitness level", profile.fitness_level && labelFor(FITNESS_LEVEL, profile.fitness_level));
    line("Diet", profile.dietary_type && labelFor(DIETARY_TYPE, profile.dietary_type));
    line("Allergies (never include)", list(profile.allergies, 10));
    line("Disliked foods (never include)", list([...profile.disliked_foods, ...explicit("ingredient", "dislike")], 10));
    line("Preferred cuisines (stated)", list([...profile.preferred_cuisines, ...explicit("cuisine", "like")]));
  }

  // Learned, labelled as such so the AI treats them as tendencies, not rules
  line("Often chooses cuisines (learned)", list(values("favor_cuisine")));
  const quick = byKind(inferences, "quick_meals")[0];
  line("Preferred meal prep time (learned)", quick ? `under ${quick.value} minutes` : null);
  line("Frequently saved foods (learned)", list(values("favor_ingredient"), 6));
  line("Frequently rejected foods (learned)", list(values("avoid_ingredient"), 6));
  line("Meal style (learned)", byKind(inferences, "high_protein").length ? "high protein" : null);
  line("Meal complaints (learned)", list(byKind(inferences, "meal_complaint").map((i) => i.statement.toLowerCase())));

  const duration = byKind(inferences, "workout_duration")[0];
  line("Preferred workout duration", duration
    ? `${duration.statement.replace("Usually works out for ", "")} (learned)`
    : profile ? `${profile.session_duration_min} minutes (stated)` : null);
  line("Preferred equipment (learned)", list(values("favor_gear")));
  line("Preferred workout focus (learned)", list(values("favor_focus")));
  line("Frequently completed exercises (learned)", list(values("favor_exercise"), 5));
  line("Frequently skipped exercises (learned)", list(values("avoid_exercise"), 5));
  line("Favourite exercises (stated)", list(explicit("exercise", "like"), 5));
  line("Never suggest (stated)", list(explicit("exercise", "dislike"), 10));
  line("Skips cardio finisher (learned)", byKind(inferences, "skips_cardio").length ? "yes" : null);
  line("Recent difficulty (learned)", byKind(inferences, "difficulty")[0]?.statement.toLowerCase());
  if (signals && signals.workouts.completed.n > 0) line("Workouts per week (recent)", String(signals.workouts.per_week));

  return lines.join("\n");
}
