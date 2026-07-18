import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import Fastify from 'fastify'

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

const mockEmit = jest.fn()

async function buildTestApp() {
  const app = Fastify({ logger: false })
  app.decorateRequest('storeId', 0)
  app.addHook('onRequest', async (request) => {
    request.storeId = STORE_ID
  })
  await app.register(cookie)
  await app.register(jwt, { secret: SECRET, cookie: { cookieName: 'token', signed: false } })
  app.decorate('io', { to: () => ({ emit: mockEmit }) } as never)
  app.addHook('preHandler', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      reply.status(401).send({
        error: { code: 'auth.session.required', message: '認証が必要です', details: null },
      })
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
      method: 'GET',
      url: '/api/settings',
      headers: {
        cookie: `token=${app.jwt.sign({ type: 'staff' as const, userId: ADMIN_ID, username: 'a', role: 'admin', storeId: STORE_ID })}`,
      },
    })
    expect(res.json()).toMatchObject({
      taxInclusive: false,
      refreshTokenAutoExtend: true,
      refreshTokenExpiresMinutes: 1440,
    })
    await app.close()
  })

  it('DB に保存された値があればそれを返す', async () => {
    const app = await buildTestApp()
    mockFindUnique.mockResolvedValue({
      storeName: 's',
      closingTime: '23:00',
      taxRateInHouse: decimal(10),
      taxRateTakeout: decimal(8),
      taxInclusive: true,
      refreshTokenAutoExtend: false,
      refreshTokenExpiresMinutes: 60,
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/settings',
      headers: {
        cookie: `token=${app.jwt.sign({ type: 'staff' as const, userId: ADMIN_ID, username: 'a', role: 'admin', storeId: STORE_ID })}`,
      },
    })
    expect(res.json()).toMatchObject({
      taxInclusive: true,
      refreshTokenAutoExtend: false,
      refreshTokenExpiresMinutes: 60,
    })
    await app.close()
  })
})

describe('PUT /api/settings', () => {
  it('refreshTokenAutoExtend / refreshTokenExpiresMinutes を更新できる', async () => {
    const app = await buildTestApp()
    mockUpsert.mockResolvedValue({
      storeName: 's',
      closingTime: '23:00',
      taxRateInHouse: decimal(10),
      taxRateTakeout: decimal(8),
      taxInclusive: true,
      refreshTokenAutoExtend: false,
      refreshTokenExpiresMinutes: 120,
    })
    const res = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: {
        cookie: `token=${app.jwt.sign({ type: 'staff' as const, userId: ADMIN_ID, username: 'a', role: 'admin', storeId: STORE_ID })}`,
      },
      payload: { refreshTokenAutoExtend: false, refreshTokenExpiresMinutes: 120 },
    })
    expect(res.statusCode).toBe(200)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { refreshTokenAutoExtend: false, refreshTokenExpiresMinutes: 120 },
      }),
    )
    await app.close()
  })

  it('taxInclusive を更新できる', async () => {
    const app = await buildTestApp()
    mockUpsert.mockResolvedValue({
      storeName: 's',
      closingTime: '23:00',
      taxRateInHouse: decimal(10),
      taxRateTakeout: decimal(8),
      taxInclusive: true,
      refreshTokenAutoExtend: true,
      refreshTokenExpiresMinutes: 1440,
    })
    const res = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: {
        cookie: `token=${app.jwt.sign({ type: 'staff' as const, userId: ADMIN_ID, username: 'a', role: 'admin', storeId: STORE_ID })}`,
      },
      payload: { taxInclusive: true },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ taxInclusive: true })
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { taxInclusive: true },
      }),
    )
    await app.close()
  })

  it('refreshTokenExpiresMinutes が範囲外の場合は 400 を返す', async () => {
    const app = await buildTestApp()
    const res = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: {
        cookie: `token=${app.jwt.sign({ type: 'staff' as const, userId: ADMIN_ID, username: 'a', role: 'admin', storeId: STORE_ID })}`,
      },
      payload: { refreshTokenExpiresMinutes: 1 },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('admin 以外のロールの場合は 403 を返す', async () => {
    const app = await buildTestApp()
    const res = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: {
        cookie: `token=${app.jwt.sign({ type: 'staff' as const, userId: 'staff-1', username: 's', role: 'staff', storeId: STORE_ID })}`,
      },
      payload: { storeName: 'x' },
    })
    expect(res.statusCode).toBe(403)
    expect(mockUpsert).not.toHaveBeenCalled()
    await app.close()
  })

  it('settings:updated には内部設定値（税率・リフレッシュトークン設定）を含めず storeName/closingTime のみを配信する', async () => {
    const app = await buildTestApp()
    mockUpsert.mockResolvedValue({
      storeName: 's',
      closingTime: '22:00',
      taxRateInHouse: decimal(10),
      taxRateTakeout: decimal(8),
      taxInclusive: true,
      refreshTokenAutoExtend: false,
      refreshTokenExpiresMinutes: 120,
    })
    const res = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: {
        cookie: `token=${app.jwt.sign({ type: 'staff' as const, userId: ADMIN_ID, username: 'a', role: 'admin', storeId: STORE_ID })}`,
      },
      payload: { closingTime: '22:00' },
    })
    expect(res.statusCode).toBe(200)
    expect(mockEmit).toHaveBeenCalledWith('settings:updated', {
      storeName: 's',
      closingTime: '22:00',
    })
    await app.close()
  })
})
