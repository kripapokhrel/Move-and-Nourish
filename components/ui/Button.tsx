import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" };

/** Pill buttons: dark ink for the main action, soft outline for everything else. */
export function Button({ variant = "primary", className = "", ...props }: Props) {
  const styles =
    variant === "primary"
      ? "bg-ink text-card hover:bg-ink/85"
      : "border border-line bg-card text-ink hover:bg-brand-soft";
  return (
    <button
      className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}
