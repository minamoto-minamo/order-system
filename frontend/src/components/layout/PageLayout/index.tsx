import type { ReactNode } from "react";

export function PageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-dvh bg-surface flex flex-col">
      {children}
    </div>
  );
}
