import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import bcrypt from 'bcryptjs'
import Fastify from 'fastify'

process.env.JWT_SECRET = 'test-secret'

const mockFindUniquePlatformAdmin = jest.fn<(...args: unknown[]) => Promise<unknown>>()

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: { platformAdmin: { findUnique: mockFindUniquePlatformAdmin } },
}))

const { default: platformAuthRoutes } = await import('../routes/platformAuth.js')

async function buildTestApp(fastifyOpts: { trustProxy?: boolean } = {}) {
  const app = Fastify({ logger: false, ...fastifyOpts })
  await app.register(cookie)
  await app.register(jwt, {
    secret: 'test-secret',
    cookie: { cookieName: 'platform_token', signed: false },
  })
  await app.register(platformAuthRoutes, { prefix: '/api/platform/auth' })
  await app.ready()
  return app
}

const PASSWORD_HASH = bcrypt.hashSync('correct-password', 4)
const ADMIN = { id: 'admin-1', username: 'platform-admin', passwordHash: PASSWORD_HASH }
const DUMMY_PASSWORD_HASH = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8O.MSTGeVWmSVmDsBiAGXH6XHJXxYm'

beforeEach(() => {
  jest.clearAllMocks()
})

describe('POST /api/platform/auth/login', () => {
  it('パスワード不一致の場合は 401 を返し cookie をセットしない', async () => {
    const app = await buildTestApp()
    mockFindUniquePlatformAdmin.mockResolvedValue(ADMIN)
    const compareSpy = jest.spyOn(bcrypt, 'compare')

    const res = await app.inject({
      method: 'POST',
      url: '/api/platform/auth/login',
      payload: { username: 'platform-admin', password: 'wrong-password' },
    })

    expect(res.statusCode).toBe(401)
    expect(compareSpy).toHaveBeenCalledWith('wrong-password', ADMIN.passwordHash)
    expect(res.cookies.length).toBe(0)
    await app.close()
  })

  it('管理者不在の場合もダミーハッシュで比較して 401 を返す', async () => {
    const app = await buildTestApp()
    mockFindUniquePlatformAdmin.mockResolvedValue(null)
    const compareSpy = jest.spyOn(bcrypt, 'compare')

    const res = await app.inject({
      method: 'POST',
      url: '/api/platform/auth/login',
      payload: { username: 'missing', password: 'wrong-password' },
    })

    expect(res.statusCode).toBe(401)
    expect(compareSpy).toHaveBeenCalledWith('wrong-password', DUMMY_PASSWORD_HASH)
    expect(res.cookies.length).toBe(0)
    await app.close()
  })
})
