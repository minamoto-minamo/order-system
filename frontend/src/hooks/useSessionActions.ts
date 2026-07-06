import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { ApiError, apiErrorMessage } from '@/lib/apiError'
import { EP } from '@/lib/endpoints'
import { useSessionStore } from '@/stores/session'
import type { Session } from '@order-system/shared'

interface UseSessionActionsOptions {
  onSuccess?: () => void
  onError?: (message: string) => void
}

export function useSessionActions(options: UseSessionActionsOptions = {}) {
  const { onSuccess, onError } = options
  const { t } = useTranslation()
  const { session, setSession } = useSessionStore()
  const [showNewConfirm, setShowNewConfirm] = useState(false)
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
    } catch (e) {
      if (e instanceof ApiError && e.serverCode === 'sessions.close.active_groups_exist') {
        setCloseError(t('session.activeGroupsExist'))
        return
      }
      const message = apiErrorMessage(e, t('common.saveFailed'))
      setCloseError(message)
      onError?.(message)
    }
  }

  const reopenSession = async () => {
    if (!session) return
    try {
      const updated = await api.put<Session>(EP.session(session.id), { status: 'open' })
      setSession(updated)
      setShowReopenConfirm(false)
      onSuccess?.()
    } catch (e) {
      onError?.(apiErrorMessage(e, t('common.saveFailed')))
    }
  }

  const newSession = async () => {
    // バックエンドはボディ不要だが、api ラッパーが POST 時に Content-Type を付与するため空オブジェクトを渡す
    try {
      const created = await api.post<Session>(EP.sessions, {})
      setSession(created)
      setShowNewConfirm(false)
      onSuccess?.()
    } catch (e) {
      onError?.(apiErrorMessage(e, t('common.saveFailed')))
    }
  }

  const dismissCloseConfirm = () => {
    setShowCloseConfirm(false)
    setCloseError(null)
  }

  return {
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
  }
}
