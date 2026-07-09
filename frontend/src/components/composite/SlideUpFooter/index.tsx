import type { ReactNode } from "react";

// 画面下部にスライドインで固定表示するフッター。
// padding は既定で px-5 pt-3 pb-6。異なる画面は className で上書きする。
export function SlideUpFooter({ className = "px-5 pt-3 pb-6", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`fixed bottom-0 left-0 right-0 z-modal bg-white border-t border-divider animate-[slideUp_0.2s_ease_both] ${className}`}>
      {children}
    </div>
  );
}
