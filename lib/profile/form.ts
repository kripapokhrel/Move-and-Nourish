// Converts between what the form holds (strings, display units) and what the server stores (typed, metric).
import { restrictionsFromText, splitRestrictions } from "@/lib/meals/diet";
import type { Profile } from "@/types/database";
import { CUISINES, type Restriction } from "./options";
import { cmToFtIn, ftInToCm, kgToLb, lbToKg } from "./units";

export type ProfileFormState = {
  name: string;
  age: string;
  sex: string;
  unit_system: "metric" | "imperial";
  height_cm: string;
  height_ft: string;
  height_in: string;
  weight: string; // in the selected unit
  fitness_level: string;
  fitness_goal: string;
  workout_location: string;
  available_equipment: string[];
  equipment_other: string;
  workout_days_per_week: string;
  session_duration_min: string;
  dietary_type: string;
  dietary_restrictions: Restriction[];
  /** Typed restrictions, comma-separated */
  restrictions_other: string;
  preferred_cuisines: string[];
  weekly_email_opt_in: boolean;
};

export type SetField = <K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) => void;

export const splitList = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

/** Old free-text cuisines -> the list's spelling. Anything not on the list is dropped. */
const knownCuisines = (a?: string[] | null) =>
  (a ?? []).map((c) => CUISINES.find((o) => o.value.toLowerCase() === c.trim().toLowerCase())?.value).filter((c): c is string => !!c);

export function toFormState(p?: Profile | null): ProfileFormState {
  const unit = p?.unit_system ?? "metric";
  const ftIn = p?.height_cm ? cmToFtIn(p.height_cm) : null;
  return {
    name: p?.name ?? "",
    age: p?.age?.toString() ?? "",
    sex: p?.sex ?? "",
    unit_system: unit,
    height_cm: p?.height_cm?.toString() ?? "",
    height_ft: ftIn?.ft.toString() ?? "",
    height_in: ftIn?.inches.toString() ?? "",
    weight: p?.weight_kg ? String(unit === "imperial" ? kgToLb(p.weight_kg) : p.weight_kg) : "",
    fitness_level: p?.fitness_level ?? "",
    fitness_goal: p?.fitness_goal ?? "",
    workout_location: p?.workout_location ?? "",
    available_equipment: p?.available_equipment ?? [],
    equipment_other: p?.equipment_other ?? "",
    workout_days_per_week: p?.workout_days_per_week ? String(Math.min(p.workout_days_per_week, 6)) : "",
    session_duration_min: String(p?.session_duration_min ?? 45),
    // "Other" is no longer offered, so those users pick again
    dietary_type: p?.dietary_type && p.dietary_type !== ("other" as string) ? p.dietary_type : "",
    // Old profiles had a separate allergies list; carry it over as options so none are lost
    dietary_restrictions: [...new Set([
      ...splitRestrictions(p?.dietary_restrictions ?? []).options,
      ...restrictionsFromText(p?.allergies ?? []),
    ])],
    restrictions_other: splitRestrictions(p?.dietary_restrictions ?? []).typed.join(", "),
    preferred_cuisines: [...new Set(knownCuisines(p?.preferred_cuisines))],
    weekly_email_opt_in: p?.weekly_email_opt_in ?? true,
  };
}

/** Output is validated again on the server with profileInputSchema. */
export function toProfileInput(s: ProfileFormState) {
  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
  const height_cm =
    s.unit_system === "imperial"
      ? s.height_ft ? ftInToCm(Number(s.height_ft), Number(s.height_in || 0)) : undefined
      : num(s.height_cm);
  const w = num(s.weight);
  const weight_kg = w === undefined ? undefined : s.unit_system === "imperial" ? lbToKg(w) : w;

  return {
    name: s.name,
    age: num(s.age),
    sex: s.sex || undefined,
    height_cm,
    weight_kg,
    fitness_level: s.fitness_level || undefined,
    fitness_goal: s.fitness_goal || undefined,
    workout_location: s.workout_location || undefined,
    available_equipment: s.available_equipment,
    equipment_other: s.available_equipment.includes("other") ? s.equipment_other : "",
    workout_days_per_week: num(s.workout_days_per_week),
    session_duration_min: num(s.session_duration_min),
    dietary_type: s.dietary_type || undefined,
    dietary_restrictions: [...new Set([...s.dietary_restrictions, ...splitList(s.restrictions_other)])],
    // Covered by restrictions and 👎 on meals now; saving clears anything left from before
    allergies: [],
    disliked_foods: [],
    preferred_cuisines: s.preferred_cuisines,
    unit_system: s.unit_system,
    weekly_email_opt_in: s.weekly_email_opt_in,
  };
}
