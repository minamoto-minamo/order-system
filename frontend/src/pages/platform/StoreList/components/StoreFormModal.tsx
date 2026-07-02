import { BaseButton } from "@/components";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

type ModalMode = "add" | "edit";

type StoreForm = {
  subdomain: string;
  name: string;
  adminUsername: string;
  adminPassword: string;
};

export function StoreFormModal({ modalMode, form, formError, isSaveDisabled, onClose, onSave, setValue }: {
  modalMode: ModalMode;
  form: StoreForm;
  formError: string | null;
  isSaveDisabled: boolean;
  onClose: () => void;
  onSave: () => void;
  setValue: (key: keyof StoreForm, value: string) => void;
}) {
  const { t } = useTranslation();
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // アニメーション（slideUp 0.2s）開始直後はDOMが未レンダリングのため50ms遅延してフォーカス
  useEffect(() => {
    setTimeout(() => firstFieldRef.current?.focus(), 50);
  }, []);

  return (
    <div className="fixed inset-0 z-modal flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl w-full max-w-120 px-6 pt-6 pb-10 animate-[slideUp_0.2s_ease_both]"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-base font-medium text-ink mb-5">
          {modalMode === "add" ? t("platform.addTitle") : t("platform.editTitle")}
        </div>

        <div className="flex flex-col gap-4">
          {modalMode === "add" ? (
            <div>
              <label className="text-label text-muted block mb-1.5">{t("platform.subdomain")}</label>
              <input
                ref={firstFieldRef}
                className="input-field border border-line rounded-lg px-3 py-2.5 text-sm text-ink w-full"
                value={form.subdomain}
                onChange={e => setValue("subdomain", e.target.value)}
                placeholder={t("platform.subdomainHint")}
              />
            </div>
          ) : (
            <div>
              <label className="text-label text-muted block mb-1.5">{t("platform.subdomain")}</label>
              <div className="text-sm text-muted px-3 py-2.5">{form.subdomain}</div>
            </div>
          )}
          <div>
            <label className="text-label text-muted block mb-1.5">{t("platform.name")}</label>
            <input
              ref={modalMode === "edit" ? firstFieldRef : undefined}
              className="input-field border border-line rounded-lg px-3 py-2.5 text-sm text-ink w-full"
              value={form.name}
              onChange={e => setValue("name", e.target.value)}
            />
          </div>
          {modalMode === "add" && (
            <>
              <div>
                <label className="text-label text-muted block mb-1.5">{t("platform.adminUsername")}</label>
                <input
                  className="input-field border border-line rounded-lg px-3 py-2.5 text-sm text-ink w-full"
                  value={form.adminUsername}
                  onChange={e => setValue("adminUsername", e.target.value)}
                />
              </div>
              <div>
                <label className="text-label text-muted block mb-1.5">{t("platform.adminPassword")}</label>
                <input
                  type="password"
                  className="input-field border border-line rounded-lg px-3 py-2.5 text-sm text-ink w-full"
                  value={form.adminPassword}
                  onChange={e => setValue("adminPassword", e.target.value)}
                />
              </div>
            </>
          )}

          {formError && (
            <div className="text-label text-danger bg-danger-bg border border-danger-border rounded-lg px-3 py-2">
              {formError}
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
            className="flex-1 border-none rounded-lg py-2.5 text-sm font-medium bg-ink text-white disabled:opacity-40"
            onClick={onSave}
            disabled={isSaveDisabled}
          >
            {t("common.save")}
          </BaseButton>
        </div>
      </div>
    </div>
  );
}
