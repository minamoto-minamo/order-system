import { useTranslation } from "react-i18next";

export function HistoryTotalsFooter({ subtotal, tax }: { subtotal: number; tax: number }) {
  const { t } = useTranslation();
  return (
    <div className="fixed bottom-0 left-0 right-0 z-modal px-5 py-4 bg-white border-t border-divider flex flex-col gap-1">
      <div className="flex justify-between items-baseline">
        <span className="text-note text-muted">{t('customerOrder.subtotal')}</span>
        <span className="text-note text-dim">¥{subtotal.toLocaleString()}</span>
      </div>
      {tax > 0 && (
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-muted">{t('customerOrder.tax')}</span>
          <span className="text-xs text-muted">+¥{tax.toLocaleString()}</span>
        </div>
      )}
      <div className="flex justify-between items-baseline">
        <span className="text-note text-muted">{t('customerOrder.totalWithTax')}</span>
        <span className="text-sub font-medium text-ink">¥{(subtotal + tax).toLocaleString()}</span>
      </div>
    </div>
  );
}
