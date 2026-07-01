import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'

const mockOrderItemCount = jest.fn<(...args: unknown[]) => Promise<number>>()
const mockMenuItemDelete = jest.fn<(...args: unknown[]) => Promise<unknown>>()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockTransaction = jest.fn<(cb: (tx: any) => Promise<any>) => Promise<any>>()

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    orderItem: { count: mockOrderItemCount },
    menuItem: { delete: mockMenuItemDelete },
    $transaction: mockTransaction,
  },
}))

const { default: menusRoutes } = await import('../routes/menus.js')
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.decorate('io', { to: () => ({ emit: jest.fn() }), emit: jest.fn() } as any)
  await app.register(menusRoutes, { prefix: '/api/menus' })
  await app.ready()
  return app
}

describe('DELETE /api/menus/:id — 削除制御', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>

  beforeAll(async () => { app = await buildTestApp() })
  afterAll(async () => { await app.close() })
  beforeEach(() => {
    jest.clearAllMocks()
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        orderItem: { count: mockOrderItemCount },
        menuItem: { delete: mockMenuItemDelete },
      }
      return cb(tx)
    })
  })

  function token() {
    return app.jwt.sign({ userId: ADMIN_ID, username: 'admin', role: 'admin' })
  }

  it('pending の注文があれば 409 を返す', async () => {
    mockOrderItemCount.mockResolvedValue(1)
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/menus/1',
      headers: { cookie: `token=${token()}` },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: '処理中の注文があるため削除できません' })
    expect(mockMenuItemDelete).not.toHaveBeenCalled()
  })

  it('ready の注文があれば 409 を返す', async () => {
    mockOrderItemCount.mockResolvedValue(3)
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/menus/2',
      headers: { cookie: `token=${token()}` },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: '処理中の注文があるため削除できません' })
    expect(mockMenuItemDelete).not.toHaveBeenCalled()
  })

  it('処理中の注文がなければ 204 を返す', async () => {
    mockOrderItemCount.mockResolvedValue(0)
    mockMenuItemDelete.mockResolvedValue({})
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/menus/1',
      headers: { cookie: `token=${token()}` },
    })
    expect(res.statusCode).toBe(204)
    expect(mockMenuItemDelete).toHaveBeenCalledWith({ where: { id: 1 } })
  })

  it('存在しない ID で削除すると 404 を返す', async () => {
    mockOrderItemCount.mockResolvedValue(0)
    mockMenuItemDelete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Not found', { code: 'P2025', clientVersion: '5.0.0' })
    )
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/menus/999',
      headers: { cookie: `token=${token()}` },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ error: 'メニューが見つかりません' })
  })
})
