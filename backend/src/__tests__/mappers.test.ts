import { toCourse, toDrinkPlan, toGroup, toOrderItem, toStaffSession } from '../lib/mappers.js'

const setting = {
  taxRateInHouse: { toNumber: () => 10 },
  taxRateTakeout: { toNumber: () => 8 },
  taxInclusive: false,
}

describe('toGroup', () => {
  const base = {
    id: 'uuid-group-1',
    name: 'テーブル1',
    guestCount: 3,
    status: 'active',
    sessionId: 10,
    courseId: null,
    drinkPlanId: null,
    billedTaxRateInHouse: null,
    billedTaxRateTakeout: null,
    billedTaxInclusive: null,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    seats: [{ seatId: 2 }, { seatId: 3 }],
  }

  it('Prismaレコードを共有型に変換する', () => {
    expect(toGroup(base, setting)).toEqual({
      id: 'uuid-group-1',
      name: 'テーブル1',
      guestCount: 3,
      seatIds: [2, 3],
      status: 'active',
      sessionId: 10,
      courseId: null,
      drinkPlanId: null,
      effectiveTaxRateInHouse: 10,
      effectiveTaxRateTakeout: 8,
      effectiveTaxInclusive: false,
      createdAt: '2024-01-01T00:00:00.000Z',
    })
  })

  it('seats が空のとき seatIds は []', () => {
    expect(toGroup({ ...base, seats: [] }, setting).seatIds).toEqual([])
  })

  it('billedTax があるときは Setting より優先して実効税率にする', () => {
    expect(
      toGroup(
        {
          ...base,
          billedTaxRateInHouse: { toNumber: () => 12 },
          billedTaxRateTakeout: { toNumber: () => 9 },
          billedTaxInclusive: true,
        },
        setting,
      ),
    ).toMatchObject({
      effectiveTaxRateInHouse: 12,
      effectiveTaxRateTakeout: 9,
      effectiveTaxInclusive: true,
    })
  })
})

describe('toCourse', () => {
  it('Prismaレコードを共有型に変換する', () => {
    const input = {
      id: 5,
      name: 'コースA',
      price: 3000,
      drinkPlanId: 2,
      foodItems: [
        { menuItemId: 10, qty: 1 },
        { menuItemId: 11, qty: 2 },
      ],
    }
    expect(toCourse(input)).toEqual({
      id: 5,
      name: 'コースA',
      price: 3000,
      drinkPlanId: 2,
      foodItems: [
        { menuItemId: 10, qty: 1 },
        { menuItemId: 11, qty: 2 },
      ],
    })
  })
})

describe('toDrinkPlan', () => {
  it('items を menuItemIds に変換する', () => {
    const input = {
      id: 1,
      name: 'ドリンク飲み放題',
      price: 2000,
      items: [{ menuItemId: 7 }, { menuItemId: 8 }],
    }
    expect(toDrinkPlan(input)).toEqual({
      id: 1,
      name: 'ドリンク飲み放題',
      price: 2000,
      menuItemIds: [7, 8],
    })
  })
})

describe('toOrderItem', () => {
  const base = {
    id: 'uuid-order-1',
    groupId: 'uuid-group-1',
    menuItemId: 20,
    menuItemName: 'ビール',
    price: 500,
    qty: 2,
    status: 'pending',
    isTakeout: false,
    courseId: null,
    isCourseCharge: false,
    isDrinkPlanCharge: false,
    orderedAt: new Date('2024-06-01T12:00:00.000Z'),
  }

  it('Prismaレコードを共有型に変換する', () => {
    expect(toOrderItem(base)).toEqual({
      id: 'uuid-order-1',
      groupId: 'uuid-group-1',
      menuItemId: 20,
      menuItemName: 'ビール',
      price: 500,
      qty: 2,
      status: 'pending',
      isTakeout: false,
      courseId: null,
      isCourseCharge: false,
      isDrinkPlanCharge: false,
      orderedAt: '2024-06-01T12:00:00.000Z',
      options: [],
    })
  })

  it('menuItemId が null のとき null のまま変換する', () => {
    expect(toOrderItem({ ...base, menuItemId: null })).toMatchObject({ menuItemId: null })
  })

  it('isCourseCharge を変換する', () => {
    expect(toOrderItem({ ...base, isCourseCharge: true })).toMatchObject({ isCourseCharge: true })
  })

  it('isDrinkPlanCharge を変換する', () => {
    expect(toOrderItem({ ...base, isDrinkPlanCharge: true })).toMatchObject({
      isDrinkPlanCharge: true,
    })
  })
})

describe('toStaffSession', () => {
  it('Prismaレコードを共有型に変換する', () => {
    const input = {
      id: 'uuid-token-1',
      issuedAt: new Date('2024-06-01T12:00:00.000Z'),
      expiresAt: new Date('2024-06-02T12:00:00.000Z'),
      userAgent: 'Mozilla/5.0',
      ipAddress: '127.0.0.1',
    }
    expect(toStaffSession(input)).toEqual({
      id: 'uuid-token-1',
      issuedAt: '2024-06-01T12:00:00.000Z',
      expiresAt: '2024-06-02T12:00:00.000Z',
      userAgent: 'Mozilla/5.0',
      ipAddress: '127.0.0.1',
    })
  })

  it('userAgent / ipAddress が null のとき null のまま変換する', () => {
    expect(
      toStaffSession({
        id: 'uuid-token-2',
        issuedAt: new Date('2024-06-01T12:00:00.000Z'),
        expiresAt: new Date('2024-06-02T12:00:00.000Z'),
        userAgent: null,
        ipAddress: null,
      }),
    ).toMatchObject({ userAgent: null, ipAddress: null })
  })
})
