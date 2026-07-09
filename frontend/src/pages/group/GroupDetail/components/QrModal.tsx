import { QRCodeSVG } from "qrcode.react";
import { useTranslation } from "react-i18next";
import { ROUTES } from "@/lib/routes";
import { BottomSheetModal } from "@/components";

interface QrModalProps {
  show: boolean;
  groupId: string;
  onClose: () => void;
}

export function QrModal({ show, groupId, onClose }: QrModalProps) {
  const { t } = useTranslation();
  const url = window.location.origin + ROUTES.customerOrder(groupId);

  return (
    <BottomSheetModal
      show={show}
      onClose={onClose}
      primaryAction={{ label: t("qr.close"), onClick: onClose }}
    >
      <div className="flex flex-col items-center gap-4 mb-5">
        <div className="text-sub font-medium text-ink">{t("qr.title")}</div>
        <QRCodeSVG value={url} size={200} />
        <div className="text-xs text-muted text-center">{t("qr.description")}</div>
      </div>
    </BottomSheetModal>
  );
}
