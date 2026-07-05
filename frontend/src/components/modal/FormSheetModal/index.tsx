import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { BaseButton } from "@/components/controls/button";

// フォーム入力用のボトムシートモーダル。フィールド部分は children で差し込む。
// 初期フォーカスはフィールドの ref を持つ呼び出し側で行う。
export function FormSheetModal({ title, error, saveDisabled, onClose, onSave, children }: {
  title: string;
  error: string | null;
  saveDisabled: boolean;
  onClose: () => void;
  onSave: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-modal flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl w-full max-w-120 px-6 pt-6 pb-10 animate-[slideUp_0.2s_ease_both]"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-base font-medium text-ink mb-5">{title}</div>

        <div className="flex flex-col gap-4">
          {children}

          {error && (
            <div className="text-label text-danger bg-danger-bg border border-danger-border rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-6">
          <BaseButton
            variant="secondary"
            className="flex-1 rounded-lg py-2.5 text-sm"
            onClick={onClose}
          >
            {t("common.cancel")}
          </BaseButton>
          <BaseButton
            className="flex-1 border-none rounded-lg py-2.5 text-sm font-medium bg-brand text-white disabled:opacity-40"
            onClick={onSave}
            disabled={saveDisabled}
          >
            {t("common.save")}
          </BaseButton>
        </div>
      </div>
    </div>
  );
}
