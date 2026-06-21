import type { ReactNode } from "react";

interface SubHeaderProps {
  left?: ReactNode;
  right?: ReactNode;
}

export function SubHeader({ left, right }: SubHeaderProps) {
  return (
    <div className="px-4 py-1.5 border-b border-divider bg-white flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2">{left}</div>
      <div className="flex items-center gap-2">{right}</div>
    </div>
  );
}
