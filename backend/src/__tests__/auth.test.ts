import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import Fastify from 'fastify'

process.env.JWT_SECRET = 'test-secret'
process.env.ACCESS_TOKEN_EXPIRES_IN = '15m'

const mockFindUniqueStaff = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockRotateRefreshToken = jest.fn<(...args: unknown[]) => Promise<unknown>>()

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: { staff: { findUnique: mockFindUniqueStaff, findFirst: mockFindUniqueStaff } },
}))

jest.unstable_mockModule('../lib/refreshToken.js', () => ({
  rotateRefreshToken: mockRotateRefreshToken,
}))

const { default: authPlugin } = await import('../plugins/auth.js')

const STORE_ID = 1

async function buildTestApp() {
  const app = Fastify({ logger: false })
  app.decorateRequest('storeId', 0)
  app.addHook('onRequest', async (request) => { request.storeId = STORE_ID })
  await app.register(authPlugin)
  app.get('/api/protected', async (request) => {
    const user = request.user
    if (user.type !== 'staff') throw new Error('unexpected token type')
    return { userId: user.userId, role: user.role }
  })
  await app.ready()
  return app
}

const STAFF = { id: 'staff-1', username: 'taro', role: 'staff', storeId: STORE_ID }

beforeEach(() => {
  jest.clearAllMocks()
})

describe('auth plugin preHandler', () => {
  it('有効なアクセストークンならそのまま通過する', async () => {
    const app = await buildTestApp()
    const token = app.jwt.sign({ type: 'staff' as const, userId: STAFF.id, username: STAFF.username, role: STAFF.role, storeId: STAFF.storeId })
    const res = await app.inject({ method: 'GET', url: '/api/protected', headers: { cookie: `token=${token}` } })
    expect(res.statusCode).toBe(200)
    expect(mockRotateRefreshToken).not.toHaveBeenCalled()
    await app.close()
  })

  it('platform管理者トークンでstaff専用エンドポイントにアクセスすると401を返す（認可バイパス防止）', async () => {
    const app = await buildTestApp()
    const token = app.jwt.sign({ type: 'platform' as const, adminId: 'admin-1', username: 'platadmin' })
    const res = await app.inject({ method: 'GET', url: '/api/protected', headers: { cookie: `token=${token}` } })
    expect(res.statusCode).toBe(401)
    const setCookies = res.cookies
    expect(setCookies.find(c => c.name === 'token')?.value).toBe('')
    await app.close()
  })

  it('JWT内のstoreIdがHost由来のstoreIdと一致しない場合は401を返す（トークン再生防止）', async () => {
    const app = await buildTestApp()
    const token = app.jwt.sign({ type: 'staff' as const, userId: STAFF.id, username: STAFF.username, role: STAFF.role, storeId: STORE_ID + 1 })
    const res = await app.inject({ method: 'GET', url: '/api/protected', headers: { cookie: `token=${token}` } })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  it('アクセストークンが無く refresh_token も無い場合は 401 を返す', async () => {
    const app = await buildTestApp()
    const res = await app.inject({ method: 'GET', url: '/api/protected' })
    expect(res.statusCode).toBe(401)
    expect(mockRotateRefreshToken).not.toHaveBeenCalled()
    await app.close()
  })

  it('アクセストークン失効かつ refresh_token が rotated の場合、新アクセストークン+新リフレッシュcookieを発行して通過させる', async () => {
    const app = await buildTestApp()
    const expiresAt = new Date(Date.now() + 60_000)
    mockRotateRefreshToken.mockResolvedValue({
      status: 'rotated', staffId: STAFF.id, token: { raw: 'new-raw-token', id: 'child-1', expiresAt },
    })
    mockFindUniqueStaff.mockResolvedValue(STAFF)

    const res = await app.inject({
      method: 'GET', url: '/api/protected',
      headers: { cookie: 'token=invalid-or-expired; refresh_token=old-raw-token' },
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ userId: STAFF.id, role: STAFF.role })
    const setCookies = res.cookies
    expect(setCookies.find(c => c.name === 'token')).toBeTruthy()
    expect(setCookies.find(c => c.name === 'refresh_token')?.value).toBe('new-raw-token')
    await app.close()
  })

  it('アクセストークン失効かつ refresh_token が reused（猶予期間内重複）の場合、新アクセストークンのみ発行する', async () => {
    const app = await buildTestApp()
    mockRotateRefreshToken.mockResolvedValue({ status: 'reused', staffId: STAFF.id })
    mockFindUniqueStaff.mockResolvedValue(STAFF)

    const res = await app.inject({
      method: 'GET', url: '/api/protected',
      headers: { cookie: 'token=invalid-or-expired; refresh_token=old-raw-token' },
    })

    expect(res.statusCode).toBe(200)
    const setCookies = res.cookies
    expect(setCookies.find(c => c.name === 'token')).toBeTruthy()
    expect(setCookies.find(c => c.name === 'refresh_token')).toBeUndefined()
    await app.close()
  })

  it.each(['invalid', 'expired', 'reuse-detected'] as const)(
    'refresh_token が %s の場合は cookie を削除して 401 を返す',
    async (status) => {
      const app = await buildTestApp()
      mockRotateRefreshToken.mockResolvedValue({ status, staffId: STAFF.id })

      const res = await app.inject({
        method: 'GET', url: '/api/protected',
        headers: { cookie: 'token=invalid-or-expired; refresh_token=bad-raw-token' },
      })

      expect(res.statusCode).toBe(401)
      const setCookies = res.cookies
      expect(setCookies.find(c => c.name === 'token')?.value).toBe('')
      expect(setCookies.find(c => c.name === 'refresh_token')?.value).toBe('')
      await app.close()
    },
  )
})
