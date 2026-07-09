import type { OrderItem, OrderItemStatus } from '@order-system/shared'
import { calculateTaxTotals } from '../lib/taxTotals'

function makeItem(overrides: Partial<OrderItem> & { id: string }): OrderItem {
  const { id, ...rest } = overrides;
  return {
    id,
    groupId: 'group-1',
    menuItemId: 1,
    menuItemName: '商品',
    price: 1000,
    qty: 1,
    status: 'served' as OrderItemStatus,
    isTakeout: false,
    taxRate: 10,
    taxInclusive: false,
    courseId: null,
    isCourseCharge: false,
    isDrinkPlanCharge: false,
    orderedAt: '2026-07-04T00:00:00.000Z',
    ...rest,
  }
}

describe('calculateTaxTotals', () => {
  it('税込・外税・混在の明細を明細単位で扱う（会計画面のケース）', () => {
    const items = [
      makeItem({ id: 'exclusive', price: 1000, qty: 2, taxRate: 10, taxInclusive: false }),
      makeItem({ id: 'inclusive', price: 800, qty: 3, taxRate: 10, taxInclusive: true }),
      makeItem({ id: 'takeout', price: 500, qty: 1, taxRate: 8, taxInclusive: false }),
      makeItem({ id: 'cancelled', price: 900, qty: 1, status: 'cancelled', taxRate: 10, taxInclusive: false }),
    ]

    expect(calculateTaxTotals(items)).toEqual({ subtotal: 4900, tax: 240 })
  })

  it('税込・外税・混在の明細を明細単位で扱う（客用注文履歴のケース）', () => {
    const items = [
      makeItem({ id: 'exclusive', price: 1200, qty: 1, taxRate: 10, taxInclusive: false }),
      makeItem({ id: 'inclusive', price: 600, qty: 2, taxRate: 10, taxInclusive: true }),
    ]

    expect(calculateTaxTotals(items)).toEqual({ subtotal: 2400, tax: 120 })
  })

  it('全明細が税込の場合、税額は常に0になる', () => {
    const items = [
      makeItem({ id: 'inclusive-1', price: 1000, qty: 1, taxInclusive: true }),
      makeItem({ id: 'inclusive-2', price: 500, qty: 2, taxInclusive: true }),
    ]

    expect(calculateTaxTotals(items)).toEqual({ subtotal: 2000, tax: 0 })
  })
})
