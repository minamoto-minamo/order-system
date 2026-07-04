import { useTranslation } from "react-i18next";

export function LoadError() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-secondary">
      <p>{t('common.loadError')}</p>
      <button className="px-4 py-2 rounded-lg bg-info text-white text-sm" onClick={() => window.location.reload()}>{t('common.retry')}</button>
    </div>
  );
}
