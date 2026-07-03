import { useTranslation } from "react-i18next";
import { getSeatLabels } from "@/lib/utils";
import { IconButton } from "@/components";
import type { Group, Seat } from "@order-system/shared";
import type { DisplayCat, DisplayOrder } from "./types";

export function SidePanel({ groupId, groups, orders, seats, cats, onClose, onServed, onNavigate }: {
  groupId: string;
  groups: Group[];
  orders: DisplayOrder[];
  seats: Seat[];
  cats: DisplayCat[];
  onClose: () => void;
  onServed: (id: string) => void;
  onNavigate: (groupId: string) => void;
}) {
  const { t } = useTranslation();
  const group = groups.find(g => g.id === groupId);
  if (!group) return null;
  const seatLabels = getSeatLabels(seats, group.seatIds);
  const items = orders.filter(o => o.groupId === groupId);
  const readyItems   = items.filter(o => o.status === "ready");
  const pendingItems = items.filter(o => o.status === "pending");
  return (
    <div className="fixed inset-0 z-sheet flex justify-end">
      {/* 背景タップでパネルを閉じるためのオーバーレイ */}
      <div onClick={onClose} className="flex-1 bg-black/20"/>
      <div className="side-panel w-75 bg-white border-l border-divider flex flex-col h-full animate-[slideIn_0.2s_ease_both]">
        <div className="px-5 py-4 border-b border-divider flex items-center justify-between">
          <div>
            <div className="text-sub font-medium text-ink">{group.name}</div>
            <div className="text-label text-muted mt-0.5">{seatLabels}</div>
          </div>
          <IconButton
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md text-lg text-dim"
            aria-label={t('common.close')}
          >
            ×
          </IconButton>
        </div>
        <div className="flex-1 px-5 py-4 overflow-y-auto">
          {readyItems.length > 0 && (
            <div className="mb-4">
              <div className="text-label text-bill font-medium mb-2 tracking-[0.08em]">{`🍽 ${t('common.readyToServe')}`}</div>
              {readyItems.map(o => (
                <div key={o.id} className="px-2.5 py-2 mb-1 bg-amber-bg border border-amber-border rounded-lg flex items-center gap-2">
                  <span className="flex-1 text-note text-secondary">{o.item}</span>
                  <span className="text-xs text-muted">×{o.qty}</span>
                  <button className="complete-btn bg-amber-bg border border-amber-border rounded-[5px] px-2 py-0.75 text-caption text-amber-fg" onClick={() => onServed(o.id)}>{t('kitchen.serveComplete')}</button>
                </div>
              ))}
            </div>
          )}
          {pendingItems.length > 0 && (
            <div>
              <div className="text-label text-muted font-medium mb-2 tracking-[0.08em]">{t('kitchen.pending')}</div>
              {pendingItems.map(o => {
                const cat = cats.find(c => c.id === o.catId);
                const sub = cat?.subs.find(s => s.id === o.subId);
                return (
                  <div key={o.id} className="py-2.5 border-b border-surface flex items-center gap-2">
                    <div className="flex-1">
                      <div className="text-note text-ink">{o.item}</div>
                      {cat && (
                        <div className="text-caption text-dim mt-0.5">
                          {cat.label}{sub ? ` › ${sub.label}` : ''}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted">×{o.qty}</span>
                  </div>
                );
              })}
            </div>
          )}
          {items.length === 0 && (
            <div className="text-note text-muted">{t('kitchen.noOrders')}</div>
          )}
        </div>
        <div className="px-5 py-3.5 border-t border-divider">
          <button
            className="w-full border border-line rounded-lg py-2 text-xs text-dim bg-white"
            onClick={() => onNavigate(groupId)}
          >
            {t('kitchen.openGroupDetail')}
          </button>
        </div>
      </div>
    </div>
  );
}
