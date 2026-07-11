import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { Prisma } from '@prisma/client'
import Fastify from 'fastify'

const mockSeatFindFirst = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockSeatDelete = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockGroupSeatFindFirst = jest.fn<(...args: unknown[]) => Promise<unknown>>()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockTransaction = jest.fn<(cb: (tx: any) => Promise<any>, options?: any) => Promise<any>>()
const mockIoEmit = jest.fn<(...args: unknown[]) => unknown>()

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    seat: {
      findFirst: mockSeatFindFirst,
      delete: mockSeatDelete,
    },
    groupSeat: { findFirst: mockGroupSeatFindFirst },
    $transaction: mockTransaction,
  },
}))

const { default: seatsRoutes } = await import('../routes/seats.js')

const SECRET = 'test-secret'
const ADMIN_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const STORE_ID = 1

async function buildTestApp() {
  const app = Fastify({ logger: false })
  app.decorateRequest('storeId', 0)
  app.addHook('onRequest', async (request) => {
    request.storeId = STORE_ID
  })
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockIo: any = { emit: mockIoEmit }
  mockIo.to = () => mockIo
  app.decorate('io', mockIo)
  await app.register(seatsRoutes, { prefix: '/api/seats' })
  await app.ready()
  return app
}

function token(app: Awaited<ReturnType<typeof buildTestApp>>) {
  return app.jwt.sign({
    type: 'staff' as const,
    userId: ADMIN_ID,
    username: 'admin',
    role: 'admin',
    storeId: STORE_ID,
  })
}

describe('DELETE /api/seats/:id', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>

  beforeAll(async () => {
    app = await buildTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockTransaction.mockImplementation(async (cb, options) => {
      const tx = {
        seat: {
          findFirst: mockSeatFindFirst,
          delete: mockSeatDelete,
        },
        groupSeat: {
          findFirst: mockGroupSeatFindFirst,
        },
      }
      return cb(tx)
    })
  })

  it('使用中の席は 409 を返して削除しない', async () => {
    mockSeatFindFirst.mockResolvedValue({ id: 1, storeId: STORE_ID })
    mockGroupSeatFindFirst.mockResolvedValue({ groupId: 'g1', seatId: 1 })

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/seats/1',
      headers: { cookie: `token=${token(app)}` },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: { code: 'seats.delete.in_use' } })
    expect(mockSeatDelete).not.toHaveBeenCalled()
    expect(mockIoEmit).not.toHaveBeenCalled()
  })

  it('未使用の席は Serializable トランザクションで削除し seat:deleted を emit する', async () => {
    mockSeatFindFirst.mockResolvedValue({ id: 1, storeId: STORE_ID })
    mockGroupSeatFindFirst.mockResolvedValue(null)
    mockSeatDelete.mockResolvedValue({ id: 1 })

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/seats/1',
      headers: { cookie: `token=${token(app)}` },
    })

    expect(res.statusCode).toBe(204)
    expect(mockTransaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }),
    )
    expect(mockSeatDelete).toHaveBeenCalledWith({ where: { id: 1 } })
    expect(mockIoEmit).toHaveBeenCalledWith('seat:deleted', 1)
  })

  it('Serializable 分離レベルでの競合（P2034）では 409 を返して emit しない', async () => {
    mockTransaction.mockImplementation(async () => {
      throw new Prisma.PrismaClientKnownRequestError('Transaction failed due to a write conflict', {
        code: 'P2034',
        clientVersion: '6.19.3',
      })
    })

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/seats/1',
      headers: { cookie: `token=${token(app)}` },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: { code: 'seats.delete.in_use' } })
    expect(mockIoEmit).not.toHaveBeenCalled()
  })
})
