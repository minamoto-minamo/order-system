import { useTranslation } from "react-i18next";

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-surface gap-2">
      <div className="text-sub font-medium text-ink">{t('notFound.title')}</div>
      <div className="text-note text-muted">{t('notFound.description')}</div>
    </div>
  );
}
