import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { BottomSheetModal } from "@/components";

interface ConfirmModalProps {
  show: boolean;
  title?: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  disabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}

export function ConfirmModal({
  show,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = "default",
  disabled,
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
      primaryAction={{ label: confirmLabel, onClick: onConfirm, variant, disabled }}
    >
      {children}
    </BottomSheetModal>
  );
}
