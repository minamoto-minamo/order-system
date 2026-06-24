import { useTranslation } from "react-i18next";
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
  if (!open) return null;
  const total = items.reduce((sum, { item, qty }) => sum + item.price * qty, 0);
  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-end z-sheet animate-[fadeIn_0.2s_ease_both]"
      onClick={onClose}
    >
      <div
        className="w-full bg-white rounded-t-2xl max-h-[85vh] flex flex-col animate-[slideUp_0.22s_ease_both]"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white px-5 py-4 border-b border-divider shrink-0">
          <div className="text-sub font-medium text-ink">{t('group.reviewTitle')}</div>
        </div>
        <div className="overflow-y-auto flex-1">
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
          <div className="px-5 pt-2 pb-10">
            <button
              className={`w-full rounded-[10px] p-3.5 text-sm font-medium text-white border-none cursor-pointer disabled:opacity-50 ${orderType === 'takeout' ? 'bg-amber' : 'bg-ink'}`}
              onClick={onConfirm}
              disabled={submitting}
            >
              {orderType === 'takeout'
                ? `🥡 ${t('group.confirmOrderTakeout')}`
                : t('group.confirmOrderDineIn')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
