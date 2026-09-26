"use client";
// Where a meal's calories come from: protein, carbs and fat as slices of a donut, calories in the middle.
// Colours validated for colour-blind separation on the card surface (all pairs); carbs' butter yellow is below 3:1
// contrast, so the legend always names each slice with grams and % beside it.
import { useState } from "react";

const MACROS = [
  { key: "protein", label: "Protein", color: "#c94f6d", kcalPerGram: 4 },
  { key: "carbs", label: "Carbs", color: "#dfa21f", kcalPerGram: 4 },
  { key: "fat", label: "Fat", color: "#3f7fbf", kcalPerGram: 9 },
] as const;

const SURFACE = "#fffbf7";
const SIZE = 88;
const STROKE = 14;

/** Percentages that add up to exactly 100 (largest remainders get the rounding). */
function shares(kcal: number[]) {
  const total = kcal.reduce((a, b) => a + b, 0);
  if (!total) return kcal.map(() => 0);
  const raw = kcal.map((k) => (k / total) * 100);
  const floored = raw.map(Math.floor);
  let left = 100 - floored.reduce((a, b) => a + b, 0);
  raw.map((r, i) => ({ i, rest: r - floored[i] })).sort((a, b) => b.rest - a.rest).forEach(({ i }) => {
    if (left-- > 0) floored[i] += 1;
  });
  return floored;
}

export function MacroDonut({ calories, protein, carbs, fat }: {
  calories: number | null; protein: number | null; carbs: number | null; fat: number | null;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const grams = [protein ?? 0, carbs ?? 0, fat ?? 0];
  const kcal = grams.map((g, i) => g * MACROS[i].kcalPerGram);
  const pct = shares(kcal);
  const total = kcal.reduce((a, b) => a + b, 0);
  if (!total) return null;

  const r = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const gap = 2; // surface gap between slices, in px along the ring
  let offset = 0;
  const arcs = kcal.map((k, i) => {
    const length = (k / total) * circumference;
    const arc = { i, dash: Math.max(0, length - gap), offset };
    offset += length;
    return arc;
  });

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img"
          aria-label={`${calories ?? Math.round(total)} kcal: ${MACROS.map((m, i) => `${m.label.toLowerCase()} ${pct[i]}%`).join(", ")}`}>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={r} fill="none" stroke={SURFACE} strokeWidth={STROKE} />
          <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            {arcs.map(({ i, dash, offset: o }) => dash > 0 && (
              <circle
                key={MACROS[i].key}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={r}
                fill="none"
                stroke={MACROS[i].color}
                strokeWidth={hover === i ? STROKE + 3 : STROKE}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-o}
                opacity={hover === null || hover === i ? 1 : 0.45}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
              />
            ))}
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className="text-base font-semibold">{calories ?? Math.round(total)}</span>
          <span className="text-[10px] text-muted">kcal</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1 text-sm">
        {MACROS.map((m, i) => (
          <li
            key={m.key}
            tabIndex={0}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            className={`flex items-center gap-2 rounded px-1 outline-none focus-visible:ring-2 focus-visible:ring-brand ${hover === i ? "bg-paper" : ""}`}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: m.color }} aria-hidden />
            <span className="flex-1">{m.label}</span>
            <span className="font-semibold tabular-nums">{grams[i]} g</span>
            <span className="w-9 text-right text-xs text-muted tabular-nums">{pct[i]}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
