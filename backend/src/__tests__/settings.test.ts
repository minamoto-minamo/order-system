import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'

const mockFindUnique = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockUpsert = jest.fn<(...args: unknown[]) => Promise<unknown>>()

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: { setting: { findUnique: mockFindUnique, upsert: mockUpsert } },
}))

const { default: settingsRoutes } = await import('../routes/settings.js')

const SECRET = 'test-secret'
const ADMIN_ID = 'admin-1'
const STORE_ID = 1

function decimal(n: number) {
  return { toNumber: () => n }
}

async function buildTestApp() {
  const app = Fastify({ logger: false })
  app.decorateRequest('storeId', 0)
  app.addHook('onRequest', async (request) => { request.storeId = STORE_ID })
  await app.register(cookie)
  await app.register(jwt, { secret: SECRET, cookie: { cookieName: 'token', signed: false } })
  app.decorate('io', { to: () => ({ emit: jest.fn() }) } as never)
  app.addHook('preHandler', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      reply.status(401).send({ error: '認証が必要です' })
    }
  })
  await app.register(settingsRoutes, { prefix: '/api/settings' })
  await app.ready()
  return app
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('GET /api/settings', () => {
  it('リフレッシュトークン設定のデフォルト値を含めて返す', async () => {
    const app = await buildTestApp()
    mockFindUnique.mockResolvedValue(null)
    const res = await app.inject({
      method: 'GET', url: '/api/settings',
      headers: { cookie: `token=${app.jwt.sign({ type: 'staff' as const, userId: ADMIN_ID, username: 'a', role: 'admin', storeId: STORE_ID })}` },
    })
    expect(res.json()).toMatchObject({ refreshTokenAutoExtend: true, refreshTokenExpiresMinutes: 1440 })
    await app.close()
  })

  it('DB に保存された値があればそれを返す', async () => {
    const app = await buildTestApp()
    mockFindUnique.mockResolvedValue({
      storeName: 's', closingTime: '23:00',
      taxRateInHouse: decimal(10), taxRateTakeout: decimal(8),
      refreshTokenAutoExtend: false, refreshTokenExpiresMinutes: 60,
    })
    const res = await app.inject({
      method: 'GET', url: '/api/settings',
      headers: { cookie: `token=${app.jwt.sign({ type: 'staff' as const, userId: ADMIN_ID, username: 'a', role: 'admin', storeId: STORE_ID })}` },
    })
    expect(res.json()).toMatchObject({ refreshTokenAutoExtend: false, refreshTokenExpiresMinutes: 60 })
    await app.close()
  })
})

describe('PUT /api/settings', () => {
  it('refreshTokenAutoExtend / refreshTokenExpiresMinutes を更新できる', async () => {
    const app = await buildTestApp()
    mockUpsert.mockResolvedValue({
      storeName: 's', closingTime: '23:00',
      taxRateInHouse: decimal(10), taxRateTakeout: decimal(8),
      refreshTokenAutoExtend: false, refreshTokenExpiresMinutes: 120,
    })
    const res = await app.inject({
      method: 'PUT', url: '/api/settings',
      headers: { cookie: `token=${app.jwt.sign({ type: 'staff' as const, userId: ADMIN_ID, username: 'a', role: 'admin', storeId: STORE_ID })}` },
      payload: { refreshTokenAutoExtend: false, refreshTokenExpiresMinutes: 120 },
    })
    expect(res.statusCode).toBe(200)
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
      update: { refreshTokenAutoExtend: false, refreshTokenExpiresMinutes: 120 },
    }))
    await app.close()
  })

  it('refreshTokenExpiresMinutes が範囲外の場合は 400 を返す', async () => {
    const app = await buildTestApp()
    const res = await app.inject({
      method: 'PUT', url: '/api/settings',
      headers: { cookie: `token=${app.jwt.sign({ type: 'staff' as const, userId: ADMIN_ID, username: 'a', role: 'admin', storeId: STORE_ID })}` },
      payload: { refreshTokenExpiresMinutes: 1 },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('admin 以外のロールの場合は 403 を返す', async () => {
    const app = await buildTestApp()
    const res = await app.inject({
      method: 'PUT', url: '/api/settings',
      headers: { cookie: `token=${app.jwt.sign({ type: 'staff' as const, userId: 'staff-1', username: 's', role: 'staff', storeId: STORE_ID })}` },
      payload: { storeName: 'x' },
    })
    expect(res.statusCode).toBe(403)
    expect(mockUpsert).not.toHaveBeenCalled()
    await app.close()
  })
})
