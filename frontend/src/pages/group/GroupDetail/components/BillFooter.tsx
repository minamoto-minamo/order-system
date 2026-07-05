import { BaseButton } from "@/components";
import type { GroupStatus, OrderItem } from "@order-system/shared";
import { useTranslation } from "react-i18next";

interface BillFooterProps {
  items: OrderItem[]
  groupStatus: GroupStatus | undefined
  onBillRequest: () => void
  onBillCancel: () => void
  onCheckOut: () => void
}

export function BillFooter({ items, groupStatus, onBillRequest, onBillCancel, onCheckOut }: BillFooterProps) {
  const { t } = useTranslation();
  const activeItems = items.filter(i => i.status !== 'cancelled');
  const subtotal = activeItems.reduce((s, i) => s + i.price * i.qty, 0);
  // Math.floor で端数切り捨て（円未満の税額が生じないようにする）
  const tax = activeItems.reduce((s, i) => s + Math.floor(i.price * i.qty * i.taxRate / 100), 0);

  return (
    <div className="px-4 pt-4 pb-5 border-t border-divider bg-surface shrink-0">
      <div className="mb-3.5">
        <div className="flex justify-between items-baseline mb-0.5">
          <span className="text-note text-dim">{t('group.total')}</span>
          <span className="text-note text-dim">¥{subtotal.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-baseline mb-0.5">
          <span className="text-xs text-muted">{t('group.tax')}</span>
          <span className="text-xs text-muted">+¥{tax.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-note text-dim">{t('group.totalWithTax')}</span>
          <span className="text-lg font-medium text-ink">¥{(subtotal + tax).toLocaleString()}</span>
        </div>
      </div>
      {groupStatus === 'bill_requested' ? (
        <div className="flex gap-2">
          <BaseButton
            variant="secondary"
            className="flex-1 rounded-[10px] py-3.5 text-note font-medium"
            onClick={onBillCancel}
          >
            {t('group.billCancel')}
          </BaseButton>
          <BaseButton
            variant="secondary"
            className="flex-1 rounded-[10px] py-3.5 text-note font-medium"
            onClick={onCheckOut}
          >
            {t('group.checkOut')}
          </BaseButton>
        </div>
      ) : (
        <BaseButton
          className="w-full border-none rounded-[10px] py-3.5 text-sub font-medium text-white bg-brand disabled:opacity-40"
          onClick={onBillRequest}
          // 調理中・提供待ちの注文が残っている間は会計リクエストを送れない
          disabled={items.some(i => i.status === 'pending' || i.status === 'ready')}
        >
          {t('group.bill')}
        </BaseButton>
      )}
    </div>
  );
}
