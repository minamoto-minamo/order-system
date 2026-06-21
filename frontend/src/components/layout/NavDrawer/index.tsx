import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSessionStore } from "@/stores/session";
import { useAuthStore } from "@/stores/auth";
import { BottomSheetModal } from "@/components/modal/BottomSheetModal";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/routes";
import { EP } from "@/lib/endpoints";
import type { Session } from "@order-system/shared";
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
  const { session, setSession } = useSessionStore();
  const { user, setUser } = useAuthStore();
  const [showCloseConfirm, setShowCloseConfirm]   = useState(false);
  const [showReopenConfirm, setShowReopenConfirm] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  const isOpen = session?.status === 'open';

  const go = (path: string) => { navigate(path); onClose(); };

  const handleCloseSession = async () => {
    if (!session) return;
    try {
      const updated = await api.put<Session>(EP.session(session.id), { status: 'closed' });
      setSession(updated);
      setShowCloseConfirm(false);
      setCloseError(null);
      onClose();
    } catch {
      setCloseError(t('session.activeGroupsExist'));
    }
  };

  const handleReopenSession = async () => {
    if (!session) return;
    const updated = await api.put<Session>(EP.session(session.id), { status: 'open' }).catch(() => null);
    if (updated) setSession(updated);
    setShowReopenConfirm(false);
  };

  const handleLogout = async () => {
    await api.post(EP.authLogout, {}).catch(() => {});
    setUser(null);
    navigate(ROUTES.login);
  };

  const handleNewSession = async () => {
    const created = await api.post<Session>(EP.sessions, {}).catch(() => null);
    if (created) { setSession(created); onClose(); }
  };

  return (
    <>
      <div className="fixed inset-0 z-400 flex">
        <div className="flex-1 bg-black/30" onClick={onClose} />
        <div className="nav-drawer w-60 bg-white h-full flex flex-col shadow-xl">

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
            <NavItem label={t('mode.admin')} icon={settingIcon} onClick={() => go(ROUTES.admin)} disabled={user?.role !== 'admin'} />

            <div className="mx-5 my-2.5 border-t border-divider" />

            <div className="px-5 pt-0.5 pb-1 text-xs font-semibold text-muted tracking-[0.12em]">{t('nav.sessionManagement')}</div>
            {isOpen ? (
              <NavItem
                label={t('session.closeAction')}
                onClick={() => setShowCloseConfirm(true)}
                variant="danger"
                dot={isOverTime}
                sub={isOverTime ? "営業終了予定時刻を過ぎています" : undefined}
              />
            ) : (
              <>
                {session && (
                  <NavItem label={t('session.reopenAction')} onClick={() => setShowReopenConfirm(true)} />
                )}
                <NavItem label={t('session.newSessionAction')} onClick={handleNewSession} />
              </>
            )}

            <div className="mx-5 my-2.5 border-t border-divider" />

            {user && (
              <div className="px-5 pb-1 text-xs font-semibold text-muted tracking-[0.04em]">ログイン中: {user.username}</div>
            )}
            <NavItem label={t('nav.logout')} icon={logoutIcon} onClick={handleLogout} />

          </div>
        </div>
      </div>

      <BottomSheetModal
        show={showCloseConfirm}
        onClose={() => { setShowCloseConfirm(false); setCloseError(null); }}
        secondaryAction={{ label: t('common.cancel'), onClick: () => { setShowCloseConfirm(false); setCloseError(null); } }}
        primaryAction={{ label: t('session.close'), onClick: handleCloseSession }}
      >
        <div className="mb-5">
          <div className="text-sub font-medium text-ink mb-2">{t('session.confirmClose')}</div>
          {closeError
            ? <div className="text-xs text-danger">{closeError}</div>
            : <div className="text-xs text-muted">{t('session.confirmCloseDesc')}</div>
          }
        </div>
      </BottomSheetModal>
      <BottomSheetModal
        show={showReopenConfirm}
        title={t('session.confirmReopen')}
        description={t('session.confirmReopenDesc')}
        onClose={() => setShowReopenConfirm(false)}
        secondaryAction={{ label: t('common.cancel'), onClick: () => setShowReopenConfirm(false) }}
        primaryAction={{ label: t('session.reopen'), onClick: handleReopenSession }}
      />
    </>
  );
}
