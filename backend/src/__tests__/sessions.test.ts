import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import { Prisma } from '@prisma/client'

type FakeOrderItem = {
  menuItemId: number | null
  menuItemName: string
  price: number
  qty: number
  isCourseCharge: boolean
  courseId: number | null
  taxRate: { toNumber(): number }
  taxInclusive: boolean
  orderedAt: Date
  menuItem: { category: { name: string }; subCategory: { name: string } } | null
}

const mockSessionFindFirst = jest.fn<(...args: unknown[]) => Promise<any>>()
const mockSessionCreate = jest.fn<(...args: unknown[]) => Promise<any>>()
const mockSessionUpdate = jest.fn<(...args: unknown[]) => Promise<any>>()
const mockGroupFindMany = jest.fn<(...args: unknown[]) => Promise<unknown[]>>()
const mockGroupCount = jest.fn<(...args: unknown[]) => Promise<number>>()
const mockOrderItemFindMany = jest.fn<(...args: unknown[]) => Promise<FakeOrderItem[]>>()
const mockSeatCount = jest.fn<(...args: unknown[]) => Promise<number>>()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockTransaction = jest.fn<(cb: (tx: any) => Promise<any>, options?: any) => Promise<any>>()

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    session: { findFirst: mockSessionFindFirst, create: mockSessionCreate, update: mockSessionUpdate },
    group: { findMany: mockGroupFindMany, count: mockGroupCount },
    orderItem: { findMany: mockOrderItemFindMany },
    seat: { count: mockSeatCount },
    $transaction: mockTransaction,
  },
}))

const { default: sessionsRoutes } = await import('../routes/sessions.js')

const SECRET = 'test-secret'
const ADMIN_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
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
  beforeEach(() => { jest.clearAllMocks() })

  it('コース/飲み放題の定額課金は「削除済みメニュー」ではなく専用カテゴリに集計される', async () => {
    mockSessionFindFirst.mockResolvedValue({ id: 1 })
    mockGroupFindMany.mockResolvedValue([{ id: 'g1', guestCount: 2, seats: [] }])
    mockSeatCount.mockResolvedValue(10)
    mockOrderItemFindMany.mockResolvedValue([
      {
        menuItemId: null,
        menuItemName: 'Aコース',
        price: 3000,
        qty: 2,
        isCourseCharge: true,
        courseId: 5,
        taxRate: { toNumber: () => 10 },
        taxInclusive: false,
        orderedAt: new Date('2026-07-02T12:00:00'),
        menuItem: null,
      },
      {
        menuItemId: null,
        menuItemName: '削除された商品',
        price: 500,
        qty: 1,
        isCourseCharge: false,
        courseId: null,
        taxRate: { toNumber: () => 10 },
        taxInclusive: false,
        orderedAt: new Date('2026-07-02T12:00:00'),
        menuItem: null,
      },
      {
        menuItemId: 9,
        menuItemName: 'ビール',
        price: 600,
        qty: 1,
        isCourseCharge: false,
        courseId: null,
        taxRate: { toNumber: () => 10 },
        taxInclusive: false,
        orderedAt: new Date('2026-07-02T12:00:00'),
        menuItem: { category: { name: 'ドリンク' }, subCategory: { name: 'アルコール' } },
      },
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

  it('taxBreakdown は税込・外税の混在を明細単位で集計する', async () => {
    mockSessionFindFirst.mockResolvedValue({ id: 1 })
    mockGroupFindMany.mockResolvedValue([{ id: 'g1', guestCount: 2, seats: [] }])
    mockSeatCount.mockResolvedValue(10)
    mockOrderItemFindMany.mockResolvedValue([
      {
        menuItemId: 1,
        menuItemName: '外税商品',
        price: 1000,
        qty: 2,
        isCourseCharge: false,
        courseId: null,
        taxRate: { toNumber: () => 10 },
        taxInclusive: false,
        orderedAt: new Date('2026-07-02T12:00:00'),
        menuItem: { category: { name: 'フード' }, subCategory: { name: '揚げ物' } },
      },
      {
        menuItemId: 2,
        menuItemName: '税込商品',
        price: 800,
        qty: 3,
        isCourseCharge: false,
        courseId: null,
        taxRate: { toNumber: () => 10 },
        taxInclusive: true,
        orderedAt: new Date('2026-07-02T12:00:00'),
        menuItem: { category: { name: 'ドリンク' }, subCategory: { name: 'ソフトドリンク' } },
      },
      {
        menuItemId: 3,
        menuItemName: '外税テイクアウト',
        price: 500,
        qty: 1,
        isCourseCharge: false,
        courseId: null,
        taxRate: { toNumber: () => 8 },
        taxInclusive: false,
        orderedAt: new Date('2026-07-02T12:00:00'),
        menuItem: { category: { name: '弁当' }, subCategory: { name: '持ち帰り' } },
      },
    ])

    const res = await app.inject({
      method: 'GET', url: '/api/sessions/1/report',
      headers: { cookie: `token=${token(app)}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().taxBreakdown).toEqual({
      '10': { subtotal: 2000, tax: 200 },
      inclusive: { subtotal: 2400, tax: 0 },
      '8': { subtotal: 500, tax: 40 },
    })
  })

  it('時間帯別集計はサーバーTZに依存せずJSTのhourに計上する', async () => {
    mockSessionFindFirst.mockResolvedValue({ id: 1 })
    mockGroupFindMany.mockResolvedValue([{ id: 'g1', guestCount: 2, seats: [] }])
    mockSeatCount.mockResolvedValue(10)
    mockOrderItemFindMany.mockResolvedValue([
      {
        menuItemId: 9,
        menuItemName: 'ビール',
        price: 600,
        qty: 1,
        isCourseCharge: false,
        courseId: null,
        taxRate: { toNumber: () => 10 },
        taxInclusive: false,
        orderedAt: new Date('2026-07-02T11:00:00.000Z'),
        menuItem: { category: { name: 'ドリンク' }, subCategory: { name: 'アルコール' } },
      },
    ])

    const res = await app.inject({
      method: 'GET', url: '/api/sessions/1/report',
      headers: { cookie: `token=${token(app)}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().hourly).toEqual([{ hour: 20, 'ドリンク': 600 }])
  })

  it('保存済みの座席使用率がある場合は現在の座席数で再計算しない', async () => {
    mockSessionFindFirst.mockResolvedValue({ id: 1, seatUsageRate: 40 })
    mockGroupFindMany.mockResolvedValue([{ id: 'g1', guestCount: 2, seats: [{ seatId: 1 }, { seatId: 2 }] }])
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
    mockSessionFindFirst.mockResolvedValue({ id: 1, seatUsageRate: null })
    mockGroupFindMany.mockResolvedValue([{ id: 'g1', guestCount: 2, seats: [{ seatId: 1 }, { seatId: 2 }] }])
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
