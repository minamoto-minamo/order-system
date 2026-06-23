import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AppHeader, SubHeader, Button, BottomSheetModal } from "@/components";
import { api } from "@/lib/api";
import { EP } from "@/lib/endpoints";
import { ROUTES } from "@/lib/routes";
import type { StaffMember } from "@order-system/shared";
import { useAuthStore } from "@/stores/auth";
import { useForm } from "@/hooks/useForm";
import { RoleBadge } from "./RoleBadge";

type ModalMode = "add" | "edit" | null;

type StaffForm = {
  username: string;
  password: string;
  role: "admin" | "staff";
};

const EMPTY_FORM: StaffForm = { username: "", password: "", role: "staff" };

export default function Staff() {
  const { t } = useTranslation();
  const { user: me } = useAuthStore();
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);
  const { values: form, setValue, reset, error: formError, setError: setFormError } = useForm<StaffForm>(EMPTY_FORM);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<StaffMember[]>(EP.staff).then(setStaffList).catch(console.error);
  }, []);

  useEffect(() => {
    if (modalMode) setTimeout(() => usernameRef.current?.focus(), 50);
  }, [modalMode]);

  const openAdd = () => {
    reset(EMPTY_FORM);
    setEditTarget(null);
    setModalMode("add");
  };

  const openEdit = (s: StaffMember) => {
    reset({ username: s.username, password: "", role: s.role as "admin" | "staff" });
    setEditTarget(s);
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode(null);
    setEditTarget(null);
    setFormError(null);
  };

  const handleSave = async () => {
    setFormError(null);
    try {
      if (modalMode === "add") {
        const created = await api.post<StaffMember>(EP.staff, {
          username: form.username,
          password: form.password,
          role: form.role,
        });
        setStaffList(prev => [...prev, created]);
      } else if (modalMode === "edit" && editTarget) {
        const body: Record<string, string> = { username: form.username, role: form.role };
        if (form.password) body.password = form.password;
        const updated = await api.put<StaffMember>(EP.staffMember(editTarget.id), body);
        setStaffList(prev => prev.map(s => s.id === updated.id ? updated : s));
      }
      closeModal();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("409")) {
        setFormError(t("staff.errorDuplicate"));
      } else {
        setFormError(msg);
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(EP.staffMember(deleteTarget.id));
      setStaffList(prev => prev.filter(s => s.id !== deleteTarget.id));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("422")) alert(t("staff.errorSelf"));
    }
    setDeleteTarget(null);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  };

  const isSaveDisabled =
    !form.username.trim() ||
    (modalMode === "add" && !form.password);

  return (
    <div className="min-h-dvh bg-surface flex flex-col">
      <AppHeader
        title={t("admin.staff")}
        breadcrumb={{ label: t("admin.menuTitle"), to: ROUTES.admin }}
      />
      <SubHeader
        right={
          <Button
            className="border-none rounded-lg px-4 py-1.5 text-note font-medium bg-ink text-white"
            onClick={openAdd}
          >
            {t("staff.addStaff")}
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-5 max-w-150 mx-auto w-full">
        {staffList.length === 0 ? (
          <div className="py-12 text-center text-muted text-note">{t("staff.noStaff")}</div>
        ) : (
          <div className="bg-white border border-divider rounded-xl overflow-hidden animate-[fadeIn_0.3s_ease_both]">
            {staffList.map((s, i) => (
              <div
                key={s.id}
                className={`flex items-center gap-3 px-5 py-3.5 ${i < staffList.length - 1 ? "border-b border-surface" : ""}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-ink truncate">{s.username}</span>
                    {s.id === me?.id && (
                      <span className="text-caption text-muted">{t("staff.selfLabel")}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <RoleBadge role={s.role} />
                    <span className="text-label text-muted">{formatDate(s.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="secondary"
                    className="rounded-md px-3 py-1 text-label"
                    onClick={() => openEdit(s)}
                  >
                    {t("common.edit")}
                  </Button>
                  <Button
                    variant="secondary"
                    className="rounded-md px-3 py-1 text-label text-danger border-danger-border"
                    onClick={() => setDeleteTarget(s)}
                    disabled={s.id === me?.id}
                  >
                    {t("common.delete")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 追加・編集モーダル */}
      {modalMode && (
        <div className="fixed inset-0 z-200 flex items-end justify-center bg-black/40" onClick={closeModal}>
          <div
            className="bg-white rounded-t-2xl w-full max-w-120 px-6 pt-6 pb-10 animate-[slideUp_0.2s_ease_both]"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-base font-medium text-ink mb-5">
              {modalMode === "add" ? t("staff.addTitle") : t("staff.editTitle")}
            </div>

            <div className="flex flex-col gap-4">
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

              {formError && (
                <div className="text-label text-danger bg-danger-bg border border-danger-border rounded-lg px-3 py-2">
                  {formError}
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <Button
                variant="secondary"
                className="flex-1 rounded-lg py-2.5 text-sm"
                onClick={closeModal}
              >
                {t("common.cancel")}
              </Button>
              <Button
                className="flex-1 border-none rounded-lg py-2.5 text-sm font-medium bg-ink text-white disabled:opacity-40"
                onClick={handleSave}
                disabled={isSaveDisabled}
              >
                {t("common.save")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認 */}
      <BottomSheetModal
        show={!!deleteTarget}
        title={deleteTarget ? t("staff.deleteConfirm", { name: deleteTarget.username }) : ""}
        onClose={() => setDeleteTarget(null)}
        secondaryAction={{ label: t("common.cancel"), onClick: () => setDeleteTarget(null) }}
        primaryAction={{ label: t("common.delete"), onClick: handleDelete }}
      />
    </div>
  );
}
