import type { OrderItem, OrderItemStatus } from '@order-system/shared'
import { calculateTaxTotals } from '../lib/taxTotals'

function makeItem(overrides: Partial<OrderItem> & { id: string }): OrderItem {
  const { id, ...rest } = overrides
  return {
    id,
    groupId: 'group-1',
    menuItemId: 1,
    menuItemName: '商品',
    price: 1000,
    qty: 1,
    status: 'served' as OrderItemStatus,
    isTakeout: false,
    courseId: null,
    isCourseCharge: false,
    isDrinkPlanCharge: false,
    orderedAt: '2026-07-04T00:00:00.000Z',
    ...rest,
  }
}

const exclusiveTax = {
  effectiveTaxRateInHouse: 10,
  effectiveTaxRateTakeout: 8,
  effectiveTaxInclusive: false,
}

const inclusiveTax = {
  effectiveTaxRateInHouse: 10,
  effectiveTaxRateTakeout: 8,
  effectiveTaxInclusive: true,
}

describe('calculateTaxTotals', () => {
  it('店内・テイクアウトの税率を Group の実効税率で出し分ける', () => {
    const items = [
      makeItem({ id: 'dine-in', price: 1000, qty: 2 }),
      makeItem({ id: 'takeout', price: 500, qty: 1, isTakeout: true }),
      makeItem({ id: 'cancelled', price: 900, qty: 1, status: 'cancelled' }),
    ]

    expect(calculateTaxTotals(items, exclusiveTax)).toEqual({ subtotal: 2500, tax: 240 })
  })

  it('Group が税込の場合、税額は常に0になる', () => {
    const items = [
      makeItem({ id: 'inclusive-1', price: 1000, qty: 1 }),
      makeItem({ id: 'inclusive-2', price: 500, qty: 2, isTakeout: true }),
    ]

    expect(calculateTaxTotals(items, inclusiveTax)).toEqual({ subtotal: 2000, tax: 0 })
  })
})
