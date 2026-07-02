import { BaseButton, BottomSheetModal, SubHeader, Toast } from "@/components";
import { useForm } from "@/hooks/useForm";
import { useToast } from "@/hooks/useToast";
import { api } from "@/lib/api";
import { EP } from "@/lib/endpoints";
import { usePlatformAuthStore } from "@/stores/platformAuth";
import type { Store } from "@order-system/shared";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StoreFormModal } from "./components/StoreFormModal";

type ModalMode = "add" | "edit" | null;

type StoreForm = {
  subdomain: string;
  name: string;
  adminUsername: string;
  adminPassword: string;
};

const EMPTY_FORM: StoreForm = { subdomain: "", name: "", adminUsername: "", adminPassword: "" };

export default function StoreList() {
  const { t } = useTranslation();
  const { setAdmin } = usePlatformAuthStore();
  const [stores, setStores] = useState<Store[]>([]);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editTarget, setEditTarget] = useState<Store | null>(null);
  const [toggleTarget, setToggleTarget] = useState<Store | null>(null);
  const { values: form, setValue, reset, error: formError, setError: setFormError } = useForm<StoreForm>(EMPTY_FORM);
  const { toast, showToast } = useToast();

  useEffect(() => {
    api.get<Store[]>(EP.platformStores).then(setStores).catch(console.error);
  }, []);

  const openAdd = () => {
    reset(EMPTY_FORM);
    setEditTarget(null);
    setModalMode("add");
  };

  const openEdit = (s: Store) => {
    reset({ subdomain: s.subdomain, name: s.name, adminUsername: "", adminPassword: "" });
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
        const created = await api.post<Store>(EP.platformStores, {
          subdomain: form.subdomain,
          name: form.name,
          adminUsername: form.adminUsername,
          adminPassword: form.adminPassword,
        });
        setStores(prev => [...prev, created]);
      } else if (modalMode === "edit" && editTarget) {
        const updated = await api.put<Store>(EP.platformStore(editTarget.id), { name: form.name });
        setStores(prev => prev.map(s => s.id === updated.id ? updated : s));
      }
      closeModal();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("409")) {
        setFormError(t("platform.errorDuplicateSubdomain"));
      } else if (msg.includes("422")) {
        setFormError(t("platform.errorReservedSubdomain"));
      } else {
        setFormError(msg);
      }
    }
  };

  const handleToggleActive = async () => {
    if (!toggleTarget) return;
    try {
      const updated = await api.put<Store>(EP.platformStore(toggleTarget.id), { isActive: !toggleTarget.isActive });
      setStores(prev => prev.map(s => s.id === updated.id ? updated : s));
    } catch {
      showToast(t("common.saveFailed"));
    }
    setToggleTarget(null);
  };

  const handleLogout = async () => {
    await api.post(EP.platformAuthLogout, {}).catch(() => {});
    setAdmin(null);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  };

  const isSaveDisabled = modalMode === "add"
    ? !form.subdomain.trim() || !form.name.trim() || !form.adminUsername.trim() || !form.adminPassword
    : !form.name.trim();

  return (
    <div className="h-dvh bg-surface flex flex-col">
      <div className="bg-white border-b border-divider px-4 py-3 flex items-center justify-between shrink-0">
        <div className="text-sub font-medium text-ink">{t("platform.storesTitle")}</div>
        <BaseButton
          variant="secondary"
          className="rounded-md px-3 py-1 text-label"
          onClick={handleLogout}
        >
          {t("platform.logout")}
        </BaseButton>
      </div>
      <SubHeader
        right={
          <BaseButton
            className="border-none rounded-lg px-4 py-1.5 text-note font-medium bg-ink text-white"
            onClick={openAdd}
          >
            {t("platform.addStore")}
          </BaseButton>
        }
      />

      <div className="flex-1 overflow-y-auto p-5 max-w-150 mx-auto w-full">
        {stores.length === 0 ? (
          <div className="py-12 text-center text-muted text-note">{t("platform.noStores")}</div>
        ) : (
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
                    onClick={() => openEdit(s)}
                  >
                    {t("common.edit")}
                  </BaseButton>
                  <BaseButton
                    variant="secondary"
                    className="rounded-md px-3 py-1 text-label"
                    onClick={() => setToggleTarget(s)}
                  >
                    {s.isActive ? t("platform.deactivate") : t("platform.activate")}
                  </BaseButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalMode && (
        <StoreFormModal
          modalMode={modalMode}
          form={form}
          formError={formError}
          isSaveDisabled={isSaveDisabled}
          onClose={closeModal}
          onSave={handleSave}
          setValue={setValue}
        />
      )}

      <BottomSheetModal
        show={!!toggleTarget}
        title={toggleTarget ? t(toggleTarget.isActive ? "platform.deactivateConfirm" : "platform.activateConfirm", { name: toggleTarget.name }) : ""}
        onClose={() => setToggleTarget(null)}
        secondaryAction={{ label: t("common.cancel"), onClick: () => setToggleTarget(null) }}
        primaryAction={{ label: toggleTarget?.isActive ? t("platform.deactivate") : t("platform.activate"), onClick: handleToggleActive }}
      />

      <Toast message={toast} />
    </div>
  );
}
