import type { ReactNode } from "react";

interface ActionBarProps {
  left?: ReactNode;
  right?: ReactNode;
}

export function ActionBar({ left, right }: ActionBarProps) {
  return (
    <div className="px-4 py-1.5 border-b border-divider bg-white flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2">{left}</div>
      <div className="flex items-center gap-2">{right}</div>
    </div>
  );
}
