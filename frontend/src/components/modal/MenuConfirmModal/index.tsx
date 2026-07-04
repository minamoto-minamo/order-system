import { useTranslation } from "react-i18next";
import { BottomSheetModal } from "../BottomSheetModal";
import type { MenuItem } from "@order-system/shared";

interface OrderItem {
  item: MenuItem;
  qty: number;
}

export function MenuConfirmModal({ open, items, orderType, submitting, onClose, onConfirm }: {
  open: boolean;
  items: OrderItem[];
  orderType: 'dine_in' | 'takeout';
  submitting?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const total = items.reduce((sum, { item, qty }) => sum + item.price * qty, 0);
  return (
    <BottomSheetModal
      show={open}
      scrollable
      onClose={onClose}
      primaryAction={{
        label: orderType === 'takeout'
          ? `🥡 ${t('group.confirmOrderTakeout')}`
          : t('group.confirmOrderDineIn'),
        variant: orderType === 'takeout' ? 'takeout' : 'default',
        disabled: submitting,
        onClick: onConfirm,
      }}
    >
      <div className="sticky top-0 bg-white px-5 py-4 border-b border-divider">
        <div className="text-sub font-medium text-ink">{t('group.reviewTitle')}</div>
      </div>
      <div className="px-5">
        {items.map(({ item, qty }) => (
          <div key={item.id} className="flex items-center py-3.5 border-b border-surface gap-3">
            <span className="flex-1 text-note text-ink">{item.name}</span>
            <span className="text-note text-muted shrink-0">×{qty}</span>
            <span className="text-note text-ink w-20 text-right shrink-0">¥{(item.price * qty).toLocaleString()}</span>
          </div>
        ))}
        <div className="flex items-center py-3.5 gap-3">
          <span className="flex-1 text-note font-medium text-ink">{t('group.total')}</span>
          <span className="text-note font-medium text-ink">¥{total.toLocaleString()}</span>
        </div>
      </div>
    </BottomSheetModal>
  );
}
