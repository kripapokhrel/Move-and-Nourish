import type { ReactNode } from "react";

/** Big serif page title with an eyebrow and an optional line under it. */
export function PageHeader({ eyebrow, title, children, action }: {
  eyebrow: string; title: ReactNode; children?: ReactNode; action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-2">
      <div className="space-y-2">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
        {children && <p className="text-muted">{children}</p>}
      </div>
      {action}
    </div>
  );
}
