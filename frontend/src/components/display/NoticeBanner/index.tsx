import type { ReactNode } from "react";
import { Toast } from "../Toast/Toast";

// 画面上部に固定表示する通知バナー。
// danger はエラー通知としてトーストに統一する。
export function NoticeBanner({ variant = 'default', children }: { variant?: 'default' | 'danger'; children: ReactNode }) {
  return (
    variant === 'danger' ? (
      <Toast message={children} variant="danger" />
    ) : (
      <div className="fixed top-4 left-4 right-4 bg-white border border-line rounded-xl px-4 py-3 text-sm text-ink text-center shadow-sm z-sheet animate-[fadeIn_0.2s_ease_both]">
        {children}
      </div>
    )
  );
}
