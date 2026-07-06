import type { ReactNode } from "react";

export function Toast({ message }: { message: ReactNode | null }) {
  if (!message) return null;
  return (
    <div
      className="fixed bottom-6 left-1/2 z-toast max-w-[calc(100vw-2rem)] -translate-x-1/2 animate-[slideUp_0.2s_ease_both] rounded-full border border-amber-border bg-amber-bg px-5 py-2.25 text-center text-xs text-amber-fg shadow-sm"
      onClick={e => e.stopPropagation()}
    >
      {message}
    </div>
  );
}
