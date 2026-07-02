import { BaseButton } from "@/components";
import type { StaffMember, StaffSession } from "@order-system/shared";
import { useTranslation } from "react-i18next";

export function StaffSessionsModal({ target, sessions, loading, onClose, onRevoke }: {
  target: StaffMember;
  sessions: StaffSession[];
  loading: boolean;
  onClose: () => void;
  onRevoke: (session: StaffSession) => void;
}) {
  const { t } = useTranslation();

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-modal flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl w-full max-w-120 px-6 pt-6 pb-10 max-h-[80vh] overflow-y-auto animate-[slideUp_0.2s_ease_both]"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-base font-medium text-ink mb-5">
          {t("staff.devices.title", { name: target.username })}
        </div>

        {loading ? null : sessions.length === 0 ? (
          <div className="py-8 text-center text-muted text-note">{t("staff.devices.empty")}</div>
        ) : (
          <div className="flex flex-col gap-3">
            {sessions.map(s => (
              <div key={s.id} className="border border-line rounded-lg px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-label text-muted">{t("staff.devices.issuedAt")}</div>
                    <div className="text-sm text-ink">{formatDateTime(s.issuedAt)}</div>
                  </div>
                  <BaseButton
                    variant="secondary"
                    className="rounded-md px-3 py-1 text-label text-danger border-danger-border shrink-0"
                    onClick={() => onRevoke(s)}
                  >
                    {t("staff.devices.revoke")}
                  </BaseButton>
                </div>
                <div className="mt-2 text-label text-muted">
                  {t("staff.devices.expiresAt")}: {formatDateTime(s.expiresAt)}
                </div>
                {s.userAgent && (
                  <div className="mt-1 text-label text-muted truncate">{s.userAgent}</div>
                )}
                {s.ipAddress && (
                  <div className="mt-0.5 text-label text-muted">{s.ipAddress}</div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 mt-6">
          <BaseButton
            variant="secondary"
            className="flex-1 rounded-lg py-2.5 text-sm"
            onClick={onClose}
          >
            {t("common.close")}
          </BaseButton>
        </div>
      </div>
    </div>
  );
}
