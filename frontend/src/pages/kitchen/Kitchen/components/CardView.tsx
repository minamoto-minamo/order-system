import { useTranslation } from "react-i18next";
import { getSeatLabels } from "@/lib/utils";
import { elapsed, elapsedColor } from "./utils";
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
    <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 p-4 animate-[fadeIn_0.25s_ease_both]">
      {groups.map(g => {
        const groupOrders = orders.filter(o => o.groupId === g.id);
        const seatLabels = getSeatLabels(seats, g.seatIds);
        // グループ内で最も古い注文の時刻をカード右上の経過時間表示に使う
        const firstOrder = groupOrders[0] ?? null;
        return (
          <div
            key={g.id}
            onClick={() => onCardClick(g.id)}
            className="bg-white border border-divider rounded-[10px] overflow-hidden cursor-pointer"
          >
            <div className="px-3.5 pt-2.5 pb-2 border-b border-surface-deep flex items-baseline justify-between">
              <div>
                <span className="text-note font-medium text-ink">{g.name}</span>
                <span className="text-label text-muted ml-1.5">{seatLabels}</span>
              </div>
              {firstOrder && (
                <span className="text-label font-medium" style={{ color: elapsedColor(firstOrder.orderedAt) }}>
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
                  <div key={o.id} onClick={e => e.stopPropagation()} className="flex items-center px-3.5 py-1.5 gap-2">
                    <span className="flex-1 text-note text-ink">{o.item}</span>
                    <span className="text-xs text-muted">×{o.qty}</span>
                    <button className="complete-btn bg-none border border-line rounded-[5px] px-2 py-0.75 text-caption text-dim ml-1" onClick={() => onComplete(o.id)}>{t('kitchen.complete')}</button>
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
