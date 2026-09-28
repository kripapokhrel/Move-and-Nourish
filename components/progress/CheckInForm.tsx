"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, TextInput } from "@/components/ui/Field";
import { applyWeightToTargetsAction, deleteProgressAction, saveProgressAction } from "@/lib/progress/actions";
import { GLASS_ML, type ProgressLog } from "@/lib/progress/stats";
import { kgToLb, lbToKg } from "@/lib/profile/units";

const cmToIn = (cm: number) => Math.round((cm / 2.54) * 10) / 10;
const inToCm = (inches: number) => Math.round(inches * 2.54 * 10) / 10;

type Values = { weight: string; waist: string; glasses: number; notes: string };

function toValues(log: ProgressLog | undefined, imperial: boolean): Values {
  const waist = log?.measurements?.waist_cm;
  return {
    weight: log?.weight_kg ? String(imperial ? kgToLb(log.weight_kg) : log.weight_kg) : "",
    waist: waist ? String(imperial ? cmToIn(waist) : waist) : "",
    glasses: log?.water_ml ? Math.round(log.water_ml / GLASS_ML) : 0,
    notes: log?.notes ?? "",
  };
}

/** Log a day: any mix of weight, waist, water and a note. Logging the same day again updates it. */
export function CheckInForm({ today, minDate, logs, imperial, profileWeightKg }: {
  today: string;
  minDate: string;
  /** Logs in the editable window, by date */
  logs: Record<string, ProgressLog>;
  imperial: boolean;
  profileWeightKg: number | null;
}) {
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [v, setV] = useState<Values>(() => toValues(logs[today], imperial));
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [offerWeight, setOfferWeight] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const existing = logs[date];
  const set = <K extends keyof Values>(k: K, value: Values[K]) => { setV((s) => ({ ...s, [k]: value })); setStatus(null); };
  const num = (s: string) => (s.trim() === "" ? null : Number(s));

  const pickDate = (d: string) => {
    setDate(d);
    setV(toValues(logs[d], imperial));
    setStatus(null);
    setOfferWeight(null);
  };

  const save = () => {
    const weight = num(v.weight);
    const waist = num(v.waist);
    const weightKg = weight === null ? null : imperial ? lbToKg(weight) : weight;
    start(async () => {
      const res = await saveProgressAction({
        log_date: date,
        weight_kg: weightKg,
        waist_cm: waist === null ? null : imperial ? inToCm(waist) : waist,
        water_ml: v.glasses * GLASS_ML,
        notes: v.notes,
      });
      if (!res.ok) return setStatus({ ok: false, text: res.error });
      setStatus({ ok: true, text: "Saved." });
      // Targets are worked out from the profile weight; offer to update when today's weight has moved
      if (weightKg !== null && date === today && profileWeightKg !== null && Math.abs(weightKg - profileWeightKg) >= 1) {
        setOfferWeight(weightKg);
      }
      router.refresh();
    });
  };

  const applyWeight = () => start(async () => {
    const res = await applyWeightToTargetsAction(offerWeight);
    setOfferWeight(null);
    setStatus(res.ok ? { ok: true, text: "Profile weight updated. Your targets were recalculated." } : { ok: false, text: res.error });
    router.refresh();
  });

  const remove = () => start(async () => {
    const res = await deleteProgressAction(date);
    if (!res.ok) return setStatus({ ok: false, text: res.error });
    setV(toValues(undefined, imperial));
    setStatus({ ok: true, text: "Deleted." });
    router.refresh();
  });

  return (
    <Card title={date === today ? "Log today" : "Log a past day"}>
      <div className="space-y-4">
        <Field label="Day">
          <TextInput type="date" value={date} min={minDate} max={today} onChange={(e) => e.target.value && pickDate(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Weight (${imperial ? "lb" : "kg"})`}>
            <TextInput aria-label={`Weight (${imperial ? "lb" : "kg"})`} type="number" inputMode="decimal" step="0.1" value={v.weight} onChange={(e) => set("weight", e.target.value)} />
          </Field>
          <Field label={`Waist (${imperial ? "in" : "cm"}, optional)`}>
            <TextInput aria-label={`Waist (${imperial ? "in" : "cm"})`} type="number" inputMode="decimal" step="0.1" value={v.waist} onChange={(e) => set("waist", e.target.value)} />
          </Field>
        </div>
        <Field label="Water">
          <div className="flex items-center gap-3">
            <Button variant="secondary" aria-label="One glass less" disabled={v.glasses === 0} onClick={() => set("glasses", v.glasses - 1)}>−</Button>
            <span className="min-w-28 text-center text-sm tabular-nums">
              {v.glasses} {v.glasses === 1 ? "glass" : "glasses"} <span className="text-muted">({imperial ? `${Math.round((v.glasses * GLASS_ML) / 29.57)} fl oz` : `${(v.glasses * GLASS_ML) / 1000} L`})</span>
            </span>
            <Button variant="secondary" aria-label="One glass more" disabled={v.glasses >= 20} onClick={() => set("glasses", v.glasses + 1)}>+</Button>
          </div>
        </Field>
        <Field label="Note (optional)">
          <TextInput placeholder="e.g. slept badly, felt strong" maxLength={500} value={v.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={pending}>{pending ? "Saving…" : existing ? "Update" : "Save"}</Button>
          {existing && <Button variant="secondary" onClick={remove} disabled={pending}>Delete this day</Button>}
          {status && <p className={`text-sm ${status.ok ? "text-brand" : "text-danger"}`}>{status.text}</p>}
        </div>
        {offerWeight !== null && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-brand-soft/60 p-3 text-sm">
            <span>Your targets use your profile weight. Update it to today&apos;s weight?</span>
            <Button variant="secondary" disabled={pending} onClick={applyWeight}>Update my targets</Button>
            <button type="button" className="text-xs text-muted underline" onClick={() => setOfferWeight(null)}>Not now</button>
          </div>
        )}
        <p className="text-xs text-muted">
          Weight naturally moves {imperial ? "2–4 lb" : "1–2 kg"} from day to day. The 7-day average at the top shows the real trend.
        </p>
      </div>
    </Card>
  );
}
