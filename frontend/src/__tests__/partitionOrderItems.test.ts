import type { OrderItem, OrderItemStatus } from '@order-system/shared'
import { partitionOrderItems } from '../lib/partitionOrderItems'

function makeItem(overrides: Partial<OrderItem> & { id: string }): OrderItem {
  return {
    groupId: 'uuid-group-1',
    menuItemId: 1,
    menuItemName: '唐揚げ',
    price: 500,
    qty: 1,
    status: 'pending' as OrderItemStatus,
    isTakeout: false,
    courseId: null,
    isCourseCharge: false,
    isDrinkPlanCharge: false,
    isSetCharge: false,
    setOrderItemId: null,
    orderedAt: '2026-07-04T00:00:00.000Z',
    options: [],
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
    expect(result.active.map((i) => i.id)).toEqual(['a', 'b'])
    expect(result.served.map((i) => i.id)).toEqual(['c'])
    expect(result.cancelled.map((i) => i.id)).toEqual(['d'])
  })

  it('コース付属料理はステータスに関わらず courseDishes にだけ入る', () => {
    const items = [
      makeItem({ id: 'dish-pending', courseId: 10, price: 0, status: 'pending' }),
      makeItem({ id: 'dish-served', courseId: 10, price: 0, status: 'served' }),
    ]
    const result = partitionOrderItems(items)
    expect(result.courseDishes.map((i) => i.id)).toEqual(['dish-pending', 'dish-served'])
    expect(result.active).toEqual([])
    expect(result.served).toEqual([])
  })

  it('キャンセル済みのコース付属料理はどこにも表示しない', () => {
    const items = [makeItem({ id: 'dish-cancelled', courseId: 10, price: 0, status: 'cancelled' })]
    const result = partitionOrderItems(items)
    expect(result.courseDishes).toEqual([])
    expect(result.cancelled).toEqual([])
  })

  it('課金明細は courseCharges に、キャンセル済み課金明細は cancelled に入る', () => {
    const items = [
      makeItem({ id: 'charge', courseId: 10, isCourseCharge: true, status: 'served' }),
      makeItem({
        id: 'plan-charge',
        courseId: 10,
        isCourseCharge: true,
        isDrinkPlanCharge: true,
        status: 'served',
      }),
      makeItem({ id: 'old-charge', courseId: 11, isCourseCharge: true, status: 'cancelled' }),
    ]
    const result = partitionOrderItems(items)
    expect(result.courseCharges.map((i) => i.id)).toEqual(['charge', 'plan-charge'])
    expect(result.cancelled.map((i) => i.id)).toEqual(['old-charge'])
  })

  it('セットの内訳商品はステータスに関わらず setDishes にだけ入る', () => {
    const items = [
      makeItem({ id: 'set-dish-pending', setOrderItemId: 'set-1', price: 0, status: 'pending' }),
      makeItem({ id: 'set-dish-served', setOrderItemId: 'set-1', price: 0, status: 'served' }),
    ]
    const result = partitionOrderItems(items)
    expect(result.setDishes.map((i) => i.id)).toEqual(['set-dish-pending', 'set-dish-served'])
    expect(result.active).toEqual([])
    expect(result.served).toEqual([])
  })

  it('キャンセル済みのセット内訳商品はどこにも表示しない', () => {
    const items = [
      makeItem({
        id: 'set-dish-cancelled',
        setOrderItemId: 'set-1',
        price: 0,
        status: 'cancelled',
      }),
    ]
    const result = partitionOrderItems(items)
    expect(result.setDishes).toEqual([])
    expect(result.cancelled).toEqual([])
  })

  it('セット課金明細は setCharges に、キャンセル済み課金明細は cancelled に入る', () => {
    const items = [
      makeItem({ id: 'set-1', isSetCharge: true, status: 'served' }),
      makeItem({ id: 'set-2-cancelled', isSetCharge: true, status: 'cancelled' }),
    ]
    const result = partitionOrderItems(items)
    expect(result.setCharges.map((i) => i.id)).toEqual(['set-1'])
    expect(result.cancelled.map((i) => i.id)).toEqual(['set-2-cancelled'])
  })

  it('同じセット商品を2回注文しても setOrderItemId によりインスタンス単位で内訳が区別される', () => {
    const items = [
      makeItem({ id: 'set-1', menuItemId: 99, isSetCharge: true, status: 'served' }),
      makeItem({ id: 'set-2', menuItemId: 99, isSetCharge: true, status: 'served' }),
      makeItem({
        id: 'set-1-dish',
        menuItemId: 1,
        setOrderItemId: 'set-1',
        price: 0,
        status: 'pending',
      }),
      makeItem({
        id: 'set-2-dish',
        menuItemId: 2,
        setOrderItemId: 'set-2',
        price: 0,
        status: 'pending',
      }),
    ]
    const result = partitionOrderItems(items)
    expect(result.setCharges.map((i) => i.id)).toEqual(['set-1', 'set-2'])
    expect(result.setDishes.filter((d) => d.setOrderItemId === 'set-1').map((i) => i.id)).toEqual([
      'set-1-dish',
    ])
    expect(result.setDishes.filter((d) => d.setOrderItemId === 'set-2').map((i) => i.id)).toEqual([
      'set-2-dish',
    ])
  })
})
