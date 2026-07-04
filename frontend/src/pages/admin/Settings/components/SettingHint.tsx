import type { ReactNode } from "react";

// セクション末尾の補足ヒント枠
export function SettingHint({ children }: { children: ReactNode }) {
  return (
    <div className="px-5 pt-2.5 pb-3.5">
      <div className="px-3.5 py-2.5 bg-surface border border-divider rounded-lg text-label text-muted leading-[1.7]">
        {children}
      </div>
    </div>
  );
}
