import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'

type Group = { id: string; status: string; courseId: number | null; drinkPlanId: number | null }
type Course = { id: number; name: string; price: number; drinkPlanId: number | null; foodItems: { menuItemId: number; qty: number }[] }
type DrinkPlan = { id: number; name: string; price: number }

const mockGroupFindFirst  = jest.fn<(...args: unknown[]) => Promise<Group | null>>()
const mockCourseFindFirst = jest.fn<(...args: unknown[]) => Promise<Course | null>>()
const mockDrinkPlanFindFirst = jest.fn<(...args: unknown[]) => Promise<DrinkPlan | null>>()
const mockSettingFindUnique = jest.fn<(...args: unknown[]) => Promise<{ taxRateInHouse: { toNumber(): number }; taxRateTakeout: { toNumber(): number }; taxInclusive: boolean } | null>>()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockTransaction = jest.fn<(cb: (tx: any) => Promise<any>) => Promise<any>>()

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    group:     { findFirst: mockGroupFindFirst },
    course:    { findFirst: mockCourseFindFirst },
    drinkPlan: { findFirst: mockDrinkPlanFindFirst },
    setting:   { findUnique: mockSettingFindUnique },
    $transaction: mockTransaction,
  },
}))

const { default: groupsRoutes } = await import('../routes/groups.js')

const SECRET   = 'test-secret'
const ADMIN_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const GROUP_ID = 'gggggggg-gggg-gggg-gggg-gggggggggggg'
const STORE_ID = 1

async function buildTestApp() {
  const app = Fastify({ logger: false })
  app.decorateRequest('storeId', 0)
  app.addHook('onRequest', async (request) => { request.storeId = STORE_ID })
  await app.register(cookie)
  await app.register(jwt, { secret: SECRET, cookie: { cookieName: 'token', signed: false } })
  app.addHook('preHandler', async (request, reply) => {
    try { await request.jwtVerify() }
    catch { reply.status(401).send({ error: { code: 'auth.session.required', message: '認証が必要です', details: null } }) }
  })
  // io.emit のスタブ（型チェックを回避するため any でキャスト）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockIo: any = { emit: jest.fn() }
  mockIo.to = () => mockIo
  app.decorate('io', mockIo)
  await app.register(groupsRoutes, { prefix: '/api/groups' })
  await app.ready()
  return app
}

function token(app: Awaited<ReturnType<typeof buildTestApp>>) {
  return app.jwt.sign({ type: 'staff' as const, userId: ADMIN_ID, username: 'admin', role: 'admin', storeId: STORE_ID })
}

describe('POST /api/groups/:id/course — コース適用', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  beforeAll(async () => { app = await buildTestApp() })
  afterAll(async () => { await app.close() })
  beforeEach(() => {
    jest.clearAllMocks()
    mockSettingFindUnique.mockResolvedValue({
      taxRateInHouse: { toNumber: () => 10 },
      taxRateTakeout: { toNumber: () => 8 },
      taxInclusive: false,
    })
  })

  it('グループが存在しない場合 404 を返す', async () => {
    mockGroupFindFirst.mockResolvedValue(null)
    const res = await app.inject({
      method: 'POST', url: `/api/groups/${GROUP_ID}/course`,
      headers: { cookie: `token=${token(app)}` },
      payload: { courseId: 1, qty: 2 },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ error: { message: 'グループが見つかりません' } })
  })

  it('グループが active でない場合 409 を返す', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'bill_requested', courseId: null, drinkPlanId: null })
    const res = await app.inject({
      method: 'POST', url: `/api/groups/${GROUP_ID}/course`,
      headers: { cookie: `token=${token(app)}` },
      payload: { courseId: 1, qty: 2 },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: { message: 'このグループにはコースを適用できません' } })
  })

  it('コースが存在しない場合 404 を返す', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', courseId: null, drinkPlanId: null })
    mockCourseFindFirst.mockResolvedValue(null)
    const res = await app.inject({
      method: 'POST', url: `/api/groups/${GROUP_ID}/course`,
      headers: { cookie: `token=${token(app)}` },
      payload: { courseId: 999, qty: 2 },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ error: { message: 'コースが見つかりません' } })
  })

  it('food items なしのコースを適用すると group が更新され 200 を返す', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', courseId: null, drinkPlanId: null })
    mockCourseFindFirst.mockResolvedValue({ id: 1, name: 'ランチ', price: 0, drinkPlanId: null, foodItems: [] })
    const updatedGroup = { id: GROUP_ID, name: 'A席', guestCount: 2, status: 'active', sessionId: 1, courseId: 1, drinkPlanId: null, createdAt: new Date(), seats: [] as { seatId: number }[] }
    const mockOrderItemCreate = jest.fn<() => Promise<unknown>>().mockResolvedValue({})
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        menuItem: { findMany: () => Promise.resolve([]) },
        orderItem: { create: mockOrderItemCreate },
        group: { findUnique: () => Promise.resolve({ id: GROUP_ID, status: 'active' }), update: () => Promise.resolve(updatedGroup) },
      }
      return cb(tx)
    })
    const res = await app.inject({
      method: 'POST', url: `/api/groups/${GROUP_ID}/course`,
      headers: { cookie: `token=${token(app)}` },
      payload: { courseId: 1, qty: 2 },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ id: GROUP_ID, courseId: 1 })
    expect(mockOrderItemCreate).not.toHaveBeenCalled()
  })

  it('course.price > 0 のコースを適用するとコース料金 OrderItem が作成される', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', courseId: null, drinkPlanId: null })
    mockCourseFindFirst.mockResolvedValue({ id: 1, name: 'ディナーコース', price: 3000, drinkPlanId: null, foodItems: [] })
    mockSettingFindUnique.mockResolvedValue({ taxRateInHouse: { toNumber: () => 10 }, taxRateTakeout: { toNumber: () => 8 }, taxInclusive: false })
    const updatedGroup = { id: GROUP_ID, name: 'A席', guestCount: 3, status: 'active', sessionId: 1, courseId: 1, drinkPlanId: null, createdAt: new Date(), seats: [] as { seatId: number }[] }
    const chargeItem = { id: 'item-1', groupId: GROUP_ID, menuItemId: null, menuItemName: 'ディナーコース', price: 3000, qty: 2, status: 'pending', isTakeout: false, taxRate: { toNumber: () => 10 }, courseId: 1, orderedAt: new Date() }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockOrderItemCreate = jest.fn<any>().mockResolvedValue(chargeItem)
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        menuItem: { findMany: () => Promise.resolve([]) },
        orderItem: { create: mockOrderItemCreate },
        group: { findUnique: () => Promise.resolve({ id: GROUP_ID, status: 'active' }), update: () => Promise.resolve(updatedGroup) },
      }
      return cb(tx)
    })
    const res = await app.inject({
      method: 'POST', url: `/api/groups/${GROUP_ID}/course`,
      headers: { cookie: `token=${token(app)}` },
      payload: { courseId: 1, qty: 2 },
    })
    expect(res.statusCode).toBe(200)
    expect(mockOrderItemCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        groupId: GROUP_ID,
        menuItemId: null,
        menuItemName: 'ディナーコース',
        price: 3000,
        qty: 2,
        status: 'served',
        courseId: 1,
        isCourseCharge: true,
        isDrinkPlanCharge: false,
      }),
    }))
  })

  it('drinkPlan.price > 0 のコースを適用すると人数に関わらず1回だけ定額課金される', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', courseId: null, drinkPlanId: null })
    mockCourseFindFirst.mockResolvedValue({ id: 1, name: 'ディナーコース', price: 0, drinkPlanId: 5, foodItems: [] })
    mockDrinkPlanFindFirst.mockResolvedValue({ id: 5, name: '飲み放題プラン', price: 2000 })
    mockSettingFindUnique.mockResolvedValue({ taxRateInHouse: { toNumber: () => 10 }, taxRateTakeout: { toNumber: () => 8 }, taxInclusive: false })
    const updatedGroup = { id: GROUP_ID, name: 'A席', guestCount: 4, status: 'active', sessionId: 1, courseId: 1, drinkPlanId: 5, createdAt: new Date(), seats: [] as { seatId: number }[] }
    const chargeItem = { id: 'item-2', groupId: GROUP_ID, menuItemId: null, menuItemName: '飲み放題プラン', price: 2000, qty: 1, status: 'pending', isTakeout: false, taxRate: { toNumber: () => 10 }, courseId: 1, orderedAt: new Date() }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockOrderItemCreate = jest.fn<any>().mockResolvedValue(chargeItem)
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        menuItem: { findMany: () => Promise.resolve([]) },
        orderItem: { create: mockOrderItemCreate },
        drinkPlanItem: { findMany: () => Promise.resolve([]) },
        group: { findUnique: () => Promise.resolve({ id: GROUP_ID, status: 'active' }), update: () => Promise.resolve(updatedGroup) },
      }
      return cb(tx)
    })
    const res = await app.inject({
      method: 'POST', url: `/api/groups/${GROUP_ID}/course`,
      headers: { cookie: `token=${token(app)}` },
      payload: { courseId: 1, qty: 4 },
    })
    expect(res.statusCode).toBe(200)
    expect(mockOrderItemCreate).toHaveBeenCalledTimes(1)
    expect(mockOrderItemCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        groupId: GROUP_ID,
        menuItemId: null,
        menuItemName: '飲み放題プラン',
        price: 2000,
        qty: 1,
        status: 'served',
        courseId: 1,
        isCourseCharge: true,
        isDrinkPlanCharge: true,
      }),
    }))
  })

  it('foodItems ありのコースを適用すると個別の料理は 0 円で登録される', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', courseId: null, drinkPlanId: null })
    mockCourseFindFirst.mockResolvedValue({
      id: 1, name: 'コースA', price: 0, drinkPlanId: null,
      foodItems: [{ menuItemId: 10, qty: 2 }],
    })
    mockSettingFindUnique.mockResolvedValue({ taxRateInHouse: { toNumber: () => 10 }, taxRateTakeout: { toNumber: () => 8 }, taxInclusive: false })
    const updatedGroup = { id: GROUP_ID, name: 'A席', guestCount: 3, status: 'active', sessionId: 1, courseId: 1, drinkPlanId: null, createdAt: new Date(), seats: [] as { seatId: number }[] }
    const foodOrderItem = { id: 'item-food', groupId: GROUP_ID, menuItemId: 10, menuItemName: '唐揚げ', price: 0, qty: 6, status: 'pending', isTakeout: false, taxRate: { toNumber: () => 10 }, courseId: 1, orderedAt: new Date() }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockOrderItemCreate = jest.fn<any>().mockResolvedValue(foodOrderItem)
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        menuItem: { findMany: () => Promise.resolve([{ id: 10, name: '唐揚げ', price: 500, soldOut: false }]) },
        orderItem: { create: mockOrderItemCreate },
        drinkPlanItem: { findMany: () => Promise.resolve([]) },
        group: { findUnique: () => Promise.resolve({ id: GROUP_ID, status: 'active' }), update: () => Promise.resolve(updatedGroup) },
      }
      return cb(tx)
    })
    const res = await app.inject({
      method: 'POST', url: `/api/groups/${GROUP_ID}/course`,
      headers: { cookie: `token=${token(app)}` },
      payload: { courseId: 1, qty: 3 },
    })
    expect(res.statusCode).toBe(200)
    expect(mockOrderItemCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        menuItemId: 10,
        menuItemName: '唐揚げ',
        price: 0,
        originalPrice: 500,
        qty: 6,
        courseId: 1,
      }),
    }))
  })

  it('飲み放題プランを適用すると既存の対象商品の注文も遡って 0 円になり、originalPrice は書き換えない', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', courseId: null, drinkPlanId: null })
    mockCourseFindFirst.mockResolvedValue({ id: 1, name: 'ディナーコース', price: 0, drinkPlanId: 5, foodItems: [] })
    mockDrinkPlanFindFirst.mockResolvedValue({ id: 5, name: '飲み放題プラン', price: 0 })
    mockSettingFindUnique.mockResolvedValue({ taxRateInHouse: { toNumber: () => 10 }, taxRateTakeout: { toNumber: () => 8 }, taxInclusive: false })
    const updatedGroup = { id: GROUP_ID, name: 'A席', guestCount: 2, status: 'active', sessionId: 1, courseId: 1, drinkPlanId: 5, createdAt: new Date(), seats: [] as { seatId: number }[] }
    const existingItem = { id: 'existing-1', groupId: GROUP_ID, menuItemId: 20, menuItemName: 'ビール', price: 500, qty: 1, status: 'pending', isTakeout: false, taxRate: { toNumber: () => 10 }, courseId: null, orderedAt: new Date() }
    const mockOrderItemUpdateInTx = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({ ...existingItem, price: 0 })
    const mockOrderItemFindMany = jest.fn<(...args: unknown[]) => Promise<unknown[]>>().mockResolvedValue([existingItem])
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        menuItem: { findMany: () => Promise.resolve([]) },
        orderItem: { create: jest.fn(), update: mockOrderItemUpdateInTx, findMany: mockOrderItemFindMany },
        drinkPlanItem: { findMany: () => Promise.resolve([{ menuItemId: 20 }]) },
        group: { findUnique: () => Promise.resolve({ id: GROUP_ID, status: 'active' }), update: () => Promise.resolve(updatedGroup) },
      }
      return cb(tx)
    })
    const res = await app.inject({
      method: 'POST', url: `/api/groups/${GROUP_ID}/course`,
      headers: { cookie: `token=${token(app)}` },
      payload: { courseId: 1, qty: 2 },
    })
    expect(res.statusCode).toBe(200)
    expect(mockOrderItemFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ groupId: GROUP_ID, menuItemId: { in: [20] } }),
    }))
    expect(mockOrderItemUpdateInTx).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'existing-1' },
      data: { price: 0 },
    }))
  })

  it('既にコースが適用されている場合、旧コースの課金明細を取消してから新コースを適用する（二重課金防止）', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', courseId: 1, drinkPlanId: 5 })
    mockCourseFindFirst.mockResolvedValue({ id: 2, name: '新コース', price: 4000, drinkPlanId: null, foodItems: [] })
    mockSettingFindUnique.mockResolvedValue({ taxRateInHouse: { toNumber: () => 10 }, taxRateTakeout: { toNumber: () => 8 }, taxInclusive: false })
    const updatedGroup = { id: GROUP_ID, name: 'A席', guestCount: 2, status: 'active', sessionId: 1, courseId: 2, drinkPlanId: null, createdAt: new Date(), seats: [] as { seatId: number }[] }
    const oldChargeItem = { id: 'old-charge', groupId: GROUP_ID, menuItemId: null, menuItemName: '旧コース', price: 3000, qty: 2, status: 'served', isTakeout: false, taxRate: { toNumber: () => 10 }, courseId: 1, isCourseCharge: true, isDrinkPlanCharge: false, orderedAt: new Date() }
    const drinkItem = { id: 'drink-1', groupId: GROUP_ID, menuItemId: 20, menuItemName: 'ビール', price: 0, originalPrice: 500, qty: 1, status: 'pending', isTakeout: false, taxRate: { toNumber: () => 10 }, courseId: null, orderedAt: new Date() }
    const mockOrderItemUpdateInTx = jest.fn<(...args: unknown[]) => Promise<unknown>>()
      .mockImplementation(async (args: any) =>
        args.where.id === 'old-charge' ? { ...oldChargeItem, status: 'cancelled' } : { ...drinkItem, price: 500 })
    const mockNewChargeItem = { id: 'new-charge', groupId: GROUP_ID, menuItemId: null, menuItemName: '新コース', price: 4000, qty: 2, status: 'served', isTakeout: false, taxRate: { toNumber: () => 10 }, courseId: 2, isCourseCharge: true, isDrinkPlanCharge: false, orderedAt: new Date() }
    const mockOrderItemCreate = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(mockNewChargeItem)
    const mockOrderItemFindMany = jest.fn<(...args: unknown[]) => Promise<unknown[]>>()
      .mockImplementation(async (args: any) =>
        'courseId' in args.where ? [oldChargeItem] : [drinkItem])
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        menuItem: { findMany: () => Promise.resolve([{ id: 20, name: 'ビール', price: 500 }]) },
        drinkPlanItem: { findMany: () => Promise.resolve([{ menuItemId: 20 }]) },
        orderItem: {
          create: mockOrderItemCreate,
          update: mockOrderItemUpdateInTx,
          findMany: mockOrderItemFindMany,
        },
        group: { findUnique: () => Promise.resolve({ id: GROUP_ID, status: 'active', courseId: 1, drinkPlanId: 5 }), update: () => Promise.resolve(updatedGroup) },
      }
      return cb(tx)
    })
    const res = await app.inject({
      method: 'POST', url: `/api/groups/${GROUP_ID}/course`,
      headers: { cookie: `token=${token(app)}` },
      payload: { courseId: 2, qty: 2 },
    })
    expect(res.statusCode).toBe(200)
    expect(mockOrderItemUpdateInTx).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'old-charge' },
      data: { status: 'cancelled' },
    }))
    expect(mockOrderItemUpdateInTx).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'drink-1' },
      data: { price: 500 },
    }))
    expect(mockOrderItemCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ menuItemName: '新コース', price: 4000, courseId: 2 }),
    }))
  })

  it('旧コースの食事明細（isCourseCharge:false）も切替時にキャンセルされる（重複蓄積防止）', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', courseId: 1, drinkPlanId: null })
    mockCourseFindFirst.mockResolvedValue({ id: 2, name: '新コース', price: 4000, drinkPlanId: null, foodItems: [] })
    mockSettingFindUnique.mockResolvedValue({ taxRateInHouse: { toNumber: () => 10 }, taxRateTakeout: { toNumber: () => 8 }, taxInclusive: false })
    const updatedGroup = { id: GROUP_ID, name: 'A席', guestCount: 2, status: 'active', sessionId: 1, courseId: 2, drinkPlanId: null, createdAt: new Date(), seats: [] as { seatId: number }[] }
    const oldChargeItem = { id: 'old-charge', groupId: GROUP_ID, menuItemId: null, menuItemName: '旧コース', price: 3000, qty: 2, status: 'served', isTakeout: false, taxRate: { toNumber: () => 10 }, courseId: 1, isCourseCharge: true, isDrinkPlanCharge: false, orderedAt: new Date() }
    const oldFoodItem = { id: 'old-food', groupId: GROUP_ID, menuItemId: 10, menuItemName: '唐揚げ', price: 0, qty: 4, status: 'served', isTakeout: false, taxRate: { toNumber: () => 10 }, courseId: 1, isCourseCharge: false, isDrinkPlanCharge: false, orderedAt: new Date() }
    const mockOrderItemUpdateInTx = jest.fn<(...args: unknown[]) => Promise<unknown>>()
      .mockImplementation(async (args: any) => ({
        ...(args.where.id === 'old-charge' ? oldChargeItem : oldFoodItem),
        status: 'cancelled',
      }))
    const mockNewChargeItem = { id: 'new-charge', groupId: GROUP_ID, menuItemId: null, menuItemName: '新コース', price: 4000, qty: 2, status: 'served', isTakeout: false, taxRate: { toNumber: () => 10 }, courseId: 2, isCourseCharge: true, isDrinkPlanCharge: false, orderedAt: new Date() }
    const mockOrderItemCreate = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(mockNewChargeItem)
    const mockOrderItemFindMany = jest.fn<(...args: unknown[]) => Promise<unknown[]>>()
      .mockResolvedValue([oldChargeItem, oldFoodItem])
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        menuItem: { findMany: () => Promise.resolve([]) },
        orderItem: {
          create: mockOrderItemCreate,
          update: mockOrderItemUpdateInTx,
          findMany: mockOrderItemFindMany,
        },
        group: { findUnique: () => Promise.resolve({ id: GROUP_ID, status: 'active', courseId: 1, drinkPlanId: null }), update: () => Promise.resolve(updatedGroup) },
      }
      return cb(tx)
    })
    const res = await app.inject({
      method: 'POST', url: `/api/groups/${GROUP_ID}/course`,
      headers: { cookie: `token=${token(app)}` },
      payload: { courseId: 2, qty: 2 },
    })
    expect(res.statusCode).toBe(200)
    expect(mockOrderItemFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ groupId: GROUP_ID, courseId: 1 }),
    }))
    expect(mockOrderItemUpdateInTx).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'old-charge' },
      data: { status: 'cancelled' },
    }))
    expect(mockOrderItemUpdateInTx).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'old-food' },
      data: { status: 'cancelled' },
    }))
  })
})

describe('DELETE /api/groups/:id/course — コース解除', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  beforeAll(async () => { app = await buildTestApp() })
  afterAll(async () => { await app.close() })
  beforeEach(() => { jest.clearAllMocks() })

  it('存在するグループのコースを解除すると 200 を返す', async () => {
    const clearedGroup = { id: GROUP_ID, name: 'A席', guestCount: 2, status: 'active', sessionId: 1, courseId: null, drinkPlanId: null, createdAt: new Date(), seats: [] as { seatId: number }[] }
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', courseId: 1, drinkPlanId: null })
    const mockTxGroupUpdate = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(clearedGroup)
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        orderItem: { findMany: () => Promise.resolve([]) },
        group: { findUnique: () => Promise.resolve({ id: GROUP_ID, status: 'active', courseId: 1, drinkPlanId: null }), update: mockTxGroupUpdate },
      }
      return cb(tx)
    })
    const res = await app.inject({
      method: 'DELETE', url: `/api/groups/${GROUP_ID}/course`,
      headers: { cookie: `token=${token(app)}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ courseId: null, drinkPlanId: null })
    expect(mockTxGroupUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: GROUP_ID },
      data: { courseId: null, drinkPlanId: null },
    }))
  })

  it('コースを解除するとコース料金・飲み放題料金の定額課金明細が取消済みになる', async () => {
    const clearedGroup = { id: GROUP_ID, name: 'A席', guestCount: 2, status: 'active', sessionId: 1, courseId: null, drinkPlanId: null, createdAt: new Date(), seats: [] as { seatId: number }[] }
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', courseId: 1, drinkPlanId: null })
    const courseChargeItem = { id: 'charge-1', groupId: GROUP_ID, menuItemId: null, menuItemName: 'Aコース', price: 3000, qty: 2, status: 'served', isTakeout: false, taxRate: { toNumber: () => 10 }, courseId: 1, isCourseCharge: true, isDrinkPlanCharge: false, orderedAt: new Date() }
    const drinkPlanChargeItem = { id: 'charge-2', groupId: GROUP_ID, menuItemId: null, menuItemName: '飲み放題', price: 2000, qty: 1, status: 'served', isTakeout: false, taxRate: { toNumber: () => 10 }, courseId: 1, isCourseCharge: true, isDrinkPlanCharge: true, orderedAt: new Date() }
    const mockOrderItemUpdateInTx = jest.fn<(...args: unknown[]) => Promise<unknown>>()
      .mockImplementation(async (args: any) => ({
        ...(args.where.id === 'charge-1' ? courseChargeItem : drinkPlanChargeItem),
        status: 'cancelled',
      }))
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        orderItem: { findMany: () => Promise.resolve([courseChargeItem, drinkPlanChargeItem]), update: mockOrderItemUpdateInTx },
        group: { findUnique: () => Promise.resolve({ id: GROUP_ID, status: 'active', courseId: 1, drinkPlanId: null }), update: () => Promise.resolve(clearedGroup) },
      }
      return cb(tx)
    })
    const res = await app.inject({
      method: 'DELETE', url: `/api/groups/${GROUP_ID}/course`,
      headers: { cookie: `token=${token(app)}` },
    })
    expect(res.statusCode).toBe(200)
    expect(mockOrderItemUpdateInTx).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'charge-1' },
      data: { status: 'cancelled' },
    }))
    expect(mockOrderItemUpdateInTx).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'charge-2' },
      data: { status: 'cancelled' },
    }))
  })

  it('存在しないグループに対して 404 を返す', async () => {
    mockGroupFindFirst.mockResolvedValue(null)
    const res = await app.inject({
      method: 'DELETE', url: `/api/groups/nonexistent/course`,
      headers: { cookie: `token=${token(app)}` },
    })
    expect(res.statusCode).toBe(404)
    expect(mockTransaction).not.toHaveBeenCalled()
    expect(res.json()).toMatchObject({ error: { message: 'グループが見つかりません' } })
  })

  it('グループが active でない場合 409 を返す（会計後のコース解除を防ぐ）', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'bill_requested', courseId: 1, drinkPlanId: null })
    const res = await app.inject({
      method: 'DELETE', url: `/api/groups/${GROUP_ID}/course`,
      headers: { cookie: `token=${token(app)}` },
    })
    expect(res.statusCode).toBe(409)
    expect(mockTransaction).not.toHaveBeenCalled()
    expect(res.json()).toMatchObject({ error: { message: 'このグループのコースは解除できません' } })
  })

  it('事前チェック後・トランザクション内で active でなくなっていた場合も 409 を返す', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', courseId: 1, drinkPlanId: null })
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        orderItem: { findMany: () => Promise.resolve([]) },
        group: { findUnique: () => Promise.resolve({ id: GROUP_ID, status: 'bill_requested', courseId: 1, drinkPlanId: null }), update: jest.fn() },
      }
      return cb(tx)
    })
    const res = await app.inject({
      method: 'DELETE', url: `/api/groups/${GROUP_ID}/course`,
      headers: { cookie: `token=${token(app)}` },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: { message: 'このグループのコースは解除できません' } })
  })

  it('飲み放題プランを解除すると対象商品の価格が originalPrice（注文時点の価格スナップショット）に復元される', async () => {
    const clearedGroup = { id: GROUP_ID, name: 'A席', guestCount: 2, status: 'active', sessionId: 1, courseId: null, drinkPlanId: null, createdAt: new Date(), seats: [] as { seatId: number }[] }
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', courseId: 1, drinkPlanId: 5 })
    const restoredItem = { id: 'existing-1', groupId: GROUP_ID, menuItemId: 20, menuItemName: 'ビール', price: 500, originalPrice: 500, qty: 1, status: 'pending', isTakeout: false, taxRate: { toNumber: () => 10 }, courseId: null, orderedAt: new Date() }
    // originalPrice は注文時点の価格スナップショット（現在のメニュー価格とは独立）
    const targetItem = { id: 'existing-1', groupId: GROUP_ID, menuItemId: 20, price: 0, originalPrice: 500 }
    const mockOrderItemUpdateInTx = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(restoredItem)
    const mockOrderItemFindManyInTx = jest.fn<(...args: unknown[]) => Promise<unknown[]>>()
      .mockResolvedValueOnce([targetItem])
      .mockResolvedValueOnce([])
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        drinkPlanItem: { findMany: () => Promise.resolve([{ menuItemId: 20 }]) },
        orderItem: { findMany: mockOrderItemFindManyInTx, update: mockOrderItemUpdateInTx },
        group: { findUnique: () => Promise.resolve({ id: GROUP_ID, status: 'active', courseId: 1, drinkPlanId: 5 }), update: () => Promise.resolve(clearedGroup) },
      }
      return cb(tx)
    })
    const res = await app.inject({
      method: 'DELETE', url: `/api/groups/${GROUP_ID}/course`,
      headers: { cookie: `token=${token(app)}` },
    })
    expect(res.statusCode).toBe(200)
    expect(mockOrderItemUpdateInTx).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'existing-1' },
      data: { price: 500 },
    }))
  })

  it('飲み放題プラン解除時、メニュー価格が改定されていても注文時点の originalPrice で復元される（現在価格に引きずられない）', async () => {
    const clearedGroup = { id: GROUP_ID, name: 'A席', guestCount: 2, status: 'active', sessionId: 1, courseId: null, drinkPlanId: null, createdAt: new Date(), seats: [] as { seatId: number }[] }
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', courseId: 1, drinkPlanId: 5 })
    // 注文時点は500円だったが、その後メニュー価格が600円に改定されたケース
    const targetItem = { id: 'existing-1', groupId: GROUP_ID, menuItemId: 20, price: 0, originalPrice: 500 }
    const restoredItem = { id: 'existing-1', groupId: GROUP_ID, menuItemId: 20, menuItemName: 'ビール', price: 500, originalPrice: 500, qty: 1, status: 'pending', isTakeout: false, taxRate: { toNumber: () => 10 }, courseId: null, orderedAt: new Date() }
    const mockOrderItemUpdateInTx = jest.fn<(...args: unknown[]) => Promise<unknown>>()
      .mockResolvedValue(restoredItem)
    const mockOrderItemFindManyInTx = jest.fn<(...args: unknown[]) => Promise<unknown[]>>()
      .mockResolvedValueOnce([targetItem])
      .mockResolvedValueOnce([])
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        drinkPlanItem: { findMany: () => Promise.resolve([{ menuItemId: 20 }]) },
        orderItem: { findMany: mockOrderItemFindManyInTx, update: mockOrderItemUpdateInTx },
        group: { findUnique: () => Promise.resolve({ id: GROUP_ID, status: 'active', courseId: 1, drinkPlanId: 5 }), update: () => Promise.resolve(clearedGroup) },
      }
      return cb(tx)
    })
    const res = await app.inject({
      method: 'DELETE', url: `/api/groups/${GROUP_ID}/course`,
      headers: { cookie: `token=${token(app)}` },
    })
    expect(res.statusCode).toBe(200)
    // 復元額は現在のメニュー価格(600円)ではなく originalPrice(500円)
    expect(mockOrderItemUpdateInTx).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'existing-1' },
      data: { price: 500 },
    }))
  })
})

describe('PUT /api/groups/:id/course — コース人数変更', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  beforeAll(async () => { app = await buildTestApp() })
  afterAll(async () => { await app.close() })
  beforeEach(() => { jest.clearAllMocks() })

  it('グループが存在しない場合 404 を返す', async () => {
    mockGroupFindFirst.mockResolvedValue(null)
    const res = await app.inject({
      method: 'PUT', url: `/api/groups/${GROUP_ID}/course`,
      headers: { cookie: `token=${token(app)}` },
      payload: { qty: 3 },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ error: { message: 'グループが見つかりません' } })
  })

  it('グループが active でない場合 409 を返す', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'bill_requested', courseId: 1, drinkPlanId: null })
    const res = await app.inject({
      method: 'PUT', url: `/api/groups/${GROUP_ID}/course`,
      headers: { cookie: `token=${token(app)}` },
      payload: { qty: 3 },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: { message: 'このグループのコース人数は変更できません' } })
  })

  it('コースが適用されていない場合 409 を返す', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', courseId: null, drinkPlanId: null })
    const res = await app.inject({
      method: 'PUT', url: `/api/groups/${GROUP_ID}/course`,
      headers: { cookie: `token=${token(app)}` },
      payload: { qty: 3 },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: { message: 'コースが適用されていません' } })
  })

  it('コース料金明細が存在する場合 qty を更新して返す', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', courseId: 1, drinkPlanId: null })
    mockCourseFindFirst.mockResolvedValue({ id: 1, name: 'ディナーコース', price: 3000, drinkPlanId: null, foodItems: [] })
    const chargeItem = { id: 'item-1', groupId: GROUP_ID, menuItemId: null, menuItemName: 'ディナーコース', price: 3000, qty: 2, status: 'served', isTakeout: false, taxRate: { toNumber: () => 10 }, courseId: 1, isCourseCharge: true, isDrinkPlanCharge: false, orderedAt: new Date() }
    const updatedChargeItem = { ...chargeItem, qty: 5 }
    const mockOrderItemFindFirstInTx = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(chargeItem)
    const mockOrderItemUpdateInTx = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(updatedChargeItem)
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        group: { findUnique: () => Promise.resolve({ id: GROUP_ID, status: 'active', courseId: 1, drinkPlanId: null }) },
        orderItem: { findFirst: mockOrderItemFindFirstInTx, update: mockOrderItemUpdateInTx, findMany: jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]) },
      }
      return cb(tx)
    })
    const res = await app.inject({
      method: 'PUT', url: `/api/groups/${GROUP_ID}/course`,
      headers: { cookie: `token=${token(app)}` },
      payload: { qty: 5 },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ qty: 5 })
    expect(mockOrderItemFindFirstInTx).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ isCourseCharge: true, isDrinkPlanCharge: false, courseId: 1 }),
    }))
    expect(mockOrderItemUpdateInTx).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'item-1' },
      data: { qty: 5 },
    }))
  })

  it('コース料金明細が存在しない(course.price === 0)場合 204 を返す', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', courseId: 1, drinkPlanId: null })
    mockCourseFindFirst.mockResolvedValue({ id: 1, name: 'ランチ', price: 0, drinkPlanId: null, foodItems: [] })
    const mockOrderItemUpdateInTx = jest.fn<(...args: unknown[]) => Promise<unknown>>()
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        group: { findUnique: () => Promise.resolve({ id: GROUP_ID, status: 'active', courseId: 1, drinkPlanId: null }) },
        orderItem: { findFirst: () => Promise.resolve(null), update: mockOrderItemUpdateInTx, findMany: jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]) },
      }
      return cb(tx)
    })
    const res = await app.inject({
      method: 'PUT', url: `/api/groups/${GROUP_ID}/course`,
      headers: { cookie: `token=${token(app)}` },
      payload: { qty: 5 },
    })
    expect(res.statusCode).toBe(204)
    expect(mockOrderItemUpdateInTx).not.toHaveBeenCalled()
  })

  it('飲み放題プランの定額課金明細は qty 変更の対象にならない', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', courseId: 1, drinkPlanId: 5 })
    mockCourseFindFirst.mockResolvedValue({ id: 1, name: 'ディナーコース', price: 0, drinkPlanId: 5, foodItems: [] })
    const mockOrderItemFindFirstInTx = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(null)
    const mockOrderItemUpdateInTx = jest.fn<(...args: unknown[]) => Promise<unknown>>()
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        group: { findUnique: () => Promise.resolve({ id: GROUP_ID, status: 'active', courseId: 1, drinkPlanId: 5 }) },
        orderItem: { findFirst: mockOrderItemFindFirstInTx, update: mockOrderItemUpdateInTx, findMany: jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]) },
      }
      return cb(tx)
    })
    const res = await app.inject({
      method: 'PUT', url: `/api/groups/${GROUP_ID}/course`,
      headers: { cookie: `token=${token(app)}` },
      payload: { qty: 5 },
    })
    expect(res.statusCode).toBe(204)
    expect(mockOrderItemFindFirstInTx).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ isDrinkPlanCharge: false }),
    }))
    expect(mockOrderItemUpdateInTx).not.toHaveBeenCalled()
  })

  it('foodItems ありのコースで人数変更すると、紐づく食事明細の qty も比例して再計算される', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', courseId: 1, drinkPlanId: null })
    mockCourseFindFirst.mockResolvedValue({
      id: 1, name: 'コースA', price: 3000, drinkPlanId: null,
      foodItems: [{ menuItemId: 10, qty: 2 }],
    })
    const chargeItem = { id: 'item-1', groupId: GROUP_ID, menuItemId: null, menuItemName: 'コースA', price: 3000, qty: 2, status: 'served', isTakeout: false, taxRate: { toNumber: () => 10 }, courseId: 1, isCourseCharge: true, isDrinkPlanCharge: false, orderedAt: new Date() }
    const foodItem = { id: 'food-1', groupId: GROUP_ID, menuItemId: 10, menuItemName: '唐揚げ', price: 0, qty: 4, status: 'served', isTakeout: false, taxRate: { toNumber: () => 10 }, courseId: 1, isCourseCharge: false, isDrinkPlanCharge: false, orderedAt: new Date() }
    const mockOrderItemFindFirstInTx = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(chargeItem)
    const mockOrderItemFindManyInTx = jest.fn<(...args: unknown[]) => Promise<unknown[]>>().mockResolvedValue([foodItem])
    const mockOrderItemUpdateInTx = jest.fn<(...args: unknown[]) => Promise<unknown>>()
      .mockImplementation(async (args: any) =>
        args.where.id === 'item-1' ? { ...chargeItem, qty: 5 } : { ...foodItem, qty: 10 })
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        group: { findUnique: () => Promise.resolve({ id: GROUP_ID, status: 'active', courseId: 1, drinkPlanId: null }) },
        orderItem: { findFirst: mockOrderItemFindFirstInTx, findMany: mockOrderItemFindManyInTx, update: mockOrderItemUpdateInTx },
      }
      return cb(tx)
    })
    const res = await app.inject({
      method: 'PUT', url: `/api/groups/${GROUP_ID}/course`,
      headers: { cookie: `token=${token(app)}` },
      payload: { qty: 5 },
    })
    expect(res.statusCode).toBe(200)
    expect(mockOrderItemFindManyInTx).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ groupId: GROUP_ID, courseId: 1, isCourseCharge: false }),
    }))
    // foodItems の 1人あたり qty(2) × 新人数(5) = 10
    expect(mockOrderItemUpdateInTx).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'food-1' },
      data: { qty: 10 },
    }))
  })

  it('事前チェック後・トランザクション内で active でなくなっていた場合も 409 を返す', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', courseId: 1, drinkPlanId: null })
    mockCourseFindFirst.mockResolvedValue({ id: 1, name: 'コースA', price: 3000, drinkPlanId: null, foodItems: [] })
    const mockOrderItemUpdateInTx = jest.fn<(...args: unknown[]) => Promise<unknown>>()
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        group: { findUnique: () => Promise.resolve({ id: GROUP_ID, status: 'bill_requested', courseId: 1, drinkPlanId: null }) },
        orderItem: { findFirst: jest.fn(), findMany: jest.fn(), update: mockOrderItemUpdateInTx },
      }
      return cb(tx)
    })
    const res = await app.inject({
      method: 'PUT', url: `/api/groups/${GROUP_ID}/course`,
      headers: { cookie: `token=${token(app)}` },
      payload: { qty: 5 },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: { message: 'このグループのコース人数は変更できません' } })
    expect(mockOrderItemUpdateInTx).not.toHaveBeenCalled()
  })

  it('事前チェック後・トランザクション内で courseId が変わっていた場合も 409 を返す', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', courseId: 1, drinkPlanId: null })
    mockCourseFindFirst.mockResolvedValue({ id: 1, name: 'コースA', price: 3000, drinkPlanId: null, foodItems: [] })
    const mockOrderItemUpdateInTx = jest.fn<(...args: unknown[]) => Promise<unknown>>()
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        group: { findUnique: () => Promise.resolve({ id: GROUP_ID, status: 'active', courseId: 2, drinkPlanId: null }) },
        orderItem: { findFirst: jest.fn(), findMany: jest.fn(), update: mockOrderItemUpdateInTx },
      }
      return cb(tx)
    })
    const res = await app.inject({
      method: 'PUT', url: `/api/groups/${GROUP_ID}/course`,
      headers: { cookie: `token=${token(app)}` },
      payload: { qty: 5 },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: { message: 'このグループのコース人数は変更できません' } })
    expect(mockOrderItemUpdateInTx).not.toHaveBeenCalled()
  })
})
