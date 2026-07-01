import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'

type Group = { id: string; status: string; courseId: number | null; drinkPlanId: number | null }
type Course = { id: number; name: string; price: number; drinkPlanId: number | null; foodItems: { menuItemId: number; qty: number }[] }

const mockGroupFindUnique  = jest.fn<(...args: unknown[]) => Promise<Group | null>>()
const mockCourseFindUnique = jest.fn<(...args: unknown[]) => Promise<Course | null>>()
const mockSettingFindUnique = jest.fn<(...args: unknown[]) => Promise<{ taxRateInHouse: { toNumber(): number } } | null>>()
const mockGroupUpdate      = jest.fn<(...args: unknown[]) => Promise<unknown>>()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockTransaction = jest.fn<(cb: (tx: any) => Promise<any>) => Promise<any>>()

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    group:   { findUnique: mockGroupFindUnique, update: mockGroupUpdate },
    course:  { findUnique: mockCourseFindUnique },
    setting: { findUnique: mockSettingFindUnique },
    $transaction: mockTransaction,
  },
}))

const { default: groupsRoutes } = await import('../routes/groups.js')

const SECRET   = 'test-secret'
const ADMIN_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const GROUP_ID = 'gggggggg-gggg-gggg-gggg-gggggggggggg'

async function buildTestApp() {
  const app = Fastify({ logger: false })
  await app.register(cookie)
  await app.register(jwt, { secret: SECRET, cookie: { cookieName: 'token', signed: false } })
  app.addHook('preHandler', async (request, reply) => {
    try { await request.jwtVerify() }
    catch { reply.status(401).send({ error: '認証が必要です' }) }
  })
  // io.emit のスタブ（型チェックを回避するため any でキャスト）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.decorate('io', { to: () => ({ emit: jest.fn() }), emit: jest.fn() } as any)
  await app.register(groupsRoutes, { prefix: '/api/groups' })
  await app.ready()
  return app
}

function token(app: Awaited<ReturnType<typeof buildTestApp>>) {
  return app.jwt.sign({ userId: ADMIN_ID, username: 'admin', role: 'admin' })
}

describe('POST /api/groups/:id/course — コース適用', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  beforeAll(async () => { app = await buildTestApp() })
  afterAll(async () => { await app.close() })
  beforeEach(() => { jest.clearAllMocks() })

  it('グループが存在しない場合 404 を返す', async () => {
    mockGroupFindUnique.mockResolvedValue(null)
    const res = await app.inject({
      method: 'POST', url: `/api/groups/${GROUP_ID}/course`,
      headers: { cookie: `token=${token(app)}` },
      payload: { courseId: 1, qty: 2 },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ error: 'グループが見つかりません' })
  })

  it('グループが active でない場合 409 を返す', async () => {
    mockGroupFindUnique.mockResolvedValue({ id: GROUP_ID, status: 'bill_requested', courseId: null, drinkPlanId: null })
    const res = await app.inject({
      method: 'POST', url: `/api/groups/${GROUP_ID}/course`,
      headers: { cookie: `token=${token(app)}` },
      payload: { courseId: 1, qty: 2 },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: 'このグループにはコースを適用できません' })
  })

  it('コースが存在しない場合 404 を返す', async () => {
    mockGroupFindUnique.mockResolvedValue({ id: GROUP_ID, status: 'active', courseId: null, drinkPlanId: null })
    mockCourseFindUnique.mockResolvedValue(null)
    const res = await app.inject({
      method: 'POST', url: `/api/groups/${GROUP_ID}/course`,
      headers: { cookie: `token=${token(app)}` },
      payload: { courseId: 999, qty: 2 },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ error: 'コースが見つかりません' })
  })

  it('food items なしのコースを適用すると group が更新され 200 を返す', async () => {
    mockGroupFindUnique.mockResolvedValue({ id: GROUP_ID, status: 'active', courseId: null, drinkPlanId: null })
    mockCourseFindUnique.mockResolvedValue({ id: 1, name: 'ランチ', price: 0, drinkPlanId: null, foodItems: [] })
    mockSettingFindUnique.mockResolvedValue({ taxRateInHouse: { toNumber: () => 10 } })
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
    mockGroupFindUnique.mockResolvedValue({ id: GROUP_ID, status: 'active', courseId: null, drinkPlanId: null })
    mockCourseFindUnique.mockResolvedValue({ id: 1, name: 'ディナーコース', price: 3000, drinkPlanId: null, foodItems: [] })
    mockSettingFindUnique.mockResolvedValue({ taxRateInHouse: { toNumber: () => 10 } })
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
        taxRate: 10,
        courseId: 1,
      }),
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
    mockGroupUpdate.mockResolvedValue(clearedGroup)
    const res = await app.inject({
      method: 'DELETE', url: `/api/groups/${GROUP_ID}/course`,
      headers: { cookie: `token=${token(app)}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ courseId: null, drinkPlanId: null })
    expect(mockGroupUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: GROUP_ID },
      data: { courseId: null, drinkPlanId: null },
    }))
  })

  it('存在しないグループに対して 404 を返す', async () => {
    const { Prisma } = await import('@prisma/client')
    mockGroupUpdate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Not found', { code: 'P2025', clientVersion: '5.0.0' })
    )
    const res = await app.inject({
      method: 'DELETE', url: `/api/groups/nonexistent/course`,
      headers: { cookie: `token=${token(app)}` },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ error: 'グループが見つかりません' })
  })
})
