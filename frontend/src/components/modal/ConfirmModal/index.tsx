/**
 * 確認用モーダル。title + description + 2ボタンの定型パターンを BottomSheetModal でラップする。
 * children を渡すと title/description の代わりにカスタムコンテンツを表示できる。
 */

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { BottomSheetModal } from "@/components/modal/BottomSheetModal";

interface ConfirmModalProps {
  show: boolean;
  title?: string;
  description?: string;
  confirmLabel: string;
  /** 省略時は common.cancel */
  cancelLabel?: string;
  variant?: "default" | "danger";
  onConfirm: () => void;
  onClose: () => void;
  /** 指定すると title/description の代わりに描画 */
  children?: ReactNode;
}

export function ConfirmModal({
  show,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = "default",
  onConfirm,
  onClose,
  children,
}: ConfirmModalProps) {
  const { t } = useTranslation();
  return (
    <BottomSheetModal
      show={show}
      title={title}
      description={description}
      onClose={onClose}
      secondaryAction={{ label: cancelLabel ?? t("common.cancel"), onClick: onClose }}
      primaryAction={{ label: confirmLabel, onClick: onConfirm, variant }}
    >
      {children}
    </BottomSheetModal>
  );
}
