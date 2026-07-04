import type { ReactNode } from "react";

export function OrderSection({ title, children }: { title?: string; children: ReactNode }) {
  if (title === undefined) return <>{children}</>;
  return (
    <div className="mt-1">
      <div className="px-5 pt-2.5 pb-1.5 text-label text-muted tracking-[0.08em]">{title}</div>
      {children}
    </div>
  );
}
