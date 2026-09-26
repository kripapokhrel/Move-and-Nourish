import { z } from "zod";

const optional = (schema: z.ZodNumber) => schema.nullable().default(null);

// Everything is metric here. The form converts imperial input before calling the action.
export const progressInputSchema = z.object({
  log_date: z.iso.date({ error: "Pick a date" }),
  weight_kg: optional(z.number({ error: "Weight must be a number" }).min(30, "Weight looks too low").max(350, "Weight looks too high")),
  waist_cm: optional(z.number({ error: "Waist must be a number" }).min(40, "Waist looks too small").max(250, "Waist looks too big")),
  water_ml: optional(z.number().int().min(0).max(10_000)),
  notes: z.string().trim().max(500, "Keep notes under 500 characters").default(""),
});

export type ProgressInput = z.infer<typeof progressInputSchema>;

/** Logs can be added or fixed for the last 60 days, never the future. */
export const LOG_WINDOW_DAYS = 60;
