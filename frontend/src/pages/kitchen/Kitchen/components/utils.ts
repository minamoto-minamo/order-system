import { getSeatLabels } from "@/lib/utils";
import type { OrderItem, Group, Seat, MenuItem } from "@order-system/shared";
import type { DisplayOrder } from "./types";

export const elapsed = (ts: string) => {
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  return m < 1 ? "今" : `${m}分前`;
};

export const timeStr = (ts: string) => {
  const d = new Date(ts);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export const elapsedColor = (ts: string) => {
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (m >= 15) return "var(--color-danger)";
  if (m >= 8)  return "var(--color-bill)";
  return "var(--color-muted)";
};

// カテゴリ数が増えても色が足りなくなるのを防ぐため5色でローテーション
export const CAT_COLORS = ['var(--color-cat-1)', 'var(--color-cat-2)', 'var(--color-cat-3)', 'var(--color-cat-4)', 'var(--color-cat-5)'];
export const CAT_BG_COLORS = ['var(--color-cat-1-bg)', 'var(--color-cat-2-bg)', 'var(--color-cat-3-bg)', 'var(--color-cat-4-bg)', 'var(--color-cat-5-bg)'];

export function buildDisplay(o: OrderItem, menus: MenuItem[], groups: Group[], seats: Seat[], getGroupName: (id: string) => string): DisplayOrder {
  const g = groups.find(x => x.id === o.groupId);
  const m = menus.find(x => x.id === o.menuItemId);
  const seatLabels = g ? getSeatLabels(seats, g.seatIds) : '';
  return {
    id: o.id, groupId: o.groupId,
    groupName: g?.name ?? getGroupName(o.groupId),
    seats: seatLabels,
    item: o.menuItemName,
    qty: o.qty,
    catId: m?.categoryId ?? 0,
    subId: m?.subCategoryId ?? 0,
    orderedAt: o.orderedAt,
    status: o.status,
  };
}
