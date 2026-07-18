import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { LoginForm } from '@/features/auth/components'
import { api } from '@/lib/api'
import { EP } from '@/lib/endpoints'
import { ROUTES } from '@/lib/routes'
import type { PlatformAdmin } from '@/stores/platformAuth'
import { usePlatformAuthStore } from '@/stores/platformAuth'

export default function PlatformLogin() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { setAdmin } = usePlatformAuthStore()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (username: string, password: string) => {
    setError(null)
    if (!username || !password) {
      setError(t('platform.errorRequired'))
      return
    }
    setLoading(true)
    try {
      const admin = await api.post<PlatformAdmin>(EP.platformAuthLogin, { username, password })
      setAdmin(admin)
      navigate(ROUTES.platformStores, { replace: true })
    } catch {
      setError(t('platform.errorInvalid'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <LoginForm
      title={t('platform.loginTitle')}
      usernamePlaceholder={t('platform.usernamePlaceholder')}
      passwordPlaceholder={t('platform.passwordPlaceholder')}
      submitLabel={t('platform.submit')}
      submittingLabel={t('platform.submitting')}
      error={error}
      loading={loading}
      onSubmit={handleSubmit}
    />
  )
}
