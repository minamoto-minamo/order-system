import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'

const mockGroupFindFirst = jest.fn<(...args: unknown[]) => Promise<{ id: string; status: string } | null>>()
const mockCourseDelete = jest.fn<(...args: unknown[]) => Promise<unknown>>()

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    group: { findFirst: mockGroupFindFirst },
    course: { delete: mockCourseDelete },
  },
}))

const { default: coursesRoutes } = await import('../routes/courses.js')
const { Prisma } = await import('@prisma/client')

const SECRET = 'test-secret'
const ADMIN_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

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
  await app.register(coursesRoutes, { prefix: '/api/courses' })
  await app.ready()
  return app
}

describe('DELETE /api/courses/:id — 削除制御', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>

  beforeAll(async () => { app = await buildTestApp() })
  afterAll(async () => { await app.close() })
  beforeEach(() => { jest.clearAllMocks() })

  function token() {
    return app.jwt.sign({ userId: ADMIN_ID, username: 'admin', role: 'admin' })
  }

  it('active グループが使用中なら 409 を返す', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: 'group-1', status: 'active' })
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/courses/1',
      headers: { cookie: `token=${token()}` },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: '使用中のコースは削除できません' })
    expect(mockCourseDelete).not.toHaveBeenCalled()
  })

  it('bill_requested グループが使用中なら 409 を返す', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: 'group-2', status: 'bill_requested' })
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/courses/1',
      headers: { cookie: `token=${token()}` },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: '使用中のコースは削除できません' })
    expect(mockCourseDelete).not.toHaveBeenCalled()
  })

  it('使用中グループがなければ 204 を返す', async () => {
    mockGroupFindFirst.mockResolvedValue(null)
    mockCourseDelete.mockResolvedValue({})
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/courses/1',
      headers: { cookie: `token=${token()}` },
    })
    expect(res.statusCode).toBe(204)
    expect(mockCourseDelete).toHaveBeenCalledWith({ where: { id: 1 } })
  })

  it('存在しない ID で削除すると 404 を返す', async () => {
    mockGroupFindFirst.mockResolvedValue(null)
    mockCourseDelete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Not found', { code: 'P2025', clientVersion: '5.0.0' })
    )
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/courses/999',
      headers: { cookie: `token=${token()}` },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ error: 'コースが見つかりません' })
  })
})
