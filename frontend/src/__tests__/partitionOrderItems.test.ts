import { partitionOrderItems } from '../lib/partitionOrderItems'
import type { OrderItem, OrderItemStatus } from '@order-system/shared'

function makeItem(overrides: Partial<OrderItem> & { id: string }): OrderItem {
  return {
    groupId: 'uuid-group-1',
    menuItemId: 1,
    menuItemName: '唐揚げ',
    price: 500,
    qty: 1,
    status: 'pending' as OrderItemStatus,
    isTakeout: false,
    taxRate: 10,
    taxInclusive: false,
    courseId: null,
    isCourseCharge: false,
    isDrinkPlanCharge: false,
    orderedAt: '2026-07-04T00:00:00.000Z',
    ...overrides,
  }
}

describe('partitionOrderItems', () => {
  it('通常注文をステータスで active / served / cancelled に振り分ける', () => {
    const items = [
      makeItem({ id: 'a', status: 'pending' }),
      makeItem({ id: 'b', status: 'ready' }),
      makeItem({ id: 'c', status: 'served' }),
      makeItem({ id: 'd', status: 'cancelled' }),
    ]
    const result = partitionOrderItems(items)
    expect(result.active.map(i => i.id)).toEqual(['a', 'b'])
    expect(result.served.map(i => i.id)).toEqual(['c'])
    expect(result.cancelled.map(i => i.id)).toEqual(['d'])
  })

  it('コース付属料理はステータスに関わらず courseDishes にだけ入る', () => {
    const items = [
      makeItem({ id: 'dish-pending', courseId: 10, price: 0, status: 'pending' }),
      makeItem({ id: 'dish-served', courseId: 10, price: 0, status: 'served' }),
    ]
    const result = partitionOrderItems(items)
    expect(result.courseDishes.map(i => i.id)).toEqual(['dish-pending', 'dish-served'])
    expect(result.active).toEqual([])
    expect(result.served).toEqual([])
  })

  it('キャンセル済みのコース付属料理はどこにも表示しない', () => {
    const items = [
      makeItem({ id: 'dish-cancelled', courseId: 10, price: 0, status: 'cancelled' }),
    ]
    const result = partitionOrderItems(items)
    expect(result.courseDishes).toEqual([])
    expect(result.cancelled).toEqual([])
  })

  it('課金明細は courseCharges に、キャンセル済み課金明細は cancelled に入る', () => {
    const items = [
      makeItem({ id: 'charge', courseId: 10, isCourseCharge: true, status: 'served' }),
      makeItem({ id: 'plan-charge', courseId: 10, isCourseCharge: true, isDrinkPlanCharge: true, status: 'served' }),
      makeItem({ id: 'old-charge', courseId: 11, isCourseCharge: true, status: 'cancelled' }),
    ]
    const result = partitionOrderItems(items)
    expect(result.courseCharges.map(i => i.id)).toEqual(['charge', 'plan-charge'])
    expect(result.cancelled.map(i => i.id)).toEqual(['old-charge'])
  })
})
