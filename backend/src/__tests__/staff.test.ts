import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'

const mockFindUnique = jest.fn()
const mockDelete = jest.fn()

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    staff: {
      findUnique: mockFindUnique,
      delete: mockDelete,
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}))

const { default: staffRoutes } = await import('../routes/staff.js')

const ADMIN_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const OTHER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const SECRET = 'test-secret'

async function buildTestApp() {
  const app = Fastify({ logger: false })
  await app.register(cookie)
  await app.register(jwt, { secret: SECRET, cookie: { cookieName: 'token', signed: false } })
  app.addHook('preHandler', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      reply.status(401).send({ error: '認証が必要です' })
    }
  })
  await app.register(staffRoutes, { prefix: '/api/staff' })
  await app.ready()
  return app
}

describe('DELETE /api/staff/:id — 自己削除ガード', () => {
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
    return app.jwt.sign({ userId, username: 'admin', role: 'admin' })
  }

  it('自分自身のIDで DELETE すると 422 を返す', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/staff/${ADMIN_ID}`,
      headers: { cookie: `token=${token(ADMIN_ID)}` },
    })
    expect(res.statusCode).toBe(422)
    expect(res.json()).toMatchObject({ error: '自分自身は削除できません' })
    expect(mockFindUnique).not.toHaveBeenCalled()
  })

  it('他スタッフのIDで DELETE すると自己削除ガードを通過する', async () => {
    mockFindUnique.mockResolvedValue({ id: OTHER_ID, username: 'other', role: 'staff' })
    mockDelete.mockResolvedValue({})

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/staff/${OTHER_ID}`,
      headers: { cookie: `token=${token(ADMIN_ID)}` },
    })
    expect(res.statusCode).toBe(204)
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: OTHER_ID } })
  })
})
