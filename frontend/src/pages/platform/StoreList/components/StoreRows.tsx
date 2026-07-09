import { BaseButton } from "@/components/primitives";
import { formatDate } from "@/lib/utils";
import type { Store } from "@order-system/shared";
import { useTranslation } from "react-i18next";

// 店舗行リスト（店名・稼働バッジ・サブドメイン・作成日と操作ボタン群）
export function StoreRows({ stores, onEdit, onToggle }: {
  stores: Store[];
  onEdit: (s: Store) => void;
  onToggle: (s: Store) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="bg-white border border-divider rounded-xl overflow-hidden animate-[fadeIn_0.3s_ease_both]">
      {stores.map((s, i) => (
        <div
          key={s.id}
          className={`flex items-center gap-3 px-5 py-3.5 ${i < stores.length - 1 ? "border-b border-surface" : ""}`}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-medium text-ink truncate">{s.name}</span>
              <span className={`text-caption px-1.5 py-px rounded-full border ${s.isActive ? "text-open-fg border-open-border" : "text-muted border-line"}`}>
                {s.isActive ? t("platform.active") : t("platform.inactive")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-label text-muted">{s.subdomain}</span>
              <span className="text-label text-muted">{formatDate(s.createdAt)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <BaseButton
              variant="secondary"
              className="rounded-md px-3 py-1 text-label"
              onClick={() => onEdit(s)}
            >
              {t("common.edit")}
            </BaseButton>
            <BaseButton
              variant="secondary"
              className="rounded-md px-3 py-1 text-label"
              onClick={() => onToggle(s)}
            >
              {s.isActive ? t("platform.deactivate") : t("platform.activate")}
            </BaseButton>
          </div>
        </div>
      ))}
    </div>
  );
}
