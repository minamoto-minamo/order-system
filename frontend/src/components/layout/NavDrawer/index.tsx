import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth";
import { useSessionActions } from "@/hooks/useSessionActions";
import { BottomSheetModal } from "@/components/modal/BottomSheetModal";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/routes";
import { EP } from "@/lib/endpoints";
import { isAdmin } from "@/lib/utils";
import homeIcon    from "@/assets/icons/home.png";
import hallIcon    from "@/assets/icons/hall.png";
import kitchenIcon from "@/assets/icons/kitchen.png";
import settingIcon from "@/assets/icons/setting.png";
import logoutIcon  from "@/assets/icons/logout.png";
import { NavItem } from "./NavItem";
import "./NavDrawer.scss";

interface NavDrawerProps {
  onClose: () => void;
  isOverTime?: boolean;
}

export function NavDrawer({ onClose, isOverTime }: NavDrawerProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, setUser } = useAuthStore();
  const {
    session,
    isOpen,
    showNewConfirm,
    setShowNewConfirm,
    showCloseConfirm,
    setShowCloseConfirm,
    showReopenConfirm,
    setShowReopenConfirm,
    closeError,
    closeSession,
    reopenSession,
    newSession,
    dismissCloseConfirm,
  } = useSessionActions({ onSuccess: onClose });

  const go = (path: string) => { navigate(path); onClose(); };

  const handleLogout = async () => {
    await api.post(EP.authLogout, {}).catch(() => {});
    setUser(null);
    navigate(ROUTES.login);
  };

  return (
    <div className="fixed inset-0 z-nav">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="nav-drawer absolute top-0 right-0 bottom-0 w-60 bg-white flex flex-col shadow-xl">

        <div className="px-5 py-3 flex items-center justify-between border-b border-divider shrink-0">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-label border ${isOpen ? 'bg-green-50 border-open-border text-green-600' : 'bg-surface border-line text-muted'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-open' : 'bg-faint'}`} />
            {isOpen ? t('session.open') : session ? t('session.closed') : t('session.noSession')}
          </div>
          <button className="text-dim text-xl bg-transparent border-none cursor-pointer leading-none px-1" onClick={onClose}>×</button>
        </div>

        <div className="flex-1 overflow-y-auto py-3">

          <div className="px-5 pt-2 pb-1 text-xs font-semibold text-muted tracking-[0.12em]">{t('nav.modeSwitch')}</div>
          <NavItem label={t('nav.home')}    icon={homeIcon}    onClick={() => go(ROUTES.root)} />
          <NavItem label={t('mode.hall')}    icon={hallIcon}    onClick={() => go(ROUTES.hall)}    disabled={!isOpen} />
          <NavItem label={t('mode.kitchen')} icon={kitchenIcon} onClick={() => go(ROUTES.kitchen)} disabled={!isOpen} />
          <NavItem label={t('mode.admin')} icon={settingIcon} onClick={() => go(ROUTES.admin)} disabled={!isAdmin(user)} />

          <div className="mx-5 my-2.5 border-t border-divider" />

          <div className="px-5 pt-0.5 pb-1 text-xs font-semibold text-muted tracking-[0.12em]">{t('nav.sessionManagement')}</div>
          {isOpen ? (
            <NavItem
              label={t('session.closeAction')}
              onClick={() => setShowCloseConfirm(true)}
              variant="danger"
              dot={isOverTime}
              sub={isOverTime ? t('nav.overtimeWarning') : undefined}
            />
          ) : (
            <>
              {session && (
                <NavItem label={t('session.reopenAction')} onClick={() => setShowReopenConfirm(true)} />
              )}
              <NavItem label={t('session.newSessionAction')} onClick={() => setShowNewConfirm(true)} />
            </>
          )}

          <div className="mx-5 my-2.5 border-t border-divider" />

          {user && (
            <div className="px-5 pb-1 text-xs font-semibold text-muted tracking-[0.04em]">{t('nav.loggedInAs', { username: user.username })}</div>
          )}
          <NavItem label={t('nav.logout')} icon={logoutIcon} onClick={handleLogout} />

        </div>
      </div>

      {/* z-nav stacking context 内に置くことでドロワーの上に正しく重なる */}
      <BottomSheetModal
        show={showNewConfirm}
        title={t('session.confirmNew')}
        description={t('session.confirmNewDesc')}
        onClose={() => setShowNewConfirm(false)}
        secondaryAction={{ label: t('common.cancel'), onClick: () => setShowNewConfirm(false) }}
        primaryAction={{ label: t('session.newSessionAction'), onClick: () => { newSession(); setShowNewConfirm(false); } }}
      />
      <BottomSheetModal
        show={showCloseConfirm}
        title={t('session.confirmClose')}
        description={t('session.confirmCloseDesc')}
        error={closeError}
        onClose={dismissCloseConfirm}
        secondaryAction={{ label: t('common.cancel'), onClick: dismissCloseConfirm }}
        primaryAction={{ label: t('session.close'), onClick: closeSession }}
      />
      <BottomSheetModal
        show={showReopenConfirm}
        title={t('session.confirmReopen')}
        description={t('session.confirmReopenDesc')}
        onClose={() => setShowReopenConfirm(false)}
        secondaryAction={{ label: t('common.cancel'), onClick: () => setShowReopenConfirm(false) }}
        primaryAction={{ label: t('session.reopen'), onClick: reopenSession }}
      />
    </div>
  );
}
