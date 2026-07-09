import { useTranslation } from "react-i18next";
import { Toast } from "../Toast/Toast";

export function RetryableLoadError() {
  const { t } = useTranslation();
	  return (
	    <div className="flex flex-col items-center justify-center h-full gap-4 text-secondary">
	      <button className="px-4 py-2 rounded-lg bg-secondary text-white text-sm" onClick={() => window.location.reload()}>{t('common.retry')}</button>
	      <Toast message={t('common.loadError')} />
	    </div>
	  );
}
