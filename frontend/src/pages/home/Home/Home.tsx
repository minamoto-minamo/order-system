import hallIcon from "@/assets/icons/hall.png";
import kitchenIcon from "@/assets/icons/kitchen.png";
import settingIcon from "@/assets/icons/setting.png";
import { AppHeader, BottomSheetModal, Button } from "@/components";
import { api } from "@/lib/api";
import { EP } from "@/lib/endpoints";
import { SOCKET_EVENTS as SE } from "@/lib/events";
import { ROUTES } from "@/lib/routes";
import { socket } from "@/lib/socket";
import { useAuthStore } from "@/stores/auth";
import { useSessionStore } from "@/stores/session";
import type { Session, Setting } from "@order-system/shared";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import "./Home.scss";

export default function Home() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { session, setSession } = useSessionStore();
  const { user } = useAuthStore();
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showReopenConfirm, setShowReopenConfirm] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("");

  useEffect(() => {
    api.get<{ storeName: string }>(EP.settings)
      .then(s => setStoreName(s.storeName))
      .catch(() => { })

    const onSettingsUpdated = (s: Setting) => setStoreName(s.storeName)
    socket.on(SE.settingsUpdated, onSettingsUpdated)
    return () => { socket.off(SE.settingsUpdated, onSettingsUpdated) }
  }, []);

  const isOpen = session?.status === 'open';

  const modes = [
    { path: ROUTES.hall, label: t('mode.hall'), sub: "注文受付・席管理", gated: true, roleGated: false, icon: hallIcon },
    { path: ROUTES.kitchen, label: t('mode.kitchen'), sub: "オーダー確認・調理管理", gated: true, roleGated: false, icon: kitchenIcon },
    { path: ROUTES.admin, label: t('nav.adminMode'), sub: "商品・席・レポート・設定", gated: false, roleGated: true, icon: settingIcon },
  ];

  const sessionStart = session?.openedAt
    ? new Date(session.openedAt).toLocaleString('ja-JP', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
    : '';

  const handleCloseConfirm = async () => {
    if (!session) return;
    try {
      const updated = await api.put<Session>(EP.session(session.id), { status: 'closed' });
      setSession(updated);
      setShowCloseConfirm(false);
    } catch {
      setCloseError(t('session.activeGroupsExist'));
    }
  };

  const handleReopenConfirm = async () => {
    if (!session) return;
    const updated = await api.put<Session>(EP.session(session.id), { status: 'open' }).catch(() => null);
    if (updated) setSession(updated);
    setShowReopenConfirm(false);
  };

  const handleNewSession = async () => {
    const created = await api.post<Session>(EP.sessions, {}).catch(() => null);
    if (created) setSession(created);
  };

  return (
    <>
      <div className="h-dvh flex flex-col">
        <AppHeader title={t('nav.home')} />

        <div className="flex-1 flex flex-col items-center justify-center px-8">

          {/* 営業状態バッジ＋営業日時 */}
          <div className="mb-5 animate-[fadeIn_0.4s_ease_0.05s_both] flex flex-col items-center gap-2">
            {storeName && (
              <div className="text-sub font-medium text-ink">{storeName}</div>
            )}
            <div className={`inline-flex items-center gap-1.5 px-3.5 py-1.25 rounded-full border text-xs font-medium ${isOpen ? 'bg-green-50 border-open-border text-green-600' : 'bg-surface border-line text-muted'}`}>
              <span className={`w-1.75 h-1.75 rounded-full inline-block ${isOpen ? 'bg-open' : 'bg-faint'}`} />
              {isOpen ? t('session.open') : session ? t('session.closed') : t('session.noSession')}
            </div>
            <div className="text-label text-muted tracking-[0.04em]">
              {isOpen && session ? `営業開始：${sessionStart}` : "本日の営業は締まっています"}
            </div>
          </div>

          {/* モードボタン（締め済み時はグレーアウト・タップ不可） */}
          <div className="w-full max-w-80 flex flex-col gap-2.5">
            {modes.map((m, i) => {
              const disabled = (m.gated && !isOpen) || (m.roleGated && user?.role !== 'admin');
              const subText = m.roleGated && user?.role !== 'admin'
                ? "管理者のみアクセスできます"
                : m.gated && !isOpen
                  ? "営業を開始してください"
                  : m.sub;
              return (
                <button
                  key={m.path}
                  className={`tappable rounded-[10px] px-5.5 py-5 text-left w-full border flex items-center gap-4 ${disabled ? 'bg-surface-deep border-line' : 'bg-white border-divider'}`}
                  onClick={() => navigate(m.path)}
                  disabled={disabled}
                  style={{ animation: `fadeIn 0.4s ease ${0.1 + i * 0.08}s both` }}
                >
                  <img src={m.icon} alt="" className="h-8 w-8 object-contain shrink-0" />
                  <div>
                    <div className="text-sub font-medium text-ink mb-0.75">
                      {m.label}
                    </div>
                    <div className="text-xs text-muted font-light">
                      {subText}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 営業操作ボタン */}
          <div className="mt-7 w-full max-w-80 animate-[fadeIn_0.4s_ease_0.28s_both]">
            {isOpen
              ? (
                <Button
                  variant="secondary"
                  className="w-full rounded-[10px] py-3 text-note"
                  onClick={() => setShowCloseConfirm(true)}
                >
                  {t('session.closeAction')}
                </Button>
              )
              : (
                <div className="flex flex-col gap-2">
                  {session && (
                    <Button
                      variant="secondary"
                      className="w-full rounded-[10px] py-3 text-note"
                      onClick={() => setShowReopenConfirm(true)}
                    >
                      {t('session.reopenAction')}
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    className="w-full rounded-[10px] py-3 text-note font-medium"
                    onClick={handleNewSession}
                  >
                    {t('session.newSessionAction')}
                  </Button>
                </div>
              )}
          </div>


          {/* 締め確認モーダル */}
          <BottomSheetModal
            show={showCloseConfirm}
            onClose={() => { setShowCloseConfirm(false); setCloseError(null); }}
            secondaryAction={{ label: t('common.cancel'), onClick: () => { setShowCloseConfirm(false); setCloseError(null); } }}
            primaryAction={{ label: t('session.close'), onClick: handleCloseConfirm }}
          >
            <div className="mb-5">
              <div className="text-sub font-medium text-ink mb-2">{t('session.confirmClose')}</div>
              {closeError
                ? <div className="text-xs text-danger">{closeError}</div>
                : <div className="text-xs text-muted">{t('session.confirmCloseDesc')}</div>
              }
            </div>
          </BottomSheetModal>

          {/* 再開確認モーダル */}
          <BottomSheetModal
            show={showReopenConfirm}
            title={t('session.confirmReopen')}
            description={t('session.confirmReopenDesc')}
            onClose={() => setShowReopenConfirm(false)}
            secondaryAction={{ label: t('common.cancel'), onClick: () => setShowReopenConfirm(false) }}
            primaryAction={{ label: t('session.reopen'), onClick: handleReopenConfirm }}
          />

        </div>
      </div>
    </>
  );
}
