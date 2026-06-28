import { QRCodeSVG } from "qrcode.react";
import { useTranslation } from "react-i18next";
import { ROUTES } from "@/lib/routes";
import { BaseButton } from "@/components";

interface QrModalProps {
  show: boolean;
  groupId: string;
  onClose: () => void;
}

export function QrModal({ show, groupId, onClose }: QrModalProps) {
  const { t } = useTranslation();
  if (!show) return null;

  const url = window.location.origin + ROUTES.customerOrder(groupId);

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-sheet animate-[fadeIn_0.2s_ease_both]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl px-6 py-6 mx-4 flex flex-col items-center gap-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-sub font-medium text-ink">{t("qr.title")}</div>
        <QRCodeSVG value={url} size={200} />
        <div className="text-xs text-muted text-center">{t("qr.description")}</div>
        <BaseButton
          variant="secondary"
          className="w-full py-3 rounded-[10px] text-sm"
          onClick={onClose}
        >
          {t("qr.close")}
        </BaseButton>
      </div>
    </div>
  );
}
