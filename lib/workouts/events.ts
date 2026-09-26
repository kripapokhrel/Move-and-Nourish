// Builds the personalization events for workout actions, so every caller records the same facts.

import { exerciseKey, type ExerciseEventMeta, type NewEvent, type WorkoutEventType } from "@/lib/personalization/events";
import type { Stage } from "./generator";
import { findExercise } from "./library";

export function exerciseMeta(name: string, stage: Stage): ExerciseEventMeta {
  const e = findExercise(name);
  return e ? { stage, muscle: e.muscle, gear: e.needs, pattern: e.pattern } : { stage, custom: true };
}

export const exerciseEvent = (
  type: WorkoutEventType, name: string, stage: Stage, extra: ExerciseEventMeta = {},
): NewEvent => ({ event_type: type, entity_type: "exercise", entity_id: exerciseKey(name), metadata: { ...exerciseMeta(name, stage), ...extra } });
