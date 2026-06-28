import { BaseButton, StatusBadge } from "@/components";
import type { OrderItem } from "@order-system/shared";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

function OrderSection({ title, children }: { title?: string; children: ReactNode }) {
  if (title === undefined) return <>{children}</>;
  return (
    <div className="mt-1">
      <div className="px-5 pt-2.5 pb-1.5 text-label text-muted tracking-[0.08em]">{title}</div>
      {children}
    </div>
  );
}

export function OrderHistory({ items, onChangeStatus, onCancelTap }: {
  items: OrderItem[];
  onChangeStatus: (id: string) => void;
  onCancelTap: (item: OrderItem) => void;
}) {
  const { t } = useTranslation();
  const active = items.filter(i => i.status !== "cancelled" && i.status !== "served");
  const cancelled = items.filter(i => i.status === "cancelled");

  // 同一商品・同一価格・同一テイクアウト区分でまとめて表示行数を削減する
  const servedGroups = items
    .filter(i => i.status === "served")
    .reduce<{ key: string; menuItemName: string; price: number; isTakeout: boolean; totalQty: number; rep: OrderItem }[]>((acc, item) => {
      const key = `${item.menuItemId}-${item.price}-${item.isTakeout}`;
      const existing = acc.find(g => g.key === key);
      if (existing) { existing.totalQty += item.qty; }
      else { acc.push({ key, menuItemName: item.menuItemName, price: item.price, isTakeout: item.isTakeout, totalQty: item.qty, rep: item }); }
      return acc;
    }, []);

  return (
    <div className="flex-1 overflow-y-auto pb-5">
      <OrderSection>
        {active.map(item => (
          <div key={item.id} className="px-5 py-3 border-b border-surface flex items-center gap-2.5">
            <div className="flex-1">
              <div className="text-sm text-ink mb-1.25">
                {item.menuItemName}
                <span className="text-xs text-muted ml-1.5">×{item.qty}</span>
                {item.isTakeout && (
                  <span className="text-micro text-amber ml-1.5">🥡</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={item.status} />
                <span className="text-label text-muted">¥{item.price.toLocaleString()}</span>
              </div>
            </div>
            <BaseButton
              className={`border rounded-md px-2.75 py-1.25 text-label ${item.status === "ready" ? 'border-amber-border bg-amber-bg text-amber-fg' : 'border-line bg-white text-secondary'}`}
              onClick={() => onChangeStatus(item.id)}
              disabled={item.status === "pending" ? false : item.status === "ready" ? false : true}
            >
              {item.status === "ready"
                ? t('kitchen.serveComplete')
                : item.status === "pending"
                  ? t('group.cookComplete')
                  : t('group.alreadyDone')}
            </BaseButton>
            <BaseButton
              variant="ghost"
              className="text-lg text-dim px-1 py-0.5 leading-none"
              onClick={() => onCancelTap(item)}
            >
              ×
            </BaseButton>
          </div>
        ))}
      </OrderSection>

      {servedGroups.length > 0 && (
        <OrderSection title={t('group.served')}>
          {servedGroups.map(g => (
            <div key={g.key} className="px-5 py-2.5 border-b border-surface flex items-center gap-2 opacity-60">
              <div className="flex-1">
                <div className="text-note text-dim">
                  {g.menuItemName}
                  <span className="text-label text-muted ml-1.5">×{g.totalQty}</span>
                  {g.isTakeout && <span className="text-micro text-amber ml-1.5">🥡</span>}
                </div>
              </div>
              <BaseButton
                variant="ghost"
                className="text-lg text-dim px-1 py-0.5 leading-none"
                onClick={() => onCancelTap(g.rep)}
              >
                ×
              </BaseButton>
            </div>
          ))}
        </OrderSection>
      )}

      {cancelled.length > 0 && (
        <OrderSection title={t('group.cancelledItems')}>
          {cancelled.map(item => (
            <div key={item.id} className="px-5 py-2.5 border-b border-surface flex items-center gap-2 opacity-45">
              <span className="flex-1 text-note text-dim line-through">{item.menuItemName}</span>
              <span className="text-label text-muted">×{item.qty}</span>
            </div>
          ))}
        </OrderSection>
      )}

    </div>
  );
}
