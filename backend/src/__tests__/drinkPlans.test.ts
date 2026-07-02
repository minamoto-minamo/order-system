import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'

const mockDrinkPlanFindFirst = jest.fn<(...args: unknown[]) => Promise<{ id: number } | null>>()
const mockCourseFindFirst = jest.fn<(...args: unknown[]) => Promise<{ id: number } | null>>()
const mockGroupFindFirst = jest.fn<(...args: unknown[]) => Promise<{ id: string; status: string } | null>>()
const mockDrinkPlanDelete = jest.fn<(...args: unknown[]) => Promise<unknown>>()

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    course: { findFirst: mockCourseFindFirst },
    group: { findFirst: mockGroupFindFirst },
    drinkPlan: { findFirst: mockDrinkPlanFindFirst, delete: mockDrinkPlanDelete },
  },
}))

const { default: drinkPlansRoutes } = await import('../routes/drinkPlans.js')

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
    expect(res.json()).toMatchObject({ error: '使用中の飲み放題プランは削除できません' })
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
    expect(res.json()).toMatchObject({ error: '使用中の飲み放題プランは削除できません' })
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
    expect(res.json()).toMatchObject({ error: 'コースから参照されているため削除できません' })
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
  })

  it('存在しない ID で削除すると 404 を返す', async () => {
    mockDrinkPlanFindFirst.mockResolvedValue(null)
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/drink-plans/999',
      headers: { cookie: `token=${token()}` },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ error: '飲み放題プランが見つかりません' })
    expect(mockDrinkPlanDelete).not.toHaveBeenCalled()
  })
})
