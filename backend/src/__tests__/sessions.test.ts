import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import { Prisma } from '@prisma/client'

type FakeOrderItem = {
  groupId: string
  menuItemId: number | null
  menuItemName: string
  price: number
  qty: number
  isTakeout: boolean
  isCourseCharge: boolean
  courseId: number | null
  orderedAt: Date
  group: FakeGroup
  menuItem: { category: { name: string }; subCategory: { name: string } } | null
}
type FakeGroup = {
  id: string
  guestCount: number
  billedTaxRateInHouse: { toNumber(): number } | null
  billedTaxRateTakeout: { toNumber(): number } | null
  billedTaxInclusive: boolean | null
  seats: { seatId: number }[]
}

const mockSessionFindFirst = jest.fn<(...args: unknown[]) => Promise<any>>()
const mockSessionCreate = jest.fn<(...args: unknown[]) => Promise<any>>()
const mockSessionUpdate = jest.fn<(...args: unknown[]) => Promise<any>>()
const mockGroupFindMany = jest.fn<(...args: unknown[]) => Promise<unknown[]>>()
const mockGroupCount = jest.fn<(...args: unknown[]) => Promise<number>>()
const mockOrderItemFindMany = jest.fn<(...args: unknown[]) => Promise<FakeOrderItem[]>>()
const mockSeatCount = jest.fn<(...args: unknown[]) => Promise<number>>()
const mockSettingFindUnique = jest.fn<(...args: unknown[]) => Promise<any>>()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockTransaction = jest.fn<(cb: (tx: any) => Promise<any>, options?: any) => Promise<any>>()

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    session: { findFirst: mockSessionFindFirst, create: mockSessionCreate, update: mockSessionUpdate },
    group: { findMany: mockGroupFindMany, count: mockGroupCount },
    orderItem: { findMany: mockOrderItemFindMany },
    seat: { count: mockSeatCount },
    setting: { findUnique: mockSettingFindUnique },
    $transaction: mockTransaction,
  },
}))

const { default: sessionsRoutes } = await import('../routes/sessions.js')

const SECRET = 'test-secret'
const ADMIN_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const STORE_ID = 1
const reportGroup: FakeGroup = {
  id: 'g1',
  guestCount: 2,
  billedTaxRateInHouse: null,
  billedTaxRateTakeout: null,
  billedTaxInclusive: null,
  seats: [],
}

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockIo: any = { emit: jest.fn() }
  mockIo.to = () => mockIo
  app.decorate('io', mockIo)
  await app.register(sessionsRoutes, { prefix: '/api/sessions' })
  await app.ready()
  return app
}

function token(app: Awaited<ReturnType<typeof buildTestApp>>) {
  return app.jwt.sign({ type: 'staff' as const, userId: ADMIN_ID, username: 'admin', role: 'admin', storeId: STORE_ID })
}

describe('GET /api/sessions/:id/report — カテゴリ内訳', () => {
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

  function item(overrides: Partial<FakeOrderItem>): FakeOrderItem {
    return {
      groupId: 'g1',
      menuItemId: 1,
      menuItemName: '商品',
      price: 1000,
      qty: 1,
      isTakeout: false,
      isCourseCharge: false,
      courseId: null,
      orderedAt: new Date('2026-07-02T12:00:00'),
      group: reportGroup,
      menuItem: { category: { name: 'フード' }, subCategory: { name: '揚げ物' } },
      ...overrides,
    }
  }

  it('closed でないセッションは 409 を返す', async () => {
    mockSessionFindFirst.mockResolvedValue({ id: 1, status: 'open' })

    const res = await app.inject({
      method: 'GET', url: '/api/sessions/1/report',
      headers: { cookie: `token=${token(app)}` },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: { code: 'sessions.report.not_closed' } })
    expect(mockGroupFindMany).not.toHaveBeenCalled()
  })

  it('Setting が存在しない場合、デフォルト税率へフォールバックせず 500 を返す', async () => {
    mockSessionFindFirst.mockResolvedValue({ id: 1, status: 'closed' })
    mockGroupFindMany.mockResolvedValue([reportGroup])
    mockOrderItemFindMany.mockResolvedValue([
      item({ price: 1000, qty: 1 }),
    ])
    mockSettingFindUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'GET', url: '/api/sessions/1/report',
      headers: { cookie: `token=${token(app)}` },
    })

    expect(res.statusCode).toBe(500)
    expect(res.json()).toMatchObject({ error: { code: 'common.setting_not_found', message: '店舗設定が見つかりません' } })
  })

  it('コース/飲み放題の定額課金は「削除済みメニュー」ではなく専用カテゴリに集計される', async () => {
    mockSessionFindFirst.mockResolvedValue({ id: 1, status: 'closed' })
    mockGroupFindMany.mockResolvedValue([reportGroup])
    mockSeatCount.mockResolvedValue(10)
    mockOrderItemFindMany.mockResolvedValue([
      item({ menuItemId: null, menuItemName: 'Aコース', price: 3000, qty: 2, isCourseCharge: true, courseId: 5, menuItem: null }),
      item({ menuItemId: null, menuItemName: '削除された商品', price: 500, menuItem: null }),
      item({ menuItemId: 9, menuItemName: 'ビール', price: 600, menuItem: { category: { name: 'ドリンク' }, subCategory: { name: 'アルコール' } } }),
    ])

    const res = await app.inject({
      method: 'GET', url: '/api/sessions/1/report',
      headers: { cookie: `token=${token(app)}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.categoryBreakdown['コース・飲み放題料金']).toBe(6000)
    expect(body.categoryBreakdown['削除済みメニュー']).toBe(500)
    expect(body.categoryBreakdown['ドリンク']).toBe(600)
  })

  it('taxBreakdown は Group の実効税率で店内・テイクアウトを集計する', async () => {
    mockSessionFindFirst.mockResolvedValue({ id: 1, status: 'closed' })
    mockGroupFindMany.mockResolvedValue([reportGroup])
    mockSeatCount.mockResolvedValue(10)
    mockOrderItemFindMany.mockResolvedValue([
      item({ menuItemName: '外税商品', price: 1000, qty: 2 }),
      item({ menuItemId: 2, menuItemName: '外税テイクアウト', price: 500, isTakeout: true, menuItem: { category: { name: '弁当' }, subCategory: { name: '持ち帰り' } } }),
    ])

    const res = await app.inject({
      method: 'GET', url: '/api/sessions/1/report',
      headers: { cookie: `token=${token(app)}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().taxBreakdown).toEqual({
      '10': { subtotal: 2000, tax: 200 },
      '8': { subtotal: 500, tax: 40 },
    })
  })

  it('closed グループは billedTax を Setting より優先して taxBreakdown を集計する', async () => {
    const closedGroup = { ...reportGroup, billedTaxRateInHouse: { toNumber: () => 12 }, billedTaxRateTakeout: { toNumber: () => 9 }, billedTaxInclusive: true }
    mockSessionFindFirst.mockResolvedValue({ id: 1, status: 'closed' })
    mockGroupFindMany.mockResolvedValue([closedGroup])
    mockOrderItemFindMany.mockResolvedValue([
      item({ price: 1000, qty: 2, group: closedGroup }),
      item({ price: 500, qty: 1, isTakeout: true, group: closedGroup }),
    ])

    const res = await app.inject({
      method: 'GET', url: '/api/sessions/1/report',
      headers: { cookie: `token=${token(app)}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().taxBreakdown).toEqual({ inclusive: { subtotal: 2500, tax: 0 } })
  })

  it('時間帯別集計はサーバーTZに依存せずJSTのhourに計上する', async () => {
    mockSessionFindFirst.mockResolvedValue({ id: 1, status: 'closed' })
    mockGroupFindMany.mockResolvedValue([reportGroup])
    mockSeatCount.mockResolvedValue(10)
    mockOrderItemFindMany.mockResolvedValue([
      item({ menuItemId: 9, menuItemName: 'ビール', price: 600, orderedAt: new Date('2026-07-02T11:00:00.000Z'), menuItem: { category: { name: 'ドリンク' }, subCategory: { name: 'アルコール' } } }),
    ])

    const res = await app.inject({
      method: 'GET', url: '/api/sessions/1/report',
      headers: { cookie: `token=${token(app)}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().hourly).toEqual([{ hour: 20, 'ドリンク': 600 }])
  })

  it('保存済みの座席使用率がある場合は現在の座席数で再計算しない', async () => {
    mockSessionFindFirst.mockResolvedValue({ id: 1, status: 'closed', seatUsageRate: 40 })
    mockGroupFindMany.mockResolvedValue([{ ...reportGroup, seats: [{ seatId: 1 }, { seatId: 2 }] }])
    mockOrderItemFindMany.mockResolvedValue([])

    const res = await app.inject({
      method: 'GET', url: '/api/sessions/1/report',
      headers: { cookie: `token=${token(app)}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().seatUsageRate).toBe(40)
    expect(mockSeatCount).not.toHaveBeenCalled()
  })

  it('座席使用率が未保存の場合は従来通り現在の座席数から計算する', async () => {
    mockSessionFindFirst.mockResolvedValue({ id: 1, status: 'closed', seatUsageRate: null })
    mockGroupFindMany.mockResolvedValue([{ ...reportGroup, seats: [{ seatId: 1 }, { seatId: 2 }] }])
    mockSeatCount.mockResolvedValue(8)
    mockOrderItemFindMany.mockResolvedValue([])

    const res = await app.inject({
      method: 'GET', url: '/api/sessions/1/report',
      headers: { cookie: `token=${token(app)}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().seatUsageRate).toBe(25)
    expect(mockSeatCount).toHaveBeenCalledWith({ where: { storeId: STORE_ID } })
  })
})

describe('POST /api/sessions — セッション作成', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  beforeAll(async () => { app = await buildTestApp() })
  afterAll(async () => { await app.close() })
  beforeEach(() => { jest.clearAllMocks() })

  it('Serializable 分離レベルで open セッションを作成する', async () => {
    const openedAt = new Date('2026-07-02T11:00:00.000Z')
    mockTransaction.mockImplementation(async (cb) => cb({
      session: {
        findFirst: () => Promise.resolve(null),
        create: () => Promise.resolve({ id: 1, status: 'open', openedAt }),
      },
    }))

    const res = await app.inject({
      method: 'POST', url: '/api/sessions',
      headers: { cookie: `token=${token(app)}` },
    })

    expect(res.statusCode).toBe(201)
    expect(mockTransaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })
  })

  it('Serializable 分離レベルでの書き込み競合（P2034）でも 409 を返す', async () => {
    mockTransaction.mockImplementation(async () => {
      throw new Prisma.PrismaClientKnownRequestError('Transaction failed due to a write conflict', { code: 'P2034', clientVersion: '5.17.0' })
    })

    const res = await app.inject({
      method: 'POST', url: '/api/sessions',
      headers: { cookie: `token=${token(app)}` },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: { code: 'sessions.create.already_open' } })
  })
})

describe('PUT /api/sessions/:id — セッション更新', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  beforeAll(async () => { app = await buildTestApp() })
  afterAll(async () => { await app.close() })
  beforeEach(() => { jest.clearAllMocks() })

  it('他に open セッションがある状態での再オープンは 409 を返す', async () => {
    const txSessionFindFirst = jest.fn<(...args: unknown[]) => Promise<any>>()
      .mockResolvedValueOnce({ id: 1, status: 'closed' })
      .mockResolvedValueOnce({ id: 2, status: 'open' })
    mockTransaction.mockImplementation(async (cb) => cb({
      session: {
        findFirst: txSessionFindFirst,
        update: mockSessionUpdate,
      },
      group: { count: mockGroupCount },
    }))

    const res = await app.inject({
      method: 'PUT', url: '/api/sessions/1',
      headers: { cookie: `token=${token(app)}` },
      payload: { status: 'open' },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: { code: 'sessions.create.already_open' } })
    expect(mockSessionUpdate).not.toHaveBeenCalled()
    expect(txSessionFindFirst).toHaveBeenCalledTimes(2)
  })

  it('open セッションが他に無い状態での再オープンは成功する', async () => {
    const openedAt = new Date('2026-07-02T11:00:00.000Z')
    const txSessionFindFirst = jest.fn<(...args: unknown[]) => Promise<any>>()
      .mockResolvedValueOnce({ id: 1, status: 'closed' })
      .mockResolvedValueOnce(null)
    mockTransaction.mockImplementation(async (cb) => cb({
      session: {
        findFirst: txSessionFindFirst,
        update: mockSessionUpdate.mockResolvedValue({ id: 1, status: 'open', openedAt, closedAt: null }),
      },
      group: { count: mockGroupCount },
    }))

    const res = await app.inject({
      method: 'PUT', url: '/api/sessions/1',
      headers: { cookie: `token=${token(app)}` },
      payload: { status: 'open' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ id: 1, status: 'open', closedAt: null })
    expect(mockTransaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })
    expect(txSessionFindFirst).toHaveBeenCalledTimes(2)
    expect(mockSessionUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        status: 'open',
        closedAt: null,
        seatUsageRate: null,
      },
    })
    expect(mockSeatCount).not.toHaveBeenCalled()
    expect(mockGroupFindMany).not.toHaveBeenCalled()
  })

  it('close 処理は Serializable 分離レベルで実行する', async () => {
    const openedAt = new Date('2026-07-02T11:00:00.000Z')
    const closedAt = new Date('2026-07-02T12:00:00.000Z')
    const txSessionFindFirst = jest.fn<(...args: unknown[]) => Promise<any>>()
      .mockResolvedValueOnce({ id: 1, status: 'open' })
    const txGroupFindMany = jest.fn<(...args: unknown[]) => Promise<unknown[]>>()
      .mockResolvedValue([{ id: 'g1', seats: [{ seatId: 1 }, { seatId: 2 }] }])
    const txSeatCount = jest.fn<(...args: unknown[]) => Promise<number>>()
      .mockResolvedValue(4)
    mockTransaction.mockImplementation(async (cb) => cb({
      session: {
        findFirst: txSessionFindFirst,
        update: mockSessionUpdate.mockResolvedValue({ id: 1, status: 'closed', openedAt, closedAt }),
      },
      group: { count: () => Promise.resolve(0), findMany: txGroupFindMany },
      seat: { count: txSeatCount },
    }))

    const res = await app.inject({
      method: 'PUT', url: '/api/sessions/1',
      headers: { cookie: `token=${token(app)}` },
      payload: { status: 'closed' },
    })

    expect(res.statusCode).toBe(200)
    expect(mockTransaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })
    expect(txSessionFindFirst).toHaveBeenCalledTimes(1)
    expect(txSeatCount).toHaveBeenCalledWith({ where: { storeId: STORE_ID } })
    expect(txGroupFindMany).toHaveBeenCalledWith({
      where: { sessionId: 1 },
      include: { seats: true },
    })
    expect(mockSessionUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        status: 'closed',
        closedAt: expect.any(Date),
        seatUsageRate: 50,
      },
    })
  })

  it('close 処理の書き込み競合（P2034）でも 409 を返す', async () => {
    mockTransaction.mockImplementation(async () => {
      throw new Prisma.PrismaClientKnownRequestError('Transaction failed due to a write conflict', { code: 'P2034', clientVersion: '5.17.0' })
    })

    const res = await app.inject({
      method: 'PUT', url: '/api/sessions/1',
      headers: { cookie: `token=${token(app)}` },
      payload: { status: 'closed' },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: { code: 'sessions.close.active_groups_exist' } })
  })
})
