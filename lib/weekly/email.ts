// Turns a weekly summary into an email: HTML with inline styles (email apps ignore stylesheets) plus plain text.
// Colours and type follow the app: cream background, rose accents, serif headings.

import type { WeeklySummary } from "./summary";

const C = { paper: "#fdf6ef", card: "#fffbf7", ink: "#3b322c", muted: "#72655c", rose: "#b8435f", line: "#f0e1d5", peach: "#fbe4dc", sage: "#e3ecdc" };
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

/** Everything the user controls (names, meal names) is escaped before going into HTML. */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const fmtDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function renderWeeklyEmail(s: WeeklySummary, siteUrl: string) {
  const range = `${fmtDay(s.weekStart)} – ${fmtDay(s.weekEnd)}`;
  const subject = `Your week with Move & Nourish · ${range}`;
  const tiles: [string, string][] = [
    ["Workouts", `${s.stats.workouts} of ${s.stats.goal}`],
    ["Meals cooked", String(s.stats.mealsMade)],
    ["Weight trend", s.stats.weightChange ?? "–"],
  ];
  const list = (items: string[]) =>
    `<ul style="margin:8px 0 0;padding-left:18px;color:${C.ink};font:15px/1.5 ${SANS}">${items.map((i) => `<li style="margin:4px 0">${esc(i)}</li>`).join("")}</ul>`;
  const learnedHtml = s.learned.workouts.length || s.learned.meals.length
    ? `<tr><td style="padding:24px 28px 0">
        <p style="margin:0;font:600 11px/1 ${SANS};letter-spacing:.14em;text-transform:uppercase;color:${C.rose}">What we've learned</p>
        ${s.learned.workouts.length ? `<p style="margin:12px 0 0;font:600 14px ${SANS};color:${C.muted}">Workouts</p>${list(s.learned.workouts)}` : ""}
        ${s.learned.meals.length ? `<p style="margin:12px 0 0;font:600 14px ${SANS};color:${C.muted}">Meals</p>${list(s.learned.meals)}` : ""}
      </td></tr>`
    : "";

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body style="margin:0;background:${C.paper}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper}"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${C.card};border:1px solid ${C.line};border-radius:24px">
  <tr><td style="padding:28px 28px 0">
    <p style="margin:0;font:600 11px/1 ${SANS};letter-spacing:.14em;text-transform:uppercase;color:${C.rose}">Your week · ${esc(range)}</p>
    <h1 style="margin:10px 0 0;font:600 28px/1.2 ${SERIF};color:${C.ink}">${esc(s.greeting)} here's how it went</h1>
  </td></tr>
  <tr><td style="padding:20px 28px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      ${tiles.map(([label, value]) => `<td width="33%" style="padding:4px"><div style="background:${C.peach};border-radius:16px;padding:14px 12px">
        <div style="font:13px ${SANS};color:${C.muted}">${label}</div>
        <div style="font:600 22px ${SERIF};color:${C.ink};margin-top:4px">${esc(value)}</div></div></td>`).join("")}
    </tr></table>
  </td></tr>
  <tr><td style="padding:20px 28px 0">${list(s.highlights)}</td></tr>
  ${learnedHtml}
  <tr><td style="padding:24px 28px 0">
    <div style="background:${C.sage};border-radius:16px;padding:16px 18px">
      <p style="margin:0;font:600 16px ${SERIF};color:${C.ink}">For next week</p>
      <p style="margin:6px 0 0;font:15px/1.5 ${SANS};color:${C.ink}">${esc(s.suggestion)}</p>
    </div>
  </td></tr>
  <tr><td style="padding:24px 28px 28px">
    <a href="${siteUrl}/dashboard" style="display:inline-block;background:${C.ink};color:${C.card};font:600 14px ${SANS};text-decoration:none;padding:12px 22px;border-radius:999px">Open Move &amp; Nourish →</a>
    <p style="margin:20px 0 0;font:12px/1.5 ${SANS};color:${C.muted}">You get this every Sunday. Turn it off anytime under Profile → Emails.</p>
  </td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    `${s.greeting} here's your week (${range}).`,
    "",
    ...tiles.map(([l, v]) => `${l}: ${v}`),
    "",
    ...s.highlights.map((h) => `• ${h}`),
    ...(s.learned.workouts.length || s.learned.meals.length
      ? ["", "What we've learned:", ...s.learned.workouts.map((l) => `• ${l}`), ...s.learned.meals.map((l) => `• ${l}`)]
      : []),
    "",
    `For next week: ${s.suggestion}`,
    "",
    `Open the app: ${siteUrl}/dashboard`,
    "You get this every Sunday. Turn it off anytime under Profile → Emails.",
  ].join("\n");

  return { subject, html, text };
}
