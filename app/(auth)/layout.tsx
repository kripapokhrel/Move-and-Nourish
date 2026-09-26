import { Logo } from "@/components/layout/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto mt-16 max-w-md space-y-8 px-4 sm:mt-24">
      <Logo />
      <div className="rounded-[var(--radius-card)] border border-line bg-card p-6 shadow-[0_8px_24px_-12px_rgba(184,67,95,0.15)] sm:p-8">
        {children}
      </div>
    </main>
  );
}
