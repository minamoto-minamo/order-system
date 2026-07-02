import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'

const mockGroupFindFirst = jest.fn<(...args: unknown[]) => Promise<{ id: string; status: string } | null>>()
const mockCourseFindFirst = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockCourseDelete = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockCourseCreate = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockCourseUpdate = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockMenuItemCount = jest.fn<(...args: unknown[]) => Promise<number>>()
const mockDrinkPlanFindFirst = jest.fn<(...args: unknown[]) => Promise<unknown>>()

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    group: { findFirst: mockGroupFindFirst },
    course: { findFirst: mockCourseFindFirst, delete: mockCourseDelete, create: mockCourseCreate, update: mockCourseUpdate },
    menuItem: { count: mockMenuItemCount },
    drinkPlan: { findFirst: mockDrinkPlanFindFirst },
  },
}))

const { default: coursesRoutes } = await import('../routes/courses.js')

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
    try {
      await request.jwtVerify()
    } catch {
      reply.status(401).send({ error: '認証が必要です' })
    }
  })
  await app.register(coursesRoutes, { prefix: '/api/courses' })
  await app.ready()
  return app
}

describe('DELETE /api/courses/:id — 削除制御', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>

  beforeAll(async () => { app = await buildTestApp() })
  afterAll(async () => { await app.close() })
  beforeEach(() => { jest.clearAllMocks() })

  function token() {
    return app.jwt.sign({ type: 'staff' as const, userId: ADMIN_ID, username: 'admin', role: 'admin', storeId: STORE_ID })
  }

  it('active グループが使用中なら 409 を返す', async () => {
    mockCourseFindFirst.mockResolvedValue({ id: 1 })
    mockGroupFindFirst.mockResolvedValue({ id: 'group-1', status: 'active' })
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/courses/1',
      headers: { cookie: `token=${token()}` },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: '使用中のコースは削除できません' })
    expect(mockCourseDelete).not.toHaveBeenCalled()
  })

  it('bill_requested グループが使用中なら 409 を返す', async () => {
    mockCourseFindFirst.mockResolvedValue({ id: 1 })
    mockGroupFindFirst.mockResolvedValue({ id: 'group-2', status: 'bill_requested' })
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/courses/1',
      headers: { cookie: `token=${token()}` },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: '使用中のコースは削除できません' })
    expect(mockCourseDelete).not.toHaveBeenCalled()
  })

  it('使用中グループがなければ 204 を返す', async () => {
    mockCourseFindFirst.mockResolvedValue({ id: 1 })
    mockGroupFindFirst.mockResolvedValue(null)
    mockCourseDelete.mockResolvedValue({})
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/courses/1',
      headers: { cookie: `token=${token()}` },
    })
    expect(res.statusCode).toBe(204)
    expect(mockCourseDelete).toHaveBeenCalledWith({ where: { id: 1 } })
  })

  it('存在しない ID で削除すると 404 を返す', async () => {
    mockCourseFindFirst.mockResolvedValue(null)
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/courses/999',
      headers: { cookie: `token=${token()}` },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ error: 'コースが見つかりません' })
    expect(mockCourseDelete).not.toHaveBeenCalled()
  })
})

describe('POST /api/courses — storeId 検証', () => {
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
      url: '/api/courses',
      headers: { cookie: `token=${token()}` },
      payload: { name: 'コースA', price: 3000, foodItems: [{ menuItemId: 1, qty: 1 }, { menuItemId: 2, qty: 1 }] },
    })
    expect(res.statusCode).toBe(422)
    expect(res.json()).toMatchObject({ error: 'メニューが見つかりません' })
    expect(mockCourseCreate).not.toHaveBeenCalled()
  })

  it('他店舗の drinkPlanId を指定した場合は 422 を返す', async () => {
    mockMenuItemCount.mockResolvedValue(1)
    mockDrinkPlanFindFirst.mockResolvedValue(null)
    const res = await app.inject({
      method: 'POST',
      url: '/api/courses',
      headers: { cookie: `token=${token()}` },
      payload: { name: 'コースA', price: 3000, drinkPlanId: 99, foodItems: [{ menuItemId: 1, qty: 1 }] },
    })
    expect(res.statusCode).toBe(422)
    expect(res.json()).toMatchObject({ error: '飲み放題プランが見つかりません' })
    expect(mockCourseCreate).not.toHaveBeenCalled()
  })

  it('自店舗の menuItemId / drinkPlanId のみなら作成できる', async () => {
    mockMenuItemCount.mockResolvedValue(1)
    mockDrinkPlanFindFirst.mockResolvedValue({ id: 5, storeId: STORE_ID })
    mockCourseCreate.mockResolvedValue({ id: 1, name: 'コースA', price: 3000, drinkPlanId: 5, foodItems: [{ menuItemId: 1, qty: 1 }] })
    const res = await app.inject({
      method: 'POST',
      url: '/api/courses',
      headers: { cookie: `token=${token()}` },
      payload: { name: 'コースA', price: 3000, drinkPlanId: 5, foodItems: [{ menuItemId: 1, qty: 1 }] },
    })
    expect(res.statusCode).toBe(201)
    expect(mockCourseCreate).toHaveBeenCalled()
  })
})

describe('PUT /api/courses/:id — storeId 検証', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>

  beforeAll(async () => { app = await buildTestApp() })
  afterAll(async () => { await app.close() })
  beforeEach(() => { jest.clearAllMocks() })

  function token() {
    return app.jwt.sign({ type: 'staff' as const, userId: ADMIN_ID, username: 'admin', role: 'admin', storeId: STORE_ID })
  }

  it('他店舗の menuItemId を含む foodItems への更新は 422 を返す', async () => {
    mockCourseFindFirst.mockResolvedValue({ id: 1, storeId: STORE_ID })
    mockMenuItemCount.mockResolvedValue(0)
    const res = await app.inject({
      method: 'PUT',
      url: '/api/courses/1',
      headers: { cookie: `token=${token()}` },
      payload: { foodItems: [{ menuItemId: 99, qty: 1 }] },
    })
    expect(res.statusCode).toBe(422)
    expect(res.json()).toMatchObject({ error: 'メニューが見つかりません' })
    expect(mockCourseUpdate).not.toHaveBeenCalled()
  })
})
