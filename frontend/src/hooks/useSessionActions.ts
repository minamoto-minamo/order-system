import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { EP } from '@/lib/endpoints'
import { useSessionStore } from '@/stores/session'
import type { Session } from '@order-system/shared'

interface UseSessionActionsOptions {
  onSuccess?: () => void
}

export function useSessionActions(options: UseSessionActionsOptions = {}) {
  const { onSuccess } = options
  const { t } = useTranslation()
  const { session, setSession } = useSessionStore()
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [showReopenConfirm, setShowReopenConfirm] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)

  const isOpen = session?.status === 'open'

  const closeSession = async () => {
    if (!session) return
    try {
      const updated = await api.put<Session>(EP.session(session.id), { status: 'closed' })
      setSession(updated)
      setShowCloseConfirm(false)
      setCloseError(null)
      onSuccess?.()
    } catch {
      setCloseError(t('session.activeGroupsExist'))
    }
  }

  const reopenSession = async () => {
    if (!session) return
    const updated = await api.put<Session>(EP.session(session.id), { status: 'open' }).catch(() => null)
    if (updated) setSession(updated)
    setShowReopenConfirm(false)
  }

  const newSession = async () => {
    // バックエンドはボディ不要だが、api ラッパーが POST 時に Content-Type を付与するため空オブジェクトを渡す
    const created = await api.post<Session>(EP.sessions, {}).catch(() => null)
    if (created) {
      setSession(created)
      onSuccess?.()
    }
  }

  const dismissCloseConfirm = () => {
    setShowCloseConfirm(false)
    setCloseError(null)
  }

  return {
    session,
    isOpen,
    showCloseConfirm,
    setShowCloseConfirm,
    showReopenConfirm,
    setShowReopenConfirm,
    closeError,
    closeSession,
    reopenSession,
    newSession,
    dismissCloseConfirm,
  }
}
