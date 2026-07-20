import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { Prisma } from '@prisma/client'
import Fastify from 'fastify'

const mockDrinkPlanFindFirst = jest.fn<(...args: unknown[]) => Promise<{ id: number } | null>>()
const mockCourseFindFirst = jest.fn<(...args: unknown[]) => Promise<{ id: number } | null>>()
const mockGroupFindFirst =
  jest.fn<(...args: unknown[]) => Promise<{ id: string; status: string } | null>>()
const mockGroupCount = jest.fn<(...args: unknown[]) => Promise<number>>()
const mockDrinkPlanDelete = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockDrinkPlanCreate = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockDrinkPlanUpdate = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockOrderItemCount = jest.fn<(...args: unknown[]) => Promise<number>>()
const mockMenuItemCount = jest.fn<(...args: unknown[]) => Promise<number>>()
const mockTransaction =
  jest.fn<
    (
      callback: (tx: {
        course: { findFirst: typeof mockCourseFindFirst }
        group: { findFirst: typeof mockGroupFindFirst; count: typeof mockGroupCount }
        orderItem: { count: typeof mockOrderItemCount }
        drinkPlan: { findFirst: typeof mockDrinkPlanFindFirst; delete: typeof mockDrinkPlanDelete }
      }) => Promise<unknown>,
      options?: unknown,
    ) => Promise<unknown>
  >()

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    $transaction: mockTransaction,
    course: { findFirst: mockCourseFindFirst },
    group: { findFirst: mockGroupFindFirst, count: mockGroupCount },
    drinkPlan: {
      findFirst: mockDrinkPlanFindFirst,
      delete: mockDrinkPlanDelete,
      create: mockDrinkPlanCreate,
      update: mockDrinkPlanUpdate,
    },
    orderItem: { count: mockOrderItemCount },
    menuItem: { count: mockMenuItemCount },
  },
}))

const { default: drinkPlansRoutes } = await import('../routes/drinkPlans.js')

const SECRET = 'test-secret'
const ADMIN_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const STORE_ID = 1

const mockIoEmit = jest.fn()

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
  app.decorate('io', { to: () => ({ emit: mockIoEmit }), emit: mockIoEmit } as any)
  await app.register(drinkPlansRoutes, { prefix: '/api/drink-plans' })
  await app.ready()
  return app
}

describe('DELETE /api/drink-plans/:id — 削除制御', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  let warnSpy: jest.SpiedFunction<typeof app.log.warn>

  beforeAll(async () => {
    app = await buildTestApp()
    warnSpy = jest.spyOn(app.log, 'warn').mockImplementation(() => app.log)
  })
  afterAll(async () => {
    await app.close()
  })
  beforeEach(() => {
    jest.clearAllMocks()
    mockTransaction.mockImplementation(async (callback) =>
      callback({
        course: { findFirst: mockCourseFindFirst },
        group: { findFirst: mockGroupFindFirst, count: mockGroupCount },
        orderItem: { count: mockOrderItemCount },
        drinkPlan: { findFirst: mockDrinkPlanFindFirst, delete: mockDrinkPlanDelete },
      }),
    )
    mockOrderItemCount.mockResolvedValue(0)
    mockGroupCount.mockResolvedValue(0)
  })

  function token() {
    return app.jwt.sign({
      type: 'staff' as const,
      userId: ADMIN_ID,
      username: 'admin',
      role: 'admin',
      storeId: STORE_ID,
    })
  }

  it('active グループが使用中なら 409 を返す', async () => {
    mockDrinkPlanFindFirst.mockResolvedValue({ id: 1 })
    mockCourseFindFirst.mockResolvedValue(null)
    mockGroupFindFirst.mockResolvedValue({ id: 'group-1', status: 'active' })
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/drink-plans/1',
      headers: { cookie: `token=${token()}` },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({
      error: { message: '使用中の飲み放題プランは削除できません' },
    })
    expect(mockDrinkPlanDelete).not.toHaveBeenCalled()
    expect(mockTransaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })
  })

  it('bill_requested グループが使用中なら 409 を返す', async () => {
    mockDrinkPlanFindFirst.mockResolvedValue({ id: 1 })
    mockCourseFindFirst.mockResolvedValue(null)
    mockGroupFindFirst.mockResolvedValue({ id: 'group-2', status: 'bill_requested' })
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/drink-plans/1',
      headers: { cookie: `token=${token()}` },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({
      error: { message: '使用中の飲み放題プランは削除できません' },
    })
    expect(mockDrinkPlanDelete).not.toHaveBeenCalled()
  })

  it('コースから参照されていれば 409 を返す', async () => {
    mockDrinkPlanFindFirst.mockResolvedValue({ id: 1 })
    mockCourseFindFirst.mockResolvedValue({ id: 1 })
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/drink-plans/1',
      headers: { cookie: `token=${token()}` },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({
      error: { message: 'コースから参照されているため削除できません' },
    })
    expect(mockDrinkPlanDelete).not.toHaveBeenCalled()
  })

  it('使用中グループがなければ 204 を返す', async () => {
    mockDrinkPlanFindFirst.mockResolvedValue({ id: 1 })
    mockCourseFindFirst.mockResolvedValue(null)
    mockGroupFindFirst.mockResolvedValue(null)
    mockDrinkPlanDelete.mockResolvedValue({})
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/drink-plans/1',
      headers: { cookie: `token=${token()}` },
    })
    expect(res.statusCode).toBe(204)
    expect(mockDrinkPlanDelete).toHaveBeenCalledWith({ where: { id: 1 } })
    expect(mockIoEmit).toHaveBeenCalledWith('drinkPlan:deleted', 1)
    expect(mockTransaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })
  })

  it('過去グループの OrderItem があれば警告ログを出して削除する', async () => {
    mockDrinkPlanFindFirst.mockResolvedValue({ id: 1 })
    mockCourseFindFirst.mockResolvedValue(null)
    mockGroupFindFirst.mockResolvedValue(null)
    mockOrderItemCount.mockResolvedValue(2)
    mockDrinkPlanDelete.mockResolvedValue({})
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/drink-plans/1',
      headers: { cookie: `token=${token()}` },
    })
    expect(res.statusCode).toBe(204)
    expect(warnSpy).toHaveBeenCalledWith(
      { drinkPlanId: 1, storeId: STORE_ID, referencedOrderItemCount: 2 },
      '飲み放題プラン削除により過去グループの drinkPlanId 参照が失われます',
    )
  })

  it('過去グループの OrderItem がなければ警告ログを出さない', async () => {
    mockDrinkPlanFindFirst.mockResolvedValue({ id: 1 })
    mockCourseFindFirst.mockResolvedValue(null)
    mockGroupFindFirst.mockResolvedValue(null)
    mockOrderItemCount.mockResolvedValue(0)
    mockDrinkPlanDelete.mockResolvedValue({})
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/drink-plans/1',
      headers: { cookie: `token=${token()}` },
    })
    expect(res.statusCode).toBe(204)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('closed グループの drinkPlanId 参照があれば警告ログを出して削除する', async () => {
    mockDrinkPlanFindFirst.mockResolvedValue({ id: 1 })
    mockCourseFindFirst.mockResolvedValue(null)
    mockGroupFindFirst.mockResolvedValue(null)
    mockGroupCount.mockResolvedValue(4)
    mockDrinkPlanDelete.mockResolvedValue({})
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/drink-plans/1',
      headers: { cookie: `token=${token()}` },
    })
    expect(res.statusCode).toBe(204)
    expect(warnSpy).toHaveBeenCalledWith(
      { drinkPlanId: 1, storeId: STORE_ID, closedGroupCount: 4 },
      '飲み放題プラン削除により過去の closed グループの drinkPlanId 参照が失われます',
    )
  })

  it('closed グループの drinkPlanId 参照がなければ警告ログを出さない（回帰確認）', async () => {
    mockDrinkPlanFindFirst.mockResolvedValue({ id: 1 })
    mockCourseFindFirst.mockResolvedValue(null)
    mockGroupFindFirst.mockResolvedValue(null)
    mockGroupCount.mockResolvedValue(0)
    mockOrderItemCount.mockResolvedValue(2)
    mockDrinkPlanDelete.mockResolvedValue({})
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/drink-plans/1',
      headers: { cookie: `token=${token()}` },
    })
    expect(res.statusCode).toBe(204)
    expect(mockDrinkPlanDelete).toHaveBeenCalledWith({ where: { id: 1 } })
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledWith(
      { drinkPlanId: 1, storeId: STORE_ID, referencedOrderItemCount: 2 },
      '飲み放題プラン削除により過去グループの drinkPlanId 参照が失われます',
    )
  })

  it('存在しない ID で削除すると 404 を返す', async () => {
    mockDrinkPlanFindFirst.mockResolvedValue(null)
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/drink-plans/999',
      headers: { cookie: `token=${token()}` },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ error: { message: '飲み放題プランが見つかりません' } })
    expect(mockDrinkPlanDelete).not.toHaveBeenCalled()
  })

  it('Serializable 分離レベルでの書き込み競合（P2034）でも 409 を返す', async () => {
    mockTransaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Transaction failed due to a write conflict', {
        code: 'P2034',
        clientVersion: '5.17.0',
      }),
    )
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/drink-plans/1',
      headers: { cookie: `token=${token()}` },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({
      error: { message: '使用中の飲み放題プランは削除できません' },
    })
    expect(mockDrinkPlanDelete).not.toHaveBeenCalled()
    expect(mockTransaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })
  })
})

describe('POST /api/drink-plans — storeId 検証', () => {
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

  function token() {
    return app.jwt.sign({
      type: 'staff' as const,
      userId: ADMIN_ID,
      username: 'admin',
      role: 'admin',
      storeId: STORE_ID,
    })
  }

  it('他店舗の menuItemId を含む場合は 422 を返す', async () => {
    mockMenuItemCount.mockResolvedValue(1)
    const res = await app.inject({
      method: 'POST',
      url: '/api/drink-plans',
      headers: { cookie: `token=${token()}` },
      payload: { name: '飲み放題A', price: 3000, menuItemIds: [1, 2] },
    })
    expect(res.statusCode).toBe(422)
    expect(res.json()).toMatchObject({ error: { message: 'メニューが見つかりません' } })
    expect(mockDrinkPlanCreate).not.toHaveBeenCalled()
  })

  it('自店舗の menuItemId のみなら作成できる', async () => {
    mockMenuItemCount.mockResolvedValue(2)
    mockDrinkPlanCreate.mockResolvedValue({
      id: 1,
      name: '飲み放題A',
      price: 3000,
      items: [{ menuItemId: 1 }, { menuItemId: 2 }],
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/drink-plans',
      headers: { cookie: `token=${token()}` },
      payload: { name: '飲み放題A', price: 3000, menuItemIds: [1, 2] },
    })
    expect(res.statusCode).toBe(201)
    expect(mockDrinkPlanCreate).toHaveBeenCalled()
    expect(mockIoEmit).toHaveBeenCalledWith('drinkPlan:created', expect.objectContaining({ id: 1 }))
  })
})

describe('PUT /api/drink-plans/:id — storeId 検証', () => {
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

  function token() {
    return app.jwt.sign({
      type: 'staff' as const,
      userId: ADMIN_ID,
      username: 'admin',
      role: 'admin',
      storeId: STORE_ID,
    })
  }

  it('他店舗の menuItemId を含む場合は 422 を返す', async () => {
    mockDrinkPlanFindFirst.mockResolvedValue({ id: 1 })
    mockMenuItemCount.mockResolvedValue(0)
    const res = await app.inject({
      method: 'PUT',
      url: '/api/drink-plans/1',
      headers: { cookie: `token=${token()}` },
      payload: { menuItemIds: [99] },
    })
    expect(res.statusCode).toBe(422)
    expect(res.json()).toMatchObject({ error: { message: 'メニューが見つかりません' } })
    expect(mockDrinkPlanUpdate).not.toHaveBeenCalled()
  })

  it('更新に成功すると drinkPlan:updated を emit する', async () => {
    mockDrinkPlanFindFirst.mockResolvedValue({ id: 1 })
    mockDrinkPlanUpdate.mockResolvedValue({ id: 1, name: '飲み放題B', price: 3500, items: [] })
    const res = await app.inject({
      method: 'PUT',
      url: '/api/drink-plans/1',
      headers: { cookie: `token=${token()}` },
      payload: { name: '飲み放題B', price: 3500 },
    })
    expect(res.statusCode).toBe(200)
    expect(mockIoEmit).toHaveBeenCalledWith(
      'drinkPlan:updated',
      expect.objectContaining({ id: 1, name: '飲み放題B' }),
    )
  })
})
