import type { ReactNode } from "react";

/** Rounded card. `eyebrow` is the small uppercase label above the title. */
export function Card({ title, children, action, eyebrow, className = "" }: {
  title: string; children: ReactNode; action?: ReactNode; eyebrow?: string; className?: string;
}) {
  return (
    <section className={`rounded-[var(--radius-card)] border border-line bg-card p-5 shadow-[0_1px_2px_rgba(59,50,44,0.04),0_8px_24px_-12px_rgba(184,67,95,0.12)] sm:p-6 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
          <h2 className="text-xl font-semibold">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
