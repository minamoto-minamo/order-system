import type { OrderItem, OrderItemStatus } from '@order-system/shared'
import { applyQueuedOrderEvents, type QueuedOrderEvent } from '../lib/applyQueuedOrderEvents'

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

describe('applyQueuedOrderEvents', () => {
  it('REST基点に存在しないidへの created イベントが追加される', () => {
    const base = [makeItem({ id: 'a' })]
    const events: QueuedOrderEvent[] = [{ type: 'created', item: makeItem({ id: 'b' }) }]
    const result = applyQueuedOrderEvents(base, events)
    expect(result.map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('REST基点に既に存在する同一idへの created イベントは重複追加されない', () => {
    const base = [makeItem({ id: 'a', qty: 1 })]
    const events: QueuedOrderEvent[] = [{ type: 'created', item: makeItem({ id: 'a', qty: 2 }) }]
    const result = applyQueuedOrderEvents(base, events)
    expect(result).toEqual(base)
  })

  it('updated イベントが対象idの内容を丸ごと置換する', () => {
    const base = [makeItem({ id: 'a', qty: 1, status: 'pending' })]
    const updatedItem = makeItem({ id: 'a', qty: 3, status: 'ready' })
    const events: QueuedOrderEvent[] = [{ type: 'updated', item: updatedItem }]
    const result = applyQueuedOrderEvents(base, events)
    expect(result).toEqual([updatedItem])
  })

  it('updated イベントの対象idが基点に存在しない場合は何も変化しない', () => {
    const base = [makeItem({ id: 'a' })]
    const events: QueuedOrderEvent[] = [{ type: 'updated', item: makeItem({ id: 'z' }) }]
    const result = applyQueuedOrderEvents(base, events)
    expect(result).toEqual(base)
  })

  it('cancelled イベントが対象idのstatusのみを cancelled に変更しほかのフィールドは保持する', () => {
    const base = [makeItem({ id: 'a', qty: 2, status: 'pending' })]
    const events: QueuedOrderEvent[] = [{ type: 'cancelled', id: 'a' }]
    const result = applyQueuedOrderEvents(base, events)
    expect(result).toEqual([makeItem({ id: 'a', qty: 2, status: 'cancelled' })])
  })

  it('cancelled イベントの対象idが基点に存在しない場合は何も変化しない', () => {
    const base = [makeItem({ id: 'a' })]
    const events: QueuedOrderEvent[] = [{ type: 'cancelled', id: 'z' }]
    const result = applyQueuedOrderEvents(base, events)
    expect(result).toEqual(base)
  })

  it('同一idへの created → updated が受信順どおりに適用され最終的にupdated内容が反映される', () => {
    const base: OrderItem[] = []
    const createdItem = makeItem({ id: 'a', qty: 1, status: 'pending' })
    const updatedItem = makeItem({ id: 'a', qty: 1, status: 'ready' })
    const events: QueuedOrderEvent[] = [
      { type: 'created', item: createdItem },
      { type: 'updated', item: updatedItem },
    ]
    const result = applyQueuedOrderEvents(base, events)
    expect(result).toEqual([updatedItem])
  })

  it('REST基点由来の未キャンセル注文に cancelled イベントを適用すると status が cancelled になる', () => {
    const base = [makeItem({ id: 'a', qty: 5, status: 'ready' })]
    const events: QueuedOrderEvent[] = [{ type: 'cancelled', id: 'a' }]
    const result = applyQueuedOrderEvents(base, events)
    expect(result[0].status).toBe('cancelled')
    expect(result[0].qty).toBe(5)
  })
})
