import { z } from "zod";
import {
  CUISINES, DIETARY_TYPE, EQUIPMENT, FITNESS_GOAL, FITNESS_LEVEL, SEX, WORKOUT_LOCATION, values,
} from "./options";

const choice = <T extends readonly { value: string }[]>(opts: T) =>
  z.enum(values(opts), { error: "Pick an option" });
const num = () => z.number({ error: "Required" });

const list = z.array(z.string().trim().min(1).max(60)).max(30).default([]);

// Everything is metric here. The form converts imperial input before calling the action.
export const profileInputSchema = z.object({
  name: z.string({ error: "Tell us your name" }).trim().min(1, "Tell us your name").max(80, "Keep it under 80 characters"),
  age: num().int().min(13, "Must be 13 or older").max(100),
  sex: choice(SEX),
  height_cm: num().min(100, "Height looks too low").max(250, "Height looks too high"),
  weight_kg: num().min(30, "Weight looks too low").max(350, "Weight looks too high"),
  fitness_level: choice(FITNESS_LEVEL),
  fitness_goal: choice(FITNESS_GOAL),
  workout_location: choice(WORKOUT_LOCATION),
  // No longer asked: workouts use the location (gym or home). Older profiles keep what they picked.
  available_equipment: z.array(choice(EQUIPMENT)).default([]),
  equipment_other: z.string().trim().max(200).optional().default(""),
  workout_days_per_week: num().int().min(2).max(7),
  session_duration_min: num().int().min(10).max(180).default(45),
  dietary_type: choice(DIETARY_TYPE),
  // Options from RESTRICTIONS plus anything the user typed
  dietary_restrictions: list,
  // No longer asked: restrictions cover allergies, and 👎 on meals covers dislikes. Saving clears old values.
  allergies: list,
  disliked_foods: list,
  preferred_cuisines: z.array(z.enum(CUISINES.map((c) => c.value) as [string, ...string[]])).max(CUISINES.length).default([]),
  unit_system: z.enum(["metric", "imperial"]).default("metric"),
  weekly_email_opt_in: z.boolean().default(true),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;
