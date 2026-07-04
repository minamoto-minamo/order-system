import type { ReactNode } from "react";

// 画面上部に固定表示する通知バナー。
// danger はエラー用で、フェードインとシャドウを持たない既存の見た目を維持する。
export function NoticeBanner({ variant = 'default', children }: { variant?: 'default' | 'danger'; children: ReactNode }) {
  return (
    <div className={variant === 'danger'
      ? "fixed top-4 left-4 right-4 bg-danger-bg border border-danger-border rounded-xl px-4 py-3 text-sm text-danger text-center z-sheet"
      : "fixed top-4 left-4 right-4 bg-white border border-line rounded-xl px-4 py-3 text-sm text-ink text-center shadow-sm z-sheet animate-[fadeIn_0.2s_ease_both]"
    }>
      {children}
    </div>
  );
}
