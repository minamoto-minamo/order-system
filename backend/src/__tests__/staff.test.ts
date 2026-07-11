import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals'
import Fastify from 'fastify'

const mockFindFirst =
  jest.fn<(...args: unknown[]) => Promise<{ id: string; username: string; role: string } | null>>()
const mockDelete = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockUpdate = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockListActiveSessions = jest.fn<(...args: unknown[]) => Promise<unknown[]>>()
const mockRevokeTokenById = jest.fn<(...args: unknown[]) => Promise<boolean>>()

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    staff: {
      findUnique: jest.fn(),
      delete: mockDelete,
      findMany: jest.fn(),
      findFirst: mockFindFirst,
      create: jest.fn(),
      update: mockUpdate,
    },
  },
}))

jest.unstable_mockModule('../lib/refreshToken.js', () => ({
  listActiveSessions: mockListActiveSessions,
  revokeTokenById: mockRevokeTokenById,
  rotateRefreshToken: jest.fn(),
}))

const { default: staffRoutes } = await import('../routes/staff.js')

const ADMIN_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const OTHER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const SECRET = 'test-secret'
const STORE_ID = 1

function buildMockIo() {
  const disconnectSockets = jest.fn()
  const inFn = jest.fn((_room: string) => ({ disconnectSockets }))
  return { inFn, disconnectSockets }
}

async function buildTestApp(io = buildMockIo()) {
  const app = Fastify({ logger: false })
  app.decorateRequest('storeId', 0)
  app.addHook('onRequest', async (request) => {
    request.storeId = STORE_ID
  })
  app.decorate('io', { in: io.inFn } as never)
  await app.register(cookie)
  await app.register(jwt, { secret: SECRET, cookie: { cookieName: 'token', signed: false } })
  app.addHook('preHandler', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      reply.status(401).send({
        error: { code: 'auth.session.required', message: '認証が必要です', details: null },
      })
    }
  })
  await app.register(staffRoutes, { prefix: '/api/staff' })
  await app.ready()
  return app
}

describe('DELETE /api/staff/:id — 自己削除ガード', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  const io = buildMockIo()

  beforeAll(async () => {
    app = await buildTestApp(io)
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  function token(userId: string) {
    return app.jwt.sign({
      type: 'staff' as const,
      userId,
      username: 'admin',
      role: 'admin',
      storeId: STORE_ID,
    })
  }

  it('自分自身のIDで DELETE すると 422 を返す', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/staff/${ADMIN_ID}`,
      headers: { cookie: `token=${token(ADMIN_ID)}` },
    })
    expect(res.statusCode).toBe(422)
    expect(res.json()).toMatchObject({ error: { message: '自分自身は削除できません' } })
    expect(mockFindFirst).not.toHaveBeenCalled()
    expect(io.inFn).not.toHaveBeenCalled()
  })

  it('他スタッフのIDで DELETE すると自己削除ガードを通過し、対象の Socket 接続を切断する', async () => {
    mockFindFirst.mockResolvedValue({ id: OTHER_ID, username: 'other', role: 'staff' })
    mockDelete.mockResolvedValue({})

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/staff/${OTHER_ID}`,
      headers: { cookie: `token=${token(ADMIN_ID)}` },
    })
    expect(res.statusCode).toBe(204)
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: OTHER_ID } })
    expect(io.inFn).toHaveBeenCalledWith(`user:${OTHER_ID}`)
    expect(io.disconnectSockets).toHaveBeenCalledWith(true)
  })
})

describe('PUT /api/staff/:id — ロール変更時の Socket 切断', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  const io = buildMockIo()

  beforeAll(async () => {
    app = await buildTestApp(io)
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  function token(userId: string) {
    return app.jwt.sign({
      type: 'staff' as const,
      userId,
      username: 'admin',
      role: 'admin',
      storeId: STORE_ID,
    })
  }

  it('role を変更すると対象スタッフの Socket 接続を切断する', async () => {
    mockFindFirst.mockResolvedValue({ id: OTHER_ID, username: 'other', role: 'staff' })
    mockUpdate.mockResolvedValue({ id: OTHER_ID, username: 'other', role: 'admin' })

    const res = await app.inject({
      method: 'PUT',
      url: `/api/staff/${OTHER_ID}`,
      headers: { cookie: `token=${token(ADMIN_ID)}` },
      payload: { role: 'admin' },
    })
    expect(res.statusCode).toBe(200)
    expect(io.inFn).toHaveBeenCalledWith(`user:${OTHER_ID}`)
    expect(io.disconnectSockets).toHaveBeenCalledWith(true)
  })

  it('role が既存値と同じ場合は切断しない', async () => {
    mockFindFirst.mockResolvedValue({ id: OTHER_ID, username: 'other', role: 'staff' })
    mockUpdate.mockResolvedValue({ id: OTHER_ID, username: 'other', role: 'staff' })

    const res = await app.inject({
      method: 'PUT',
      url: `/api/staff/${OTHER_ID}`,
      headers: { cookie: `token=${token(ADMIN_ID)}` },
      payload: { role: 'staff' },
    })
    expect(res.statusCode).toBe(200)
    expect(io.inFn).not.toHaveBeenCalled()
  })

  it('username / password のみの変更では切断しない', async () => {
    mockFindFirst
      .mockResolvedValueOnce({ id: OTHER_ID, username: 'other', role: 'staff' })
      .mockResolvedValueOnce(null)
    mockUpdate.mockResolvedValue({ id: OTHER_ID, username: 'renamed', role: 'staff' })

    const res = await app.inject({
      method: 'PUT',
      url: `/api/staff/${OTHER_ID}`,
      headers: { cookie: `token=${token(ADMIN_ID)}` },
      payload: { username: 'renamed' },
    })
    expect(res.statusCode).toBe(200)
    expect(io.inFn).not.toHaveBeenCalled()
  })
})

describe('GET /api/staff/:id/sessions', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>

  beforeAll(async () => {
    app = await buildTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  function token(userId: string) {
    return app.jwt.sign({
      type: 'staff' as const,
      userId,
      username: 'admin',
      role: 'admin',
      storeId: STORE_ID,
    })
  }

  it('対象スタッフが存在しない場合は 404 を返す', async () => {
    mockFindFirst.mockResolvedValue(null)
    const res = await app.inject({
      method: 'GET',
      url: `/api/staff/${OTHER_ID}/sessions`,
      headers: { cookie: `token=${token(ADMIN_ID)}` },
    })
    expect(res.statusCode).toBe(404)
    expect(mockListActiveSessions).not.toHaveBeenCalled()
  })

  it('admin 以外は 403 を返す', async () => {
    const staffToken = app.jwt.sign({
      type: 'staff' as const,
      userId: OTHER_ID,
      username: 'staff',
      role: 'staff',
      storeId: STORE_ID,
    })
    const res = await app.inject({
      method: 'GET',
      url: `/api/staff/${OTHER_ID}/sessions`,
      headers: { cookie: `token=${staffToken}` },
    })
    expect(res.statusCode).toBe(403)
    expect(mockFindFirst).not.toHaveBeenCalled()
  })

  it('セッション一覧を tokenHash を含めずに返す', async () => {
    mockFindFirst.mockResolvedValue({ id: OTHER_ID, username: 'other', role: 'staff' })
    mockListActiveSessions.mockResolvedValue([
      {
        id: 'session-1',
        issuedAt: new Date('2024-06-01T12:00:00.000Z'),
        expiresAt: new Date('2024-06-02T12:00:00.000Z'),
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
      },
    ])

    const res = await app.inject({
      method: 'GET',
      url: `/api/staff/${OTHER_ID}/sessions`,
      headers: { cookie: `token=${token(ADMIN_ID)}` },
    })
    expect(res.statusCode).toBe(200)
    expect(mockListActiveSessions).toHaveBeenCalledWith(OTHER_ID)
    const body = res.json()
    expect(body).toEqual([
      {
        id: 'session-1',
        issuedAt: '2024-06-01T12:00:00.000Z',
        expiresAt: '2024-06-02T12:00:00.000Z',
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
      },
    ])
    expect(JSON.stringify(body)).not.toContain('tokenHash')
  })
})

describe('DELETE /api/staff/:id/sessions/:sessionId', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>

  beforeAll(async () => {
    app = await buildTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  function token(userId: string) {
    return app.jwt.sign({
      type: 'staff' as const,
      userId,
      username: 'admin',
      role: 'admin',
      storeId: STORE_ID,
    })
  }

  it('対象スタッフが存在しない場合は 404 を返す', async () => {
    mockFindFirst.mockResolvedValue(null)
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/staff/${OTHER_ID}/sessions/session-1`,
      headers: { cookie: `token=${token(ADMIN_ID)}` },
    })
    expect(res.statusCode).toBe(404)
    expect(mockRevokeTokenById).not.toHaveBeenCalled()
  })

  it('対象セッションが存在しない場合は 404 を返す', async () => {
    mockFindFirst.mockResolvedValue({ id: OTHER_ID, username: 'other', role: 'staff' })
    mockRevokeTokenById.mockResolvedValue(false)
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/staff/${OTHER_ID}/sessions/session-1`,
      headers: { cookie: `token=${token(ADMIN_ID)}` },
    })
    expect(res.statusCode).toBe(404)
  })

  it('強制ログアウトに成功すると 204 を返す', async () => {
    mockFindFirst.mockResolvedValue({ id: OTHER_ID, username: 'other', role: 'staff' })
    mockRevokeTokenById.mockResolvedValue(true)
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/staff/${OTHER_ID}/sessions/session-1`,
      headers: { cookie: `token=${token(ADMIN_ID)}` },
    })
    expect(res.statusCode).toBe(204)
    expect(mockRevokeTokenById).toHaveBeenCalledWith(OTHER_ID, 'session-1')
  })
})
