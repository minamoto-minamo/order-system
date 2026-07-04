import { FormSheetModal } from "@/components";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

type ModalMode = "add" | "edit";

type StaffForm = {
  username: string;
  password: string;
  role: "admin" | "staff";
};

export function StaffFormModal({ modalMode, form, formError, isSaveDisabled, onClose, onSave, setValue }: {
  modalMode: ModalMode;
  form: StaffForm;
  formError: string | null;
  isSaveDisabled: boolean;
  onClose: () => void;
  onSave: () => void;
  setValue: (key: keyof StaffForm, value: string) => void;
}) {
  const { t } = useTranslation();
  const usernameRef = useRef<HTMLInputElement>(null);

  // アニメーション（slideUp 0.2s）開始直後はDOMが未レンダリングのため50ms遅延してフォーカス
  useEffect(() => {
    setTimeout(() => usernameRef.current?.focus(), 50);
  }, []);

  return (
    <FormSheetModal
      title={modalMode === "add" ? t("staff.addTitle") : t("staff.editTitle")}
      error={formError}
      saveDisabled={isSaveDisabled}
      onClose={onClose}
      onSave={onSave}
    >
      <div>
        <label className="text-label text-muted block mb-1.5">{t("staff.username")}</label>
        <input
          ref={usernameRef}
          className="input-field border border-line rounded-lg px-3 py-2.5 text-sm text-ink w-full"
          value={form.username}
          onChange={e => setValue("username", e.target.value)}
        />
      </div>
      <div>
        <label className="text-label text-muted block mb-1.5">
          {t("staff.password")}
          {modalMode === "edit" && (
            <span className="text-muted ml-1.5">— {t("staff.passwordHint")}</span>
          )}
        </label>
        <input
          type="password"
          className="input-field border border-line rounded-lg px-3 py-2.5 text-sm text-ink w-full"
          value={form.password}
          onChange={e => setValue("password", e.target.value)}
          placeholder={modalMode === "edit" ? t("staff.passwordHint") : ""}
        />
      </div>
      <div>
        <label className="text-label text-muted block mb-1.5">{t("staff.role")}</label>
        <select
          className="input-field border border-line rounded-lg px-3 py-2.5 text-sm text-ink w-full bg-white appearance-none"
          value={form.role}
          onChange={e => setValue("role", e.target.value as "admin" | "staff")}
        >
          <option value="staff">{t("staff.roleStaff")}</option>
          <option value="admin">{t("staff.roleAdmin")}</option>
        </select>
      </div>
    </FormSheetModal>
  );
}
