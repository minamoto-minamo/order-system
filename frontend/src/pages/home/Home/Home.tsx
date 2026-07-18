import type { PublicSetting } from '@order-system/shared'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { BottomSheetModal } from '@/components/composite'
import { BaseButton } from '@/components/primitives'
import { AppHeader, NavigationCard } from '@/features/navigation/components'
import { useSessionActions } from '@/hooks/useSessionActions'
import { api } from '@/lib/api'
import { apiErrorMessage } from '@/lib/apiError'
import { BRAND } from '@/lib/brand'
import { EP } from '@/lib/endpoints'
import { SOCKET_EVENTS as SE } from '@/lib/events'
import { NAV_ICONS } from '@/lib/icons'
import { ROUTES } from '@/lib/routes'
import { socket } from '@/lib/socket'
import { isAdmin } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
export default function Home() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const showToast = useToastStore((state) => state.showToast)
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
  } = useSessionActions({ onError: showToast })
  const { user } = useAuthStore()
  const [storeName, setStoreName] = useState('')

  useEffect(() => {
    api
      .get<{ storeName: string }>(EP.settings)
      .then((s) => setStoreName(s.storeName))
      .catch((e) => {
        showToast(apiErrorMessage(e, t('common.loadError')))
      })

    // 初期フェッチと同じ useEffect にまとめて cleanup を一箇所に集約するため手動登録
    const onSettingsUpdated = (s: PublicSetting) => setStoreName(s.storeName)
    socket.on(SE.settingsUpdated, onSettingsUpdated)
    return () => {
      socket.off(SE.settingsUpdated, onSettingsUpdated)
    }
  }, [showToast, t])

  // gated: 営業中でないとアクセス不可。roleGated: admin ロール必須
  const modes = [
    {
      path: ROUTES.hall,
      label: t('mode.hall'),
      sub: t('home.hallSub'),
      gated: true,
      roleGated: false,
      icon: NAV_ICONS.hall,
    },
    {
      path: ROUTES.kitchen,
      label: t('mode.kitchen'),
      sub: t('home.kitchenSub'),
      gated: true,
      roleGated: false,
      icon: NAV_ICONS.kitchen,
    },
    {
      path: ROUTES.admin,
      label: t('nav.adminMode'),
      sub: t('home.adminSub'),
      gated: false,
      roleGated: true,
      icon: NAV_ICONS.setting,
    },
  ]

  const sessionStart = session?.openedAt
    ? new Date(session.openedAt).toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

  return (
    <>
      <AppHeader title={t('nav.home')} />

      <div className="flex-1 overflow-y-auto px-8">
        <div
          className="min-h-full py-6 flex flex-col items-center"
          style={{ justifyContent: 'safe center' }}
        >
          <div className="mb-7 animate-[fadeIn_0.4s_ease_both] flex flex-col items-center text-center">
            <img src={BRAND.iconPath} alt="" className="w-14 h-14" />
          </div>

          {/* 営業状態バッジ＋営業日時 */}
          <div className="mb-5 animate-[fadeIn_0.4s_ease_0.05s_both] flex flex-col items-center gap-2">
            {storeName && <div className="text-sub font-medium text-ink">{storeName}</div>}
            <div
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.25 rounded-full border text-xs font-medium ${isOpen ? 'bg-green-50 border-open-border text-green-600' : 'bg-surface border-line text-muted'}`}
            >
              <span
                className={`w-1.75 h-1.75 rounded-full inline-block ${isOpen ? 'bg-open' : 'bg-faint'}`}
              />
              {isOpen ? t('session.open') : session ? t('session.closed') : t('session.noSession')}
            </div>
            <div className="text-label text-muted tracking-[0.04em]">
              {isOpen && session
                ? t('home.sessionStart', { time: sessionStart })
                : t('home.closedMessage')}
            </div>
          </div>

          {/* モードボタン（締め済み時はグレーアウト・タップ不可） */}
          <div className="w-full max-w-[41rem] flex flex-wrap gap-2.5">
            {modes.map((m, i) => {
              const disabled = (m.gated && !isOpen) || (m.roleGated && !isAdmin(user))
              const subText =
                m.roleGated && !isAdmin(user)
                  ? t('home.adminOnly')
                  : m.gated && !isOpen
                    ? t('home.openFirst')
                    : m.sub
              return (
                <NavigationCard
                  key={m.path}
                  label={m.label}
                  subtitle={subText}
                  icon={m.icon}
                  className={`min-[560px]:w-[calc(50%-0.3125rem)] ${modes.length % 2 === 1 && i === modes.length - 1 ? 'min-[560px]:mx-auto' : ''}`}
                  animationDelay={0.1 + i * 0.08}
                  onClick={() => navigate(m.path)}
                  disabled={disabled}
                />
              )
            })}
          </div>

          {/* 営業操作ボタン */}
          <div className="mt-7 w-full max-w-80 animate-[fadeIn_0.4s_ease_0.28s_both]">
            {isOpen ? (
              <BaseButton
                variant="secondary"
                className="w-full rounded-[10px] py-3 text-note"
                onClick={() => setShowCloseConfirm(true)}
              >
                {t('session.closeAction')}
              </BaseButton>
            ) : (
              <div className="flex flex-col gap-2">
                {session && (
                  <BaseButton
                    variant="secondary"
                    className="w-full rounded-[10px] py-3 text-note"
                    onClick={() => setShowReopenConfirm(true)}
                  >
                    {t('session.reopenAction')}
                  </BaseButton>
                )}
                <BaseButton
                  variant="primary"
                  className="w-full rounded-[10px] py-3 text-note font-medium"
                  onClick={() => setShowNewConfirm(true)}
                >
                  {t('session.newSessionAction')}
                </BaseButton>
              </div>
            )}
          </div>
        </div>

        {/* 営業開始確認モーダル */}
        <BottomSheetModal
          show={showNewConfirm}
          title={t('session.confirmNew')}
          description={t('session.confirmNewDesc')}
          onClose={() => setShowNewConfirm(false)}
          secondaryAction={{ label: t('common.cancel'), onClick: () => setShowNewConfirm(false) }}
          primaryAction={{ label: t('session.newSessionAction'), onClick: newSession }}
        />

        {/* 締め確認モーダル */}
        <BottomSheetModal
          show={showCloseConfirm}
          title={t('session.confirmClose')}
          description={t('session.confirmCloseDesc')}
          error={closeError}
          onClose={dismissCloseConfirm}
          secondaryAction={{ label: t('common.cancel'), onClick: dismissCloseConfirm }}
          primaryAction={{ label: t('session.close'), onClick: closeSession }}
        />

        {/* 再開確認モーダル */}
        <BottomSheetModal
          show={showReopenConfirm}
          title={t('session.confirmReopen')}
          description={t('session.confirmReopenDesc')}
          onClose={() => setShowReopenConfirm(false)}
          secondaryAction={{
            label: t('common.cancel'),
            onClick: () => setShowReopenConfirm(false),
          }}
          primaryAction={{ label: t('session.reopen'), onClick: reopenSession }}
        />
      </div>
    </>
  )
}
