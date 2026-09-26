// What the user can ask to train today. UI, validation and the generator all read from here.
export const WORKOUT_FOCUS = [
  { value: "full_body", label: "Full body" },
  { value: "legs", label: "Legs (quads and hamstrings)" },
  { value: "glutes", label: "Glutes" },
  { value: "push", label: "Push (chest, shoulders, triceps)" },
  { value: "pull", label: "Pull (back, biceps)" },
  { value: "core", label: "Core" },
  { value: "cardio", label: "Cardio" },
  { value: "unsure", label: "Unsure, pick for me" },
] as const;

export type WorkoutFocus = (typeof WORKOUT_FOCUS)[number]["value"];

export const isWorkoutFocus = (v: unknown): v is WorkoutFocus => WORKOUT_FOCUS.some((f) => f.value === v);
