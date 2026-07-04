import { BaseButton, IconButton, StatusBadge } from "@/components";
import type { OrderItem } from "@order-system/shared";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { partitionOrderItems } from "@/lib/partitionOrderItems";

export function OrderSection({ title, children }: { title?: string; children: ReactNode }) {
  if (title === undefined) return <>{children}</>;
  return (
    <div className="mt-1">
      <div className="px-5 pt-2.5 pb-1.5 text-label text-muted tracking-[0.08em]">{title}</div>
      {children}
    </div>
  );
}

function StatusActionButton({ item, onChangeStatus }: { item: OrderItem; onChangeStatus: (id: string) => void }) {
  const { t } = useTranslation();
  return (
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
  );
}

export function OrderHistory({ items, onChangeStatus, onCancelTap }: {
  items: OrderItem[];
  onChangeStatus: (id: string) => void;
  onCancelTap: (item: OrderItem) => void;
}) {
  const { t } = useTranslation();
  const { active, served, cancelled, courseCharges, courseDishes } = partitionOrderItems(items);

  return (
    <div className="flex-1 overflow-y-auto pb-5">
      <OrderSection title={t('group.notServed')}>
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
            <StatusActionButton item={item} onChangeStatus={onChangeStatus} />
            <IconButton
              className="w-8 h-8 flex items-center justify-center rounded-md text-lg text-dim"
              onClick={() => onCancelTap(item)}
              aria-label={t('group.cancelOrder')}
            >
              ×
            </IconButton>
          </div>
        ))}
      </OrderSection>

      {served.length > 0 && (
        <OrderSection title={t('group.served')}>
          {served.map(item => (
            <div key={item.id} className="px-5 py-2.5 border-b border-surface flex items-center gap-2">
              <div className="flex-1">
                <div className="text-note text-secondary">
                  {item.menuItemName}
                  <span className="text-label text-muted ml-1.5">×{item.qty}</span>
                  {item.isTakeout && <span className="text-micro text-amber ml-1.5">🥡</span>}
                </div>
                <div className="text-label text-muted mt-0.5">¥{item.price.toLocaleString()} · ¥{(item.price * item.qty).toLocaleString()}</div>
              </div>
              <IconButton
                className="w-8 h-8 flex items-center justify-center rounded-md text-lg text-dim"
                onClick={() => onCancelTap(item)}
                aria-label={t('group.cancelOrder')}
              >
                ×
              </IconButton>
            </div>
          ))}
        </OrderSection>
      )}

      {courseCharges.length > 0 && (
        <OrderSection title={t('group.courseTab')}>
          {courseCharges.map(item => {
            // 飲み放題の課金明細もコース由来の courseId を持つため、付属料理はコース課金明細にだけ表示する
            const dishes = item.isDrinkPlanCharge ? [] : courseDishes.filter(d => d.courseId === item.courseId);
            return (
              <div key={item.id} className="px-5 py-2.5 border-b border-surface">
                <div className="text-note text-secondary">
                  {item.menuItemName}
                  <span className="text-label text-muted ml-1.5">×{item.qty}</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between text-label text-muted">
                  <span>¥{item.price.toLocaleString()}</span>
                  <span>¥{(item.price * item.qty).toLocaleString()}</span>
                </div>
                {dishes.map(d => (
                  <div key={d.id} className="mt-1 flex items-center gap-2.5">
                    <span className="flex-1 text-note text-secondary">{d.menuItemName}</span>
                    {d.status === "served" ? (
                      <span className="px-2.75 py-1.25 text-label text-muted">{t('group.served')}</span>
                    ) : (
                      <StatusActionButton item={d} onChangeStatus={onChangeStatus} />
                    )}
                  </div>
                ))}
              </div>
            );
          })}
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
