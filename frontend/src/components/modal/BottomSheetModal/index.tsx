import type { ReactNode } from "react";
import { BaseButton } from "@/components/controls/button";
import { BottomSheet } from "../BottomSheet";

interface BottomSheetModalProps {
  show: boolean;
  title?: string;
  description?: string;
  error?: string | null;
  onClose: () => void;
  primaryAction: {
    label: string;
    onClick: () => void;
    variant?: "default" | "danger";
  };
  secondaryAction?: { label: string; onClick: () => void };
  children?: ReactNode;
}

export function BottomSheetModal({
  show,
  title,
  description,
  error,
  onClose,
  primaryAction,
  secondaryAction,
  children,
}: BottomSheetModalProps) {
  if (!show) return null;
  const variant = primaryAction.variant ?? "default";
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/30 flex items-end z-sheet animate-[fadeIn_0.2s_ease_both]"
    >
      <BottomSheet className="px-6 pt-6 pb-10" onClick={e => e.stopPropagation()}>
        {children ?? (
          <>
            <div className="text-sub font-medium text-ink mb-1.5">{title}</div>
            {error
              ? <div className="text-xs text-danger mb-5">{error}</div>
              : description && <div className="text-xs text-muted mb-5">{description}</div>
            }
          </>
        )}
        <div className="flex gap-2.5">
          {secondaryAction && (
            <BaseButton
              variant="secondary"
              className="flex-1 py-3.25 rounded-[10px] text-sm"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </BaseButton>
          )}
          <BaseButton
            variant={variant === "danger" ? "danger" : "primary"}
            className="flex-1 py-3.25 rounded-[10px] text-sm font-medium"
            onClick={primaryAction.onClick}
          >
            {primaryAction.label}
          </BaseButton>
        </div>
      </BottomSheet>
    </div>
  );
}
