import { useTranslation } from 'react-i18next'

export default function NotFound() {
  const { t } = useTranslation()
  return (
    <div className="h-dvh overflow-y-auto bg-white p-5">
      <div
        className="min-h-full flex flex-col items-center gap-2"
        style={{ justifyContent: 'safe center' }}
      >
        <div className="text-sub font-medium text-ink">{t('notFound.title')}</div>
        <div className="text-note text-muted">{t('notFound.description')}</div>
      </div>
    </div>
  )
}
