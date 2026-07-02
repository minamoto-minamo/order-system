import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'

type FakeOrderItem = {
  menuItemId: number | null
  menuItemName: string
  price: number
  qty: number
  isCourseCharge: boolean
  courseId: number | null
  taxRate: { toNumber(): number }
  orderedAt: Date
  menuItem: { category: { name: string }; subCategory: { name: string } } | null
}

const mockSessionFindFirst = jest.fn<(...args: unknown[]) => Promise<{ id: number } | null>>()
const mockGroupFindMany = jest.fn<(...args: unknown[]) => Promise<unknown[]>>()
const mockOrderItemFindMany = jest.fn<(...args: unknown[]) => Promise<FakeOrderItem[]>>()
const mockSeatCount = jest.fn<(...args: unknown[]) => Promise<number>>()

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    session: { findFirst: mockSessionFindFirst },
    group: { findMany: mockGroupFindMany },
    orderItem: { findMany: mockOrderItemFindMany },
    seat: { count: mockSeatCount },
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
    catch { reply.status(401).send({ error: '認証が必要です' }) }
  })
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
})
