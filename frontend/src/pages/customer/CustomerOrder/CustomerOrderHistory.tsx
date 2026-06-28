import { useTranslation } from "react-i18next";
import type { OrderItem } from "@order-system/shared";
import { OrderSection } from "@/pages/group/GroupDetail/components/OrderHistory";

type ItemGroup = { key: string; menuItemName: string; price: number; totalQty: number };

function groupItems(list: OrderItem[]): ItemGroup[] {
  return list.reduce<ItemGroup[]>((acc, item) => {
    const key = `${item.menuItemId}-${item.price}`;
    const existing = acc.find(g => g.key === key);
    if (existing) { existing.totalQty += item.qty; }
    else { acc.push({ key, menuItemName: item.menuItemName, price: item.price, totalQty: item.qty }); }
    return acc;
  }, []);
}

export function CustomerOrderHistory({ items, taxRate }: { items: OrderItem[]; taxRate: number }) {
  const { t } = useTranslation();

  const activeGroups    = groupItems(items.filter(i => i.status !== 'cancelled' && i.status !== 'served'));
  const servedGroups    = groupItems(items.filter(i => i.status === 'served'));
  const cancelledGroups = groupItems(items.filter(i => i.status === 'cancelled'));
  const subtotal = items.filter(i => i.status !== 'cancelled').reduce((sum, i) => sum + i.price * i.qty, 0);
  const tax      = items.filter(i => i.status !== 'cancelled').reduce((sum, i) => sum + Math.floor(i.price * i.qty * taxRate / 100), 0);

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted text-note">
        {t('customerOrder.noOrders')}
      </div>
    );
  }

  return (
    <>
      <OrderSection>
        {activeGroups.map(g => (
          <div key={g.key} className="px-5 py-3 border-b border-surface flex items-center gap-2.5 bg-white">
            <div className="flex-1">
              <div className="text-sm text-ink mb-1.25">
                {g.menuItemName}
                <span className="text-xs text-muted ml-1.5">×{g.totalQty}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-caption text-muted">{t('customerOrder.notServed')}</span>
                <span className="text-label text-muted">¥{g.price.toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}
      </OrderSection>

      {servedGroups.length > 0 && (
        <OrderSection title={t('group.served')}>
          {servedGroups.map(g => (
            <div key={g.key} className="px-5 py-2.5 border-b border-surface flex items-center gap-2 bg-white">
              <div className="flex-1">
                <div className="text-note text-secondary">
                  {g.menuItemName}
                  <span className="text-label text-muted ml-1.5">×{g.totalQty}</span>
                </div>
                <div className="text-label text-muted mt-0.5">¥{g.price.toLocaleString()} · ¥{(g.price * g.totalQty).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </OrderSection>
      )}

      {cancelledGroups.length > 0 && (
        <OrderSection title={t('group.cancelledItems')}>
          {cancelledGroups.map(g => (
            <div key={g.key} className="px-5 py-2.5 border-b border-surface flex items-center gap-2 opacity-45 bg-white">
              <span className="flex-1 text-note text-dim line-through">{g.menuItemName}</span>
              <span className="text-label text-muted">×{g.totalQty}</span>
            </div>
          ))}
        </OrderSection>
      )}

      <div className="px-5 py-4 bg-white border-t border-divider mt-2 flex flex-col gap-1">
        <div className="flex justify-between items-baseline">
          <span className="text-note text-muted">{t('customerOrder.subtotal')}</span>
          <span className="text-note text-dim">¥{subtotal.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-muted">{t('customerOrder.tax')}</span>
          <span className="text-xs text-muted">+¥{tax.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-note text-muted">{t('customerOrder.totalWithTax')}</span>
          <span className="text-sub font-medium text-ink">¥{(subtotal + tax).toLocaleString()}</span>
        </div>
      </div>
    </>
  );
}
