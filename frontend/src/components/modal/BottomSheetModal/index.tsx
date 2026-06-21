/**
 * 画面下部から出現するモーダル。
 * children を渡すと title/description の代わりにカスタムコンテンツを表示できる。
 */

import type { ReactNode } from "react";
import { Button } from "@/components/controls/button";

interface BottomSheetModalProps {
  show: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  primaryAction: {
    label: string;
    onClick: () => void;
    /** "danger" で赤ボタン、省略で黒ボタン */
    variant?: "default" | "danger";
  };
  secondaryAction?: { label: string; onClick: () => void };
  /** 指定すると title/description の代わりに描画 */
  children?: ReactNode;
}

export function BottomSheetModal({
  show,
  title,
  description,
  onClose,
  primaryAction,
  secondaryAction,
  children,
}: BottomSheetModalProps) {
  if (!show) return null;
  const variant = primaryAction.variant ?? "default";
  return (
    // オーバーレイ（背景タップで閉じる）
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/30 flex items-end z-500 animate-[fadeIn_0.2s_ease_both]"
    >
      {/* シート本体（タップが背面に抜けないよう伝播を止める） */}
      <div
        onClick={e => e.stopPropagation()}
        className="w-full bg-white rounded-t-2xl px-6 pt-6 pb-10 animate-[slideUp_0.22s_ease_both]"
      >
        {children ?? (
          <>
            <div className="text-sub font-medium text-ink mb-1.5">{title}</div>
            {description && <div className="text-xs text-muted mb-5">{description}</div>}
          </>
        )}
        <div className="flex gap-2.5">
          {secondaryAction && (
            <Button
              variant="secondary"
              className="flex-1 py-3.25 rounded-[10px] text-sm"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            className="flex-1 py-3.25 rounded-[10px] text-sm font-medium"
            onClick={primaryAction.onClick}
          >
            {primaryAction.label}
          </Button>
        </div>
      </div>
    </div>
  );
}
