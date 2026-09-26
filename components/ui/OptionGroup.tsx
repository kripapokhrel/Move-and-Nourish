"use client";

type Option = { value: string; label: string };
const chip = (on: boolean) =>
  `rounded-full border px-4 py-2 text-sm transition-colors ${on ? "border-brand/40 bg-brand-soft text-brand font-semibold" : "border-line bg-card hover:bg-brand-soft/50"}`;

/** Single choice, rendered as a row of chips. */
export function OptionGroup({ options, value, onChange, name }: {
  options: readonly Option[]; value: string; onChange: (v: string) => void; name: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value}
          className={chip(value === o.value)} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Multiple choice. An option named "none" clears the others and vice versa. */
export function MultiOptionGroup({ options, value, onChange, name }: {
  options: readonly Option[]; value: string[]; onChange: (v: string[]) => void; name: string;
}) {
  const toggle = (v: string) => {
    if (value.includes(v)) return onChange(value.filter((x) => x !== v));
    if (v === "none") return onChange(["none"]);
    onChange([...value.filter((x) => x !== "none"), v]);
  };
  return (
    <div role="group" aria-label={name} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value.includes(o.value)}
          className={chip(value.includes(o.value))} onClick={() => toggle(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
