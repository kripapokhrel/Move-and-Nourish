import Link from "next/link";
import { signOut } from "@/lib/auth/actions";
import { FITNESS_LEVEL, labelFor } from "@/lib/profile/options";
import { Logo } from "./Logo";
import { NavLinks } from "./NavLinks";

export function AppNav({ name, email, level }: { name: string | null; email: string | null; level: string | null }) {
  const display = name?.trim() || email?.split("@")[0] || "You";
  return (
    <header>
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 sm:px-6">
        <Link href="/dashboard" aria-label="Move & Nourish home"><Logo /></Link>
        <div className="order-3 w-full sm:order-none sm:w-auto"><NavLinks /></div>
        <details className="relative">
          <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-full border border-line bg-card/80 py-1.5 pl-1.5 pr-4 shadow-sm">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft font-display text-lg font-semibold text-brand">
              {display.charAt(0).toUpperCase()}
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold">{display}</span>
              {level && <span className="block text-xs text-muted">{labelFor(FITNESS_LEVEL, level)}</span>}
            </span>
          </summary>
          <div className="absolute right-0 z-20 mt-2 w-44 rounded-2xl border border-line bg-card p-1.5 text-sm shadow-lg">
            <Link href="/profile" className="block rounded-xl px-3 py-2 hover:bg-brand-soft">Profile</Link>
            <form action={signOut}>
              <button type="submit" className="w-full rounded-xl px-3 py-2 text-left hover:bg-brand-soft">Log out</button>
            </form>
          </div>
        </details>
      </nav>
    </header>
  );
}
