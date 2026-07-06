import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'

const mockDrinkPlanFindFirst = jest.fn<(...args: unknown[]) => Promise<{ id: number } | null>>()
const mockCourseFindFirst = jest.fn<(...args: unknown[]) => Promise<{ id: number } | null>>()
const mockGroupFindFirst = jest.fn<(...args: unknown[]) => Promise<{ id: string; status: string } | null>>()
const mockDrinkPlanDelete = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockDrinkPlanCreate = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockDrinkPlanUpdate = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockMenuItemCount = jest.fn<(...args: unknown[]) => Promise<number>>()

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    course: { findFirst: mockCourseFindFirst },
    group: { findFirst: mockGroupFindFirst },
    drinkPlan: { findFirst: mockDrinkPlanFindFirst, delete: mockDrinkPlanDelete, create: mockDrinkPlanCreate, update: mockDrinkPlanUpdate },
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
  app.addHook('onRequest', async (request) => { request.storeId = STORE_ID })
  await app.register(cookie)
  await app.register(jwt, { secret: SECRET, cookie: { cookieName: 'token', signed: false } })
  app.addHook('preHandler', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      reply.status(401).send({ error: { code: 'auth.session.required', message: '認証が必要です', details: null } })
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

  beforeAll(async () => { app = await buildTestApp() })
  afterAll(async () => { await app.close() })
  beforeEach(() => { jest.clearAllMocks() })

  function token() {
    return app.jwt.sign({ type: 'staff' as const, userId: ADMIN_ID, username: 'admin', role: 'admin', storeId: STORE_ID })
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
    expect(res.json()).toMatchObject({ error: { message: '使用中の飲み放題プランは削除できません' } })
    expect(mockDrinkPlanDelete).not.toHaveBeenCalled()
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
    expect(res.json()).toMatchObject({ error: { message: '使用中の飲み放題プランは削除できません' } })
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
    expect(res.json()).toMatchObject({ error: { message: 'コースから参照されているため削除できません' } })
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
})

describe('POST /api/drink-plans — storeId 検証', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>

  beforeAll(async () => { app = await buildTestApp() })
  afterAll(async () => { await app.close() })
  beforeEach(() => { jest.clearAllMocks() })

  function token() {
    return app.jwt.sign({ type: 'staff' as const, userId: ADMIN_ID, username: 'admin', role: 'admin', storeId: STORE_ID })
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
    mockDrinkPlanCreate.mockResolvedValue({ id: 1, name: '飲み放題A', price: 3000, items: [{ menuItemId: 1 }, { menuItemId: 2 }] })
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

  beforeAll(async () => { app = await buildTestApp() })
  afterAll(async () => { await app.close() })
  beforeEach(() => { jest.clearAllMocks() })

  function token() {
    return app.jwt.sign({ type: 'staff' as const, userId: ADMIN_ID, username: 'admin', role: 'admin', storeId: STORE_ID })
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
    expect(mockIoEmit).toHaveBeenCalledWith('drinkPlan:updated', expect.objectContaining({ id: 1, name: '飲み放題B' }))
  })
})
