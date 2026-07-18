import type { Group, OrderItem } from '@order-system/shared'

export function calculateTaxTotals(
  items: OrderItem[],
  tax: Pick<Group, 'effectiveTaxRateInHouse' | 'effectiveTaxRateTakeout' | 'effectiveTaxInclusive'>,
) {
  const activeItems = items.filter((i) => i.status !== 'cancelled')
  const subtotal = activeItems.reduce((s, i) => s + i.price * i.qty, 0)
  // Math.floor で端数切り捨て（円未満の税額が生じないようにする）。税込明細は税額計算をスキップする
  const taxAmount = activeItems.reduce((s, i) => {
    const rate = i.isTakeout ? tax.effectiveTaxRateTakeout : tax.effectiveTaxRateInHouse
    return s + (tax.effectiveTaxInclusive ? 0 : Math.floor((i.price * i.qty * rate) / 100))
  }, 0)
  return { subtotal, tax: taxAmount }
}
