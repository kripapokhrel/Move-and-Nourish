"use client";
// Small SVG charts for the progress page. One series each (the weight chart adds de-emphasised raw readings),
// thin marks, recessive grid, a hover/focus tooltip and a table view so nothing depends on hovering.
import { useEffect, useRef, useState, type ReactNode } from "react";

const INK = "#3b322c";
const MUTED = "#72655c";
const GRID = "#f0e1d5";
const SERIES = "#c94f6d"; // rose
const SECONDARY = "#6f8fb0"; // raw readings, muted slate (validated on the card: contrast >= 3:1, CVD ΔE 9.9 from SERIES)
const SURFACE = "#fffbf7";
const HEIGHT = 180;
const PAD = { top: 12, right: 12, bottom: 26 };
// Left margin fits the widest y-axis label (about 6.5px per character at 11px)
const leftPad = (ticks: number[], unit?: string) =>
  12 + 6.5 * Math.max(...ticks.map((t) => `${fmt(t)}${unit && t === ticks[ticks.length - 1] ? ` ${unit}` : ""}`.length));

/**
 * Which x labels to draw: every `every`-th, dropping any that would crowd the last one, which is always shown.
 */
const showLabel = (i: number, count: number, every: number) =>
  i === count - 1 || (i % every === 0 && count - 1 - i >= every);

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

/** Clean axis ticks: 3–5 round numbers covering the range. */
function niceTicks(min: number, max: number, count = 4) {
  if (min === max) { min -= 1; max += 1; }
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });

function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const left = Math.min(Math.max(x - 70, 0), Math.max(0, width - 140));
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 w-[140px] rounded-xl border border-line bg-card px-2.5 py-1.5 text-xs shadow-sm"
      style={{ left, top: Math.max(0, y - 58) }}
    >
      {children}
    </div>
  );
}

function TableView({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="text-xs text-muted">
      <summary className="cursor-pointer">Show as table</summary>
      <table className="mt-2 w-full text-left tabular-nums">
        <caption className="sr-only">{caption}</caption>
        <thead><tr>{head.map((h) => <th key={h} className="py-1 font-medium">{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={String(r[0])} className="border-t border-line">{r.map((c, i) => <td key={i} className="py-1">{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function YGrid({ ticks, y, width, left, unit }: { ticks: number[]; y: (v: number) => number; width: number; left: number; unit?: string }) {
  return (
    <g>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
          <text x={left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={MUTED} className="tabular-nums">
            {fmt(t)}{unit && t === ticks[ticks.length - 1] ? ` ${unit}` : ""}
          </text>
        </g>
      ))}
    </g>
  );
}

export type WeightChartPoint = { date: string; label: string; weight: number; average: number };

/** Daily weigh-ins as grey dots, the 7-day average as the green line. */
export function WeightChart({ points, unit }: { points: WeightChartPoint[]; unit: string }) {
  const { ref, width } = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  if (!points.length) return null;

  const values = points.flatMap((p) => [p.weight, p.average]);
  const ticks = niceTicks(Math.min(...values), Math.max(...values));
  const left = leftPad(ticks, unit);
  const innerW = Math.max(1, width - left - PAD.right);
  const x = (i: number) => left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.top + (1 - (v - ticks[0]) / (ticks[ticks.length - 1] - ticks[0])) * (HEIGHT - PAD.top - PAD.bottom);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.average)}`).join(" ");
  const nearest = (clientX: number, rect: DOMRect) => {
    const px = clientX - rect.left;
    let best = 0;
    points.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i; });
    return best;
  };
  const labelEvery = Math.ceil(points.length / Math.max(2, Math.floor(innerW / 70)));
  const h = hover === null ? null : points[hover];

  return (
    <div className="space-y-2">
      <div className="flex gap-4 text-xs text-muted" aria-hidden>
        <span className="flex items-center gap-1.5"><svg width="10" height="10"><circle cx="5" cy="5" r="4" fill={SECONDARY} /></svg>Weigh-in</span>
        <span className="flex items-center gap-1.5"><svg width="16" height="10"><line x1="0" x2="16" y1="5" y2="5" stroke={SERIES} strokeWidth="2" /></svg>7-day average</span>
      </div>
      <div ref={ref} className="relative">
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`Weight over time, 7-day average from ${fmt(points[0].average)} to ${fmt(points[points.length - 1].average)} ${unit}`}
            tabIndex={0}
            onPointerMove={(e) => setHover(nearest(e.clientX, e.currentTarget.getBoundingClientRect()))}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(points.length - 1)}
            onBlur={() => setHover(null)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") setHover((i) => Math.max(0, (i ?? points.length) - 1));
              if (e.key === "ArrowRight") setHover((i) => Math.min(points.length - 1, (i ?? -1) + 1));
            }}
            className="touch-none outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <YGrid ticks={ticks} y={y} width={width} left={left} unit={unit} />
            {points.map((p, i) => showLabel(i, points.length, labelEvery) && (
              <text key={p.date} x={x(i)} y={HEIGHT - 8} fontSize={11} fill={MUTED}
                textAnchor={i === points.length - 1 && points.length > 1 ? "end" : i === 0 && points.length > 1 ? "start" : "middle"}>
                {p.label}
              </text>
            ))}
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke={MUTED} strokeWidth={1} />}
            {points.map((p, i) => (
              <circle key={p.date} cx={x(i)} cy={y(p.weight)} r={4} fill={SECONDARY} stroke={SURFACE} strokeWidth={2} />
            ))}
            <path d={line} fill="none" stroke={SERIES} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={x(points.length - 1)} cy={y(points[points.length - 1].average)} r={4.5} fill={SERIES} stroke={SURFACE} strokeWidth={2} />
          </svg>
        )}
        {h && hover !== null && (
          <Tooltip x={x(hover)} y={y(h.average)} width={width}>
            <p className="text-muted">{h.label}</p>
            <p><strong className="text-ink">{fmt(h.average)} {unit}</strong> <span className="text-muted">7-day avg</span></p>
            <p><strong className="text-ink">{fmt(h.weight)} {unit}</strong> <span className="text-muted">weigh-in</span></p>
          </Tooltip>
        )}
      </div>
      <TableView
        caption="Weight"
        head={["Date", `Weigh-in (${unit})`, `7-day average (${unit})`]}
        rows={[...points].reverse().map((p) => [p.label, fmt(p.weight), fmt(p.average)])}
      />
    </div>
  );
}

export type BarDatum = { key: string; label: string; value: number | null; detail?: string };

/** Columns from one baseline. Empty days/weeks show no bar, and the tooltip says so. */
export function BarChart({ data, unit, goal, goalLabel, caption }: {
  data: BarDatum[];
  unit: string;
  /** Optional reference line, e.g. workouts per week the user aims for */
  goal?: number;
  goalLabel?: string;
  caption: string;
}) {
  const { ref, width } = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(goal ?? 0, ...data.map((d) => d.value ?? 0), 1);
  const ticks = niceTicks(0, max, 3).filter((t) => t >= 0);
  const top = ticks[ticks.length - 1];
  const left = leftPad(ticks);
  const innerW = Math.max(1, width - left - PAD.right);
  const band = innerW / data.length;
  const barW = Math.min(24, band - 2);
  const x = (i: number) => left + band * i + (band - barW) / 2;
  const y = (v: number) => PAD.top + (1 - v / top) * (HEIGHT - PAD.top - PAD.bottom);
  const base = y(0);
  const labelEvery = Math.ceil(data.length / Math.max(2, Math.floor(innerW / 44)));
  const h = hover === null ? null : data[hover];

  return (
    <div className="space-y-2">
      <div ref={ref} className="relative">
        {width > 0 && (
          <svg width={width} height={HEIGHT} role="img" aria-label={caption} onPointerLeave={() => setHover(null)}>
            <YGrid ticks={ticks} y={y} width={width} left={left} />
            {goal !== undefined && (
              <g>
                <line x1={left} x2={width - PAD.right} y1={y(goal)} y2={y(goal)} stroke={INK} strokeWidth={1} opacity={0.5} />
                <text x={width - PAD.right} y={y(goal) - 4} textAnchor="end" fontSize={11} fill={MUTED}>{goalLabel}</text>
              </g>
            )}
            {data.map((d, i) => {
              const v = d.value ?? 0;
              const top = y(v);
              const r = Math.min(4, (base - top) / 2, barW / 2);
              // Rounded data end, square at the baseline
              const path = v > 0
                ? `M${x(i)},${base} V${top + r} Q${x(i)},${top} ${x(i) + r},${top} H${x(i) + barW - r} Q${x(i) + barW},${top} ${x(i) + barW},${top + r} V${base} Z`
                : "";
              return (
                <g
                  key={d.key}
                  tabIndex={0}
                  role="img"
                  aria-label={`${d.label}: ${d.value === null ? "nothing logged" : `${fmt(v)} ${unit}`}`}
                  onPointerEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className="outline-none"
                >
                  {/* Hit area: the whole column, bigger than the bar */}
                  <rect x={left + band * i} y={PAD.top} width={band} height={base - PAD.top} fill="transparent" />
                  {path && <path d={path} fill={SERIES} opacity={hover === null || hover === i ? 1 : 0.55} />}
                  {showLabel(i, data.length, labelEvery) && (
                    <text x={i === data.length - 1 ? x(i) + barW : x(i) + barW / 2} y={HEIGHT - 8} fontSize={11} fill={MUTED}
                      textAnchor={i === data.length - 1 ? "end" : "middle"}>
                      {d.label}
                    </text>
                  )}
                </g>
              );
            })}
            <line x1={left} x2={width - PAD.right} y1={base} y2={base} stroke={MUTED} strokeWidth={1} />
          </svg>
        )}
        {h && hover !== null && (
          <Tooltip x={x(hover) + barW / 2} y={y(h.value ?? 0)} width={width}>
            <p className="text-muted">{h.detail ?? h.label}</p>
            <p>{h.value === null ? <span className="text-muted">Nothing logged</span> : <strong className="text-ink">{fmt(h.value)} {unit}</strong>}</p>
          </Tooltip>
        )}
      </div>
      <TableView caption={caption} head={["", unit]} rows={[...data].reverse().map((d) => [d.detail ?? d.label, d.value === null ? "–" : fmt(d.value)])} />
    </div>
  );
}
