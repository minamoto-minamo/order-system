import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { Prisma } from '@prisma/client'
import Fastify from 'fastify'

type Group = { id: string; status: string; drinkPlanId: number | null; courseId: number | null }
type MenuItem = { id: number; name: string; price: number; soldOut: boolean; takeout: string }
type DrinkPlanItem = { menuItemId: number }
type Setting = {
  taxRateInHouse: { toNumber(): number }
  taxRateTakeout: { toNumber(): number }
  taxInclusive?: boolean
}

const mockGroupFindFirst = jest.fn<(...args: unknown[]) => Promise<Group | null>>()
const mockCourseFindFirst = jest.fn<(...args: unknown[]) => Promise<{ id: number } | null>>()
const mockMenuItemFindMany = jest.fn<(...args: unknown[]) => Promise<MenuItem[]>>()
const mockDrinkPlanItemFindMany = jest.fn<(...args: unknown[]) => Promise<DrinkPlanItem[]>>()
const mockSettingFindUnique = jest.fn<(...args: unknown[]) => Promise<Setting | null>>()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockTransaction =
  jest.fn<(cb: (tx: any) => Promise<any>, options?: unknown) => Promise<any>>()

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    group: { findFirst: mockGroupFindFirst },
    course: { findFirst: mockCourseFindFirst },
    menuItem: { findMany: mockMenuItemFindMany },
    drinkPlanItem: { findMany: mockDrinkPlanItemFindMany },
    setting: { findUnique: mockSettingFindUnique },
    $transaction: mockTransaction,
  },
}))

const { default: ordersRoutes } = await import('../routes/orders.js')

const SECRET = 'test-secret'
const STAFF_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const GROUP_ID = 'gggggggg-gggg-gggg-gggg-gggggggggggg'
const STORE_ID = 1

async function buildTestApp() {
  const app = Fastify({ logger: false })
  app.decorateRequest('storeId', 0)
  app.addHook('onRequest', async (request) => {
    request.storeId = STORE_ID
  })
  await app.register(cookie)
  await app.register(jwt, { secret: SECRET, cookie: { cookieName: 'token', signed: false } })
  app.addHook('preHandler', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      reply.status(401).send({
        error: { code: 'auth.session.required', message: '認証が必要です', details: null },
      })
    }
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockIo: any = { emit: jest.fn() }
  mockIo.to = () => mockIo
  app.decorate('io', mockIo)
  await app.register(ordersRoutes, { prefix: '/api/orders' })
  await app.ready()
  return app
}

function token(app: Awaited<ReturnType<typeof buildTestApp>>) {
  return app.jwt.sign({
    type: 'staff' as const,
    userId: STAFF_ID,
    username: 'staff',
    role: 'staff',
    storeId: STORE_ID,
  })
}

function mockTx(
  createFn: (...args: unknown[]) => Promise<unknown>,
  currentGroup: Partial<Group> = {},
) {
  mockTransaction.mockImplementation(async (cb) => {
    const tx = {
      group: {
        findUnique: () =>
          Promise.resolve({
            id: GROUP_ID,
            status: 'active',
            drinkPlanId: null,
            courseId: null,
            ...currentGroup,
          }),
      },
      drinkPlanItem: { findMany: mockDrinkPlanItemFindMany },
      setting: { findUnique: mockSettingFindUnique },
      orderItem: { create: createFn },
    }
    return cb(tx)
  })
}

describe('POST /api/orders — 飲み放題プラン対象商品の0円化', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  beforeAll(async () => {
    app = await buildTestApp()
  })
  afterAll(async () => {
    await app.close()
  })
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('drinkPlan 対象商品を店内注文すると price が 0 になる', async () => {
    mockGroupFindFirst.mockResolvedValue({
      id: GROUP_ID,
      status: 'active',
      drinkPlanId: 5,
      courseId: null,
    })
    mockMenuItemFindMany.mockResolvedValue([
      { id: 1, name: '生ビール', price: 600, soldOut: false, takeout: 'both' },
    ])
    mockDrinkPlanItemFindMany.mockResolvedValue([{ menuItemId: 1 }])
    mockSettingFindUnique.mockResolvedValue({
      taxRateInHouse: { toNumber: () => 10 },
      taxRateTakeout: { toNumber: () => 8 },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockCreate = jest.fn<any>().mockResolvedValue({
      id: 'item-1',
      groupId: GROUP_ID,
      menuItemId: 1,
      menuItemName: '生ビール',
      price: 0,
      qty: 1,
      status: 'pending',
      isTakeout: false,
      taxRate: { toNumber: () => 10 },
      courseId: null,
      orderedAt: new Date(),
    })
    mockTx(mockCreate, { drinkPlanId: 5 })

    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { cookie: `token=${token(app)}` },
      payload: { groupId: GROUP_ID, items: [{ menuItemId: 1, qty: 1 }] },
    })

    expect(res.statusCode).toBe(201)
    expect(mockTransaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })
    expect(mockDrinkPlanItemFindMany).toHaveBeenCalledWith({
      where: { drinkPlanId: 5 },
      select: { menuItemId: true },
    })
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ menuItemId: 1, price: 0, originalPrice: 600 }),
      }),
    )
  })

  it('drinkPlan 対象商品でもテイクアウト注文なら通常単価のまま、originalPrice は注文時点単価を持つ', async () => {
    mockGroupFindFirst.mockResolvedValue({
      id: GROUP_ID,
      status: 'active',
      drinkPlanId: 5,
      courseId: null,
    })
    mockMenuItemFindMany.mockResolvedValue([
      { id: 1, name: '生ビール', price: 600, soldOut: false, takeout: 'both' },
    ])
    mockDrinkPlanItemFindMany.mockResolvedValue([{ menuItemId: 1 }])
    mockSettingFindUnique.mockResolvedValue({
      taxRateInHouse: { toNumber: () => 10 },
      taxRateTakeout: { toNumber: () => 8 },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockCreate = jest.fn<any>().mockResolvedValue({
      id: 'item-1',
      groupId: GROUP_ID,
      menuItemId: 1,
      menuItemName: '生ビール',
      price: 600,
      originalPrice: 600,
      qty: 1,
      status: 'pending',
      isTakeout: true,
      taxRate: { toNumber: () => 8 },
      courseId: null,
      orderedAt: new Date(),
    })
    mockTx(mockCreate, { drinkPlanId: 5 })

    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { cookie: `token=${token(app)}` },
      payload: { groupId: GROUP_ID, items: [{ menuItemId: 1, qty: 1, isTakeout: true }] },
    })

    expect(res.statusCode).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ menuItemId: 1, price: 600, originalPrice: 600 }),
      }),
    )
  })

  it('drinkPlan が設定されていないグループでは通常単価のまま、originalPrice は注文時点単価を持つ', async () => {
    mockGroupFindFirst.mockResolvedValue({
      id: GROUP_ID,
      status: 'active',
      drinkPlanId: null,
      courseId: null,
    })
    mockMenuItemFindMany.mockResolvedValue([
      { id: 1, name: '生ビール', price: 600, soldOut: false, takeout: 'both' },
    ])
    mockSettingFindUnique.mockResolvedValue({
      taxRateInHouse: { toNumber: () => 10 },
      taxRateTakeout: { toNumber: () => 8 },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockCreate = jest.fn<any>().mockResolvedValue({
      id: 'item-1',
      groupId: GROUP_ID,
      menuItemId: 1,
      menuItemName: '生ビール',
      price: 600,
      originalPrice: 600,
      qty: 1,
      status: 'pending',
      isTakeout: false,
      taxRate: { toNumber: () => 10 },
      courseId: null,
      orderedAt: new Date(),
    })
    mockTx(mockCreate)

    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { cookie: `token=${token(app)}` },
      payload: { groupId: GROUP_ID, items: [{ menuItemId: 1, qty: 1 }] },
    })

    expect(res.statusCode).toBe(201)
    expect(mockDrinkPlanItemFindMany).not.toHaveBeenCalled()
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ menuItemId: 1, price: 600, originalPrice: 600 }),
      }),
    )
  })

  it('注文作成時に税率・税込設定を OrderItem に保存しない', async () => {
    mockGroupFindFirst.mockResolvedValue({
      id: GROUP_ID,
      status: 'active',
      drinkPlanId: null,
      courseId: null,
    })
    mockMenuItemFindMany.mockResolvedValue([
      { id: 1, name: '生ビール', price: 600, soldOut: false, takeout: 'both' },
    ])
    mockSettingFindUnique.mockResolvedValue({
      taxRateInHouse: { toNumber: () => 10 },
      taxRateTakeout: { toNumber: () => 8 },
      taxInclusive: true,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockCreate = jest.fn<any>().mockResolvedValue({
      id: 'item-1',
      groupId: GROUP_ID,
      menuItemId: 1,
      menuItemName: '生ビール',
      price: 600,
      qty: 1,
      status: 'pending',
      isTakeout: false,
      courseId: null,
      isCourseCharge: false,
      isDrinkPlanCharge: false,
      orderedAt: new Date(),
    })
    mockTx(mockCreate)

    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { cookie: `token=${token(app)}` },
      payload: { groupId: GROUP_ID, items: [{ menuItemId: 1, qty: 1 }] },
    })

    expect(res.statusCode).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          taxRate: expect.anything(),
          taxInclusive: expect.anything(),
        }),
      }),
    )
  })
})

describe('POST /api/orders — courseId 検証', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  beforeAll(async () => {
    app = await buildTestApp()
  })
  afterAll(async () => {
    await app.close()
  })
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('適用中コースと一致する courseId 付き注文は成功する', async () => {
    mockGroupFindFirst.mockResolvedValue({
      id: GROUP_ID,
      status: 'active',
      drinkPlanId: null,
      courseId: 10,
    })
    mockCourseFindFirst.mockResolvedValue({ id: 10 })
    mockMenuItemFindMany.mockResolvedValue([
      { id: 1, name: '枝豆', price: 300, soldOut: false, takeout: 'both' },
    ])
    mockSettingFindUnique.mockResolvedValue({
      taxRateInHouse: { toNumber: () => 10 },
      taxRateTakeout: { toNumber: () => 8 },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockCreate = jest.fn<any>().mockResolvedValue({
      id: 'item-1',
      groupId: GROUP_ID,
      menuItemId: 1,
      menuItemName: '枝豆',
      price: 300,
      qty: 1,
      status: 'pending',
      isTakeout: false,
      taxRate: { toNumber: () => 10 },
      courseId: 10,
      orderedAt: new Date(),
    })
    mockTx(mockCreate, { courseId: 10 })

    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { cookie: `token=${token(app)}` },
      payload: { groupId: GROUP_ID, courseId: 10, items: [{ menuItemId: 1, qty: 1 }] },
    })

    expect(res.statusCode).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ courseId: 10 }),
      }),
    )
  })

  it('適用中コースと不一致の courseId 付き注文は 422 を返す', async () => {
    mockGroupFindFirst.mockResolvedValue({
      id: GROUP_ID,
      status: 'active',
      drinkPlanId: null,
      courseId: 10,
    })
    mockCourseFindFirst.mockResolvedValue({ id: 20 })
    mockMenuItemFindMany.mockResolvedValue([
      { id: 1, name: '枝豆', price: 300, soldOut: false, takeout: 'both' },
    ])
    mockSettingFindUnique.mockResolvedValue({
      taxRateInHouse: { toNumber: () => 10 },
      taxRateTakeout: { toNumber: () => 8 },
    })
    const mockCreate = jest.fn<(...args: unknown[]) => Promise<unknown>>()
    mockTx(mockCreate, { courseId: 10 })

    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { cookie: `token=${token(app)}` },
      payload: { groupId: GROUP_ID, courseId: 20, items: [{ menuItemId: 1, qty: 1 }] },
    })

    expect(res.statusCode).toBe(422)
    expect(res.json()).toMatchObject({
      error: { code: 'orders.create.course_mismatch', message: '適用中のコースと一致しません' },
    })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('Serializable 分離レベルでの作成競合（P2034）でも 409 を返す', async () => {
    mockGroupFindFirst.mockResolvedValue({
      id: GROUP_ID,
      status: 'active',
      drinkPlanId: null,
      courseId: null,
    })
    mockMenuItemFindMany.mockResolvedValue([
      { id: 1, name: '枝豆', price: 300, soldOut: false, takeout: 'both' },
    ])
    mockTransaction.mockImplementation(async () => {
      throw new Prisma.PrismaClientKnownRequestError('Transaction failed due to a write conflict', {
        code: 'P2034',
        clientVersion: '5.17.0',
      })
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { cookie: `token=${token(app)}` },
      payload: { groupId: GROUP_ID, items: [{ menuItemId: 1, qty: 1 }] },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({
      error: { message: '他の操作と競合しました。もう一度お試しください' },
    })
    expect(mockTransaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })
  })
})

describe('POST /api/orders — テイクアウト可否チェック', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  beforeAll(async () => {
    app = await buildTestApp()
  })
  afterAll(async () => {
    await app.close()
  })
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('テイクアウト専用商品を店内注文（isTakeout未指定）すると 422 を返す', async () => {
    mockGroupFindFirst.mockResolvedValue({
      id: GROUP_ID,
      status: 'active',
      drinkPlanId: null,
      courseId: null,
    })
    mockMenuItemFindMany.mockResolvedValue([
      { id: 1, name: '弁当', price: 800, soldOut: false, takeout: 'takeout' },
    ])

    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { cookie: `token=${token(app)}` },
      payload: { groupId: GROUP_ID, items: [{ menuItemId: 1, qty: 1 }] },
    })

    expect(res.statusCode).toBe(422)
    expect(res.json()).toMatchObject({
      error: { message: 'テイクアウト設定に合わない商品が含まれています' },
    })
  })

  it('店内専用商品をテイクアウト注文すると 422 を返す', async () => {
    mockGroupFindFirst.mockResolvedValue({
      id: GROUP_ID,
      status: 'active',
      drinkPlanId: null,
      courseId: null,
    })
    mockMenuItemFindMany.mockResolvedValue([
      { id: 1, name: '生ビール', price: 600, soldOut: false, takeout: 'dine_in' },
    ])

    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { cookie: `token=${token(app)}` },
      payload: { groupId: GROUP_ID, items: [{ menuItemId: 1, qty: 1, isTakeout: true }] },
    })

    expect(res.statusCode).toBe(422)
    expect(res.json()).toMatchObject({
      error: { message: 'テイクアウト設定に合わない商品が含まれています' },
    })
  })

  it('テイクアウト専用商品をテイクアウト注文すれば通る', async () => {
    mockGroupFindFirst.mockResolvedValue({
      id: GROUP_ID,
      status: 'active',
      drinkPlanId: null,
      courseId: null,
    })
    mockMenuItemFindMany.mockResolvedValue([
      { id: 1, name: '弁当', price: 800, soldOut: false, takeout: 'takeout' },
    ])
    mockSettingFindUnique.mockResolvedValue({
      taxRateInHouse: { toNumber: () => 10 },
      taxRateTakeout: { toNumber: () => 8 },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockCreate = jest.fn<any>().mockResolvedValue({
      id: 'item-1',
      groupId: GROUP_ID,
      menuItemId: 1,
      menuItemName: '弁当',
      price: 800,
      qty: 1,
      status: 'pending',
      isTakeout: true,
      taxRate: { toNumber: () => 8 },
      courseId: null,
      orderedAt: new Date(),
    })
    mockTx(mockCreate)

    const res = await app.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { cookie: `token=${token(app)}` },
      payload: { groupId: GROUP_ID, items: [{ menuItemId: 1, qty: 1, isTakeout: true }] },
    })

    expect(res.statusCode).toBe(201)
  })
})

describe('PUT /api/orders/:id/cancel — group/session close 後のガード', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  beforeAll(async () => {
    app = await buildTestApp()
  })
  afterAll(async () => {
    await app.close()
  })
  beforeEach(() => {
    jest.clearAllMocks()
  })

  function mockCancelTx(
    order: {
      status: string
      qty: number
      group: { status: string; session: { status: string } }
      isCourseCharge?: boolean
    },
    updateFn = jest.fn<any>(),
  ) {
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        orderItem: {
          findFirst: () => Promise.resolve({ id: 'item-1', ...order }),
          update: updateFn,
        },
      }
      return cb(tx)
    })
    return updateFn
  }

  it('会計済み（closed）グループの注文はキャンセルできない', async () => {
    mockCancelTx({
      status: 'pending',
      qty: 1,
      group: { status: 'closed', session: { status: 'open' } },
    })

    const res = await app.inject({
      method: 'PUT',
      url: '/api/orders/item-1/cancel',
      headers: { cookie: `token=${token(app)}` },
      payload: { qty: 1 },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: { message: 'キャンセルできないステータスです' } })
  })

  it('セッションが closed の注文はキャンセルできない', async () => {
    mockCancelTx({
      status: 'pending',
      qty: 1,
      group: { status: 'active', session: { status: 'closed' } },
    })

    const res = await app.inject({
      method: 'PUT',
      url: '/api/orders/item-1/cancel',
      headers: { cookie: `token=${token(app)}` },
      payload: { qty: 1 },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: { message: 'キャンセルできないステータスです' } })
  })

  it('active なグループ・open なセッションの注文はキャンセルできる', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateFn = jest.fn<any>().mockResolvedValue({
      id: 'item-1',
      groupId: GROUP_ID,
      menuItemId: 1,
      menuItemName: 'test',
      price: 100,
      qty: 1,
      status: 'cancelled',
      isTakeout: false,
      taxRate: { toNumber: () => 10 },
      courseId: null,
      orderedAt: new Date(),
    })
    mockCancelTx(
      { status: 'pending', qty: 1, group: { status: 'active', session: { status: 'open' } } },
      updateFn,
    )

    const res = await app.inject({
      method: 'PUT',
      url: '/api/orders/item-1/cancel',
      headers: { cookie: `token=${token(app)}` },
      payload: { qty: 1 },
    })

    expect(res.statusCode).toBe(200)
    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'cancelled' } }),
    )
  })

  it('コース・飲み放題の定額課金明細（isCourseCharge:true）はキャンセルできない', async () => {
    const updateFn = jest.fn<any>()
    mockCancelTx(
      {
        status: 'served',
        qty: 1,
        group: { status: 'active', session: { status: 'open' } },
        isCourseCharge: true,
      },
      updateFn,
    )

    const res = await app.inject({
      method: 'PUT',
      url: '/api/orders/item-1/cancel',
      headers: { cookie: `token=${token(app)}` },
      payload: { qty: 1 },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({
      error: { message: 'コース・飲み放題料金はこの操作では取消できません' },
    })
    expect(updateFn).not.toHaveBeenCalled()
  })

  it('Serializable 分離レベルでの書き込み競合（P2034）でも 409 を返す（同一注文への同時キャンセル対策）', async () => {
    mockTransaction.mockImplementation(async () => {
      throw new Prisma.PrismaClientKnownRequestError('Transaction failed due to a write conflict', {
        code: 'P2034',
        clientVersion: '5.17.0',
      })
    })

    const res = await app.inject({
      method: 'PUT',
      url: '/api/orders/item-1/cancel',
      headers: { cookie: `token=${token(app)}` },
      payload: { qty: 1 },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({
      error: { message: '他の操作と競合しました。もう一度お試しください' },
    })
  })
})
