import type { InputHTMLAttributes, ReactNode } from "react";

/** `description` sits under the label (what this is); `hint` sits under the input (how to fill it in). */
export function Field({ label, description, hint, error, children }: {
  label: string; description?: string; hint?: string; error?: string; children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {description && <p className="text-xs text-muted">{description}</p>}
      </div>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm placeholder:text-muted/70 ${props.className ?? ""}`}
    />
  );
}
