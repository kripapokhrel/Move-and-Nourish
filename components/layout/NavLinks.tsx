"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Home" },
  { href: "/workouts", label: "Workouts" },
  { href: "/meals", label: "Meals" },
  { href: "/progress", label: "Progress" },
];

/** Page links with a small peach marker under the current one. */
export function NavLinks() {
  const path = usePathname();
  return (
    <ul className="flex items-center gap-1 sm:gap-6">
      {LINKS.map((l) => {
        const active = path === l.href || path.startsWith(`${l.href}/`);
        return (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={`relative block px-2 py-2 text-[15px] font-medium transition-colors ${active ? "text-ink" : "text-muted hover:text-ink"}`}
            >
              {l.label}
              {active && <span className="absolute inset-x-0 -bottom-0.5 mx-auto h-1 w-6 rounded-full bg-peach" aria-hidden />}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
