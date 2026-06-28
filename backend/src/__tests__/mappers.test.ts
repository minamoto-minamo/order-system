import { toGroup, toCourse, toDrinkPlan, toOrderItem } from '../lib/mappers.js'

describe('toGroup', () => {
  const base = {
    id: 'uuid-group-1',
    name: 'テーブル1',
    guestCount: 3,
    status: 'active',
    sessionId: 10,
    courseId: null,
    drinkPlanId: null,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    seats: [{ seatId: 2 }, { seatId: 3 }],
  }

  it('Prismaレコードを共有型に変換する', () => {
    expect(toGroup(base)).toEqual({
      id: 'uuid-group-1',
      name: 'テーブル1',
      guestCount: 3,
      seatIds: [2, 3],
      status: 'active',
      sessionId: 10,
      courseId: null,
      drinkPlanId: null,
      createdAt: '2024-01-01T00:00:00.000Z',
    })
  })

  it('seats が空のとき seatIds は []', () => {
    expect(toGroup({ ...base, seats: [] }).seatIds).toEqual([])
  })
})

describe('toCourse', () => {
  it('Prismaレコードを共有型に変換する', () => {
    const input = {
      id: 5,
      name: 'コースA',
      price: 3000,
      drinkPlanId: 2,
      foodItems: [{ menuItemId: 10, qty: 1 }, { menuItemId: 11, qty: 2 }],
    }
    expect(toCourse(input)).toEqual({
      id: 5,
      name: 'コースA',
      price: 3000,
      drinkPlanId: 2,
      foodItems: [{ menuItemId: 10, qty: 1 }, { menuItemId: 11, qty: 2 }],
    })
  })
})

describe('toDrinkPlan', () => {
  it('items を menuItemIds に変換する', () => {
    const input = { id: 1, name: 'ドリンク飲み放題', items: [{ menuItemId: 7 }, { menuItemId: 8 }] }
    expect(toDrinkPlan(input)).toEqual({ id: 1, name: 'ドリンク飲み放題', menuItemIds: [7, 8] })
  })
})

describe('toOrderItem', () => {
  it('Prismaレコードを共有型に変換する', () => {
    const input = {
      id: 'uuid-order-1',
      groupId: 'uuid-group-1',
      menuItemId: 20,
      menuItemName: 'ビール',
      price: 500,
      qty: 2,
      status: 'pending',
      isTakeout: false,
      taxRate: { toNumber: () => 10 },
      courseId: null,
      orderedAt: new Date('2024-06-01T12:00:00.000Z'),
    }
    expect(toOrderItem(input)).toEqual({
      id: 'uuid-order-1',
      groupId: 'uuid-group-1',
      menuItemId: 20,
      menuItemName: 'ビール',
      price: 500,
      qty: 2,
      status: 'pending',
      isTakeout: false,
      taxRate: 10,
      courseId: null,
      orderedAt: '2024-06-01T12:00:00.000Z',
    })
  })
})
