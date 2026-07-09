import type { OrderItem } from "@order-system/shared";

export function calculateTaxTotals(items: OrderItem[]) {
  const activeItems = items.filter(i => i.status !== 'cancelled');
  const subtotal = activeItems.reduce((s, i) => s + i.price * i.qty, 0);
  // Math.floor で端数切り捨て（円未満の税額が生じないようにする）。税込明細は税額計算をスキップする
  const tax = activeItems.reduce((s, i) => s + (i.taxInclusive ? 0 : Math.floor(i.price * i.qty * i.taxRate / 100)), 0);
  return { subtotal, tax };
}
