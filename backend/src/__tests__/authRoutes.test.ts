import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import bcrypt from 'bcryptjs'

process.env.JWT_SECRET = 'test-secret'
process.env.ACCESS_TOKEN_EXPIRES_IN = '15m'

const mockFindUniqueStaff = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockIssueRefreshToken = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockRevokeTokenByRaw = jest.fn<(...args: unknown[]) => Promise<void>>()
const mockVerifyRefreshToken = jest.fn<(...args: unknown[]) => Promise<unknown>>()

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: { staff: { findUnique: mockFindUniqueStaff } },
}))

jest.unstable_mockModule('../lib/refreshToken.js', () => ({
  issueRefreshToken: mockIssueRefreshToken,
  revokeTokenByRaw: mockRevokeTokenByRaw,
  verifyRefreshToken: mockVerifyRefreshToken,
  rotateRefreshToken: jest.fn(),
}))

const { default: authRoutes } = await import('../routes/auth.js')

const STORE_ID = 1

function buildMockIo() {
  const disconnectSockets = jest.fn()
  const inFn = jest.fn((_room: string) => ({ disconnectSockets }))
  return { inFn, disconnectSockets }
}

async function buildTestApp(io = buildMockIo()) {
  const app = Fastify({ logger: false })
  app.decorateRequest('storeId', 0)
  app.addHook('onRequest', async (request) => { request.storeId = STORE_ID })
  app.decorate('io', { in: io.inFn } as never)
  await app.register(cookie)
  await app.register(jwt, { secret: 'test-secret', cookie: { cookieName: 'token', signed: false } })
  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.ready()
  return app
}

const PASSWORD_HASH = bcrypt.hashSync('correct-password', 4)
const STAFF = { id: 'staff-1', username: 'taro', role: 'staff', storeId: STORE_ID, passwordHash: PASSWORD_HASH }

beforeEach(() => {
  jest.clearAllMocks()
  mockVerifyRefreshToken.mockResolvedValue({ status: 'invalid' })
})

describe('POST /api/auth/login', () => {
  it('認証成功時にアクセストークンとリフレッシュトークンの cookie をセットする', async () => {
    const app = await buildTestApp()
    mockFindUniqueStaff.mockResolvedValue(STAFF)
    const expiresAt = new Date(Date.now() + 1440 * 60_000)
    mockIssueRefreshToken.mockResolvedValue({ raw: 'new-raw-token', id: 'token-1', expiresAt })

    const res = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { username: 'taro', password: 'correct-password' },
    })

    expect(res.statusCode).toBe(200)
    expect(mockIssueRefreshToken).toHaveBeenCalledWith(STAFF.storeId, STAFF.id, expect.objectContaining({ userAgent: expect.anything() }))
    const setCookies = res.cookies
    expect(setCookies.find(c => c.name === 'token')).toBeTruthy()
    expect(setCookies.find(c => c.name === 'refresh_token')?.value).toBe('new-raw-token')
    await app.close()
  })

  it('パスワード不一致の場合は 401 を返し cookie をセットしない', async () => {
    const app = await buildTestApp()
    mockFindUniqueStaff.mockResolvedValue(STAFF)

    const res = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { username: 'taro', password: 'wrong-password' },
    })

    expect(res.statusCode).toBe(401)
    expect(mockIssueRefreshToken).not.toHaveBeenCalled()
    expect(res.cookies.length).toBe(0)
    await app.close()
  })
})

describe('POST /api/auth/logout', () => {
  it('refresh_token cookie がある場合は revokeTokenByRaw を呼び cookie をクリアする', async () => {
    const app = await buildTestApp()

    const res = await app.inject({
      method: 'POST', url: '/api/auth/logout',
      headers: { cookie: 'refresh_token=raw-token-value' },
    })

    expect(res.statusCode).toBe(200)
    expect(mockRevokeTokenByRaw).toHaveBeenCalledWith('raw-token-value')
    const setCookies = res.cookies
    expect(setCookies.find(c => c.name === 'token')?.value).toBe('')
    expect(setCookies.find(c => c.name === 'refresh_token')?.value).toBe('')
    await app.close()
  })

  it('refresh_token cookie が無い場合は revokeTokenByRaw を呼ばない', async () => {
    const app = await buildTestApp()

    const res = await app.inject({ method: 'POST', url: '/api/auth/logout' })

    expect(res.statusCode).toBe(200)
    expect(mockRevokeTokenByRaw).not.toHaveBeenCalled()
    await app.close()
  })

  it('有効な refresh_token から staffId を特定できた場合、その user ルームの Socket.io 接続を強制切断する', async () => {
    const io = buildMockIo()
    const app = await buildTestApp(io)
    mockVerifyRefreshToken.mockResolvedValue({ status: 'valid', staffId: 'staff-1' })

    const res = await app.inject({
      method: 'POST', url: '/api/auth/logout',
      headers: { cookie: 'refresh_token=raw-token-value' },
    })

    expect(res.statusCode).toBe(200)
    expect(io.inFn).toHaveBeenCalledWith('user:staff-1')
    expect(io.disconnectSockets).toHaveBeenCalledWith(true)
    await app.close()
  })

  it('refresh_token が無効でもアクセストークンが有効なら、そこから staffId を特定して強制切断する', async () => {
    const io = buildMockIo()
    const app = await buildTestApp(io)
    const accessApp = Fastify({ logger: false })
    await accessApp.register(jwt, { secret: 'test-secret' })
    const accessToken = accessApp.jwt.sign({ type: 'staff', userId: 'staff-2', username: 'taro', role: 'staff', storeId: STORE_ID })
    await accessApp.close()

    const res = await app.inject({
      method: 'POST', url: '/api/auth/logout',
      headers: { cookie: `token=${accessToken}` },
    })

    expect(res.statusCode).toBe(200)
    expect(io.inFn).toHaveBeenCalledWith('user:staff-2')
    expect(io.disconnectSockets).toHaveBeenCalledWith(true)
    await app.close()
  })

  it('refresh_token・アクセストークンのいずれからも staffId を特定できない場合は強制切断しない', async () => {
    const io = buildMockIo()
    const app = await buildTestApp(io)

    const res = await app.inject({ method: 'POST', url: '/api/auth/logout' })

    expect(res.statusCode).toBe(200)
    expect(io.inFn).not.toHaveBeenCalled()
    await app.close()
  })
})
