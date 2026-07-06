import { BaseButton, BottomSheetModal, LoadError, SubHeader, Toast } from "@/components";
import { apiErrorMessage } from "@/lib/apiError";
import { useForm } from "@/hooks/useForm";
import { useToast } from "@/hooks/useToast";
import { api } from "@/lib/api";
import { EP } from "@/lib/endpoints";
import { usePlatformAuthStore } from "@/stores/platformAuth";
import type { Store } from "@order-system/shared";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StoreFormModal } from "./components/StoreFormModal";
import { StoreRows } from "./components/StoreRows";

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
	  const [loadError, setLoadError] = useState(false);
  const { values: form, setValue, reset, error: formError, setError: setFormError } = useForm<StoreForm>(EMPTY_FORM);
  const { toast, showToast } = useToast();

	  useEffect(() => {
	    api.get<Store[]>(EP.platformStores).then(list => {
	      setLoadError(false);
	      setStores(list);
	    }).catch(() => setLoadError(true));
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
      setFormError(apiErrorMessage(e, t("common.saveFailed")));
    }
  };

  const handleToggleActive = async () => {
    if (!toggleTarget) return;
    try {
      const updated = await api.put<Store>(EP.platformStore(toggleTarget.id), { isActive: !toggleTarget.isActive });
      setStores(prev => prev.map(s => s.id === updated.id ? updated : s));
    } catch (e) {
      showToast(apiErrorMessage(e, t("common.saveFailed")));
    }
    setToggleTarget(null);
  };

	  const handleLogout = async () => {
	    // サーバー側ログアウトに失敗しても管理画面の操作継続を防ぐためローカルログアウトは続行する
	    await api.post(EP.platformAuthLogout, {}).catch(() => {});
    setAdmin(null);
  };

  const isSaveDisabled = modalMode === "add"
    ? !form.subdomain.trim() || !form.name.trim() || !form.adminUsername.trim() || !form.adminPassword
    : !form.name.trim();

	  if (loadError) return <LoadError />;

	  return (
    <div className="app-shell h-dvh bg-white flex flex-col overflow-hidden">
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
            className="border-none rounded-lg px-4 py-1.5 text-note font-medium bg-brand text-white"
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
          <StoreRows stores={stores} onEdit={openEdit} onToggle={setToggleTarget} />
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
