import { buildDisplay } from '../pages/kitchen/Kitchen/components/utils'
import type { OrderItem, Group, Seat, MenuItem } from '@order-system/shared'

const seats: Seat[] = [
  { id: 1, label: 'A1', type: 'counter', x: 0, y: 0, tableId: null },
  { id: 2, label: 'A2', type: 'counter', x: 1, y: 0, tableId: null },
]

const groups: Group[] = [{
  id: 'uuid-group-1', name: 'G1', guestCount: 2, seatIds: [1, 2], sessionId: 1,
  courseId: null, drinkPlanId: null, createdAt: '2024-01-01T00:00:00.000Z',
  status: 'active',
}]

const menus = [
  { id: 10, categoryId: 3, subCategoryId: 7 },
] as MenuItem[]

const order: OrderItem = {
  id: 'uuid-order-1', groupId: 'uuid-group-1', menuItemId: 10, menuItemName: '枝豆',
  price: 300, qty: 2, status: 'pending', isTakeout: false, taxRate: 10, taxInclusive: false,
  courseId: null, isCourseCharge: false, isDrinkPlanCharge: false,
  orderedAt: '2024-01-01T10:00:00.000Z',
}

const getGroupName = (id: string) => `不明(${id})`

describe('buildDisplay', () => {
  it('グループ名・席ラベル・カテゴリIDを解決する', () => {
    const d = buildDisplay(order, menus, groups, seats, getGroupName)
    expect(d).toEqual({
      id: 'uuid-order-1', groupId: 'uuid-group-1', groupName: 'G1',
      seats: 'A1・A2', item: '枝豆', qty: 2, catId: 3, subId: 7,
      orderedAt: '2024-01-01T10:00:00.000Z', status: 'pending',
    })
  })

  it('グループが見つからないときは getGroupName の結果を使い席は空文字', () => {
    const d = buildDisplay({ ...order, groupId: 'uuid-gone' }, menus, groups, seats, getGroupName)
    expect(d.groupName).toBe('不明(uuid-gone)')
    expect(d.seats).toBe('')
  })

  it('メニューが見つからないときはカテゴリIDを0にする', () => {
    const d = buildDisplay({ ...order, menuItemId: 999 }, menus, groups, seats, getGroupName)
    expect(d.catId).toBe(0)
    expect(d.subId).toBe(0)
  })
})
