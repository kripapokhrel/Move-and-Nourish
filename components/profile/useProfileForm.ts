"use client";
import { useState } from "react";
import { toFormState, toProfileInput, type ProfileFormState, type SetField } from "@/lib/profile/form";
import { profileInputSchema } from "@/lib/profile/schema";
import type { Profile } from "@/types/database";

export function useProfileForm(initial?: Profile | null) {
  const [state, setState] = useState<ProfileFormState>(() => toFormState(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set: SetField = (key, value) => {
    setState((s) => ({ ...s, [key]: value }));
    setErrors((e) => {
      if (!Object.keys(e).length) return e;
      const next = { ...e };
      delete next[key as string];
      if (key === "weight") delete next.weight_kg;
      if (String(key).startsWith("height")) delete next.height_cm;
      return next;
    });
  };

  /** Client-side check, optionally limited to some fields (one onboarding step). */
  const validate = (fields?: string[]) => {
    const result = profileInputSchema.safeParse(toProfileInput(state));
    if (result.success) { setErrors({}); return true; }
    const found: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0]);
      if (!fields || fields.includes(key)) found[key] ??= issue.message;
    }
    setErrors(found);
    return Object.keys(found).length === 0;
  };

  return { state, set, errors, setErrors, validate, toInput: () => toProfileInput(state) };
}
