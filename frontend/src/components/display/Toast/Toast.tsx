import type { ReactNode } from "react";

export type ToastVariant = 'default' | 'danger';

export const VARIANT_CLASSES: Record<ToastVariant, string> = {
  default: "border-amber-border bg-amber-bg text-amber-fg",
  danger: "border-danger-border bg-danger-bg text-danger",
};

export function Toast({ message, variant = 'default' }: { message: ReactNode | null; variant?: ToastVariant }) {
  if (!message) return null;
  return (
    <div
      className={`fixed bottom-6 left-1/2 z-toast max-w-[calc(100vw-2rem)] -translate-x-1/2 animate-[slideUp_0.2s_ease_both] rounded-full border px-5 py-2.25 text-center text-xs shadow-sm ${VARIANT_CLASSES[variant]}`}
      onClick={e => e.stopPropagation()}
    >
      {message}
    </div>
  );
}
