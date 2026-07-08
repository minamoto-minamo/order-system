import { useTranslation } from "react-i18next";
import { getSeatLabels } from "@/lib/utils";
import { elapsed } from "./utils";
import type { DisplayOrder } from "./types";
import type { Group, Seat } from "@order-system/shared";

export function CardView({ groups, orders, seats, onComplete, onCardClick }: {
  groups: Group[];
  orders: DisplayOrder[];
  seats: Seat[];
  onComplete: (id: string) => void;
  onCardClick: (groupId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 p-4 animate-[fadeIn_0.25s_ease_both]">
      {groups.map(g => {
        const groupOrders = orders.filter(o => o.groupId === g.id);
        const seatLabels = getSeatLabels(seats, g.seatIds);
        // グループ内で最も古い注文の時刻をカード右上の経過時間表示に使う
        const firstOrder = groupOrders[0] ?? null;
        return (
          <div
            key={g.id}
            onClick={() => onCardClick(g.id)}
            className="bg-white border border-brand-border rounded-[10px] overflow-hidden cursor-pointer"
          >
            <div className="px-3.5 py-2.25 bg-brand flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-label font-medium text-white truncate">{g.name}</span>
                  <span className="rounded-full bg-white/15 px-2 py-px text-label text-white">{t('kitchen.pendingCount', { count: groupOrders.length })}</span>
                </div>
                <div className="mt-0.5 text-caption text-white/80 truncate">{seatLabels}</div>
              </div>
              {firstOrder && (
                <span className="shrink-0 text-label font-medium text-white/90">
                  {elapsed(firstOrder.orderedAt)}
                </span>
              )}
            </div>
            <div className="py-2">
              {groupOrders.length === 0 ? (
                <div className="px-3.5 py-2 text-note text-muted">{t('kitchen.noOrders')}</div>
              ) : (
                groupOrders.map(o => (
                  // カード全体クリック（onCardClick）との競合を防ぐ
                  <div key={o.id} onClick={e => e.stopPropagation()} className="flex items-center px-3.5 py-1.75 gap-2 border-b border-surface last:border-b-0">
                    <span className="min-w-0 flex-1 truncate text-caption font-medium text-ink">{o.item}</span>
                    <span className="shrink-0 rounded-full bg-surface-deep px-2 py-0.5 text-caption text-secondary">×{o.qty}</span>
                    <button className="complete-btn shrink-0 bg-white border border-line rounded-md px-2.5 py-3 text-caption leading-4 text-dim" onClick={() => onComplete(o.id)}>{t('kitchen.complete')}</button>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
