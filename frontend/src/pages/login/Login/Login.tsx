import type { Session } from '@order-system/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { LoginForm } from '@/features/auth/components'
import { api } from '@/lib/api'
import { EP } from '@/lib/endpoints'
import { ROUTES } from '@/lib/routes'
import { socket } from '@/lib/socket'
import type { AuthUser } from '@/stores/auth'
import { useAuthStore } from '@/stores/auth'
import { useSessionStore } from '@/stores/session'

export default function Login() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { setUser } = useAuthStore()
  const { setSession } = useSessionStore()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (username: string, password: string) => {
    setError(null)
    if (!username || !password) {
      setError(t('login.errorRequired'))
      return
    }
    setLoading(true)
    try {
      const user = await api.post<AuthUser>(EP.authLogin, { username, password })
      setUser(user)
      // Socket.io は接続時のハンドシェイクでしか cookie を検証しないため、
      // ログインで得た認証 cookie を反映するには再接続が必要
      socket.disconnect().connect()
      // ログイン自体は成功済みなので、現セッション取得失敗はセッションなし扱いで続行する
      const session = await api.get<Session | null>(EP.sessionsCurrent).catch(() => null)
      setSession(session)
      navigate(ROUTES.root, { replace: true })
    } catch {
      setError(t('login.errorInvalid'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <LoginForm
      title={t('login.title')}
      usernamePlaceholder={t('login.usernamePlaceholder')}
      passwordPlaceholder={t('login.passwordPlaceholder')}
      submitLabel={t('login.submit')}
      submittingLabel={t('login.submitting')}
      error={error}
      loading={loading}
      onSubmit={handleSubmit}
    />
  )
}
