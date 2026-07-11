import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { Prisma } from '@prisma/client'
import Fastify from 'fastify'

const mockSeatFindFirst = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockSeatFindMany = jest.fn<(...args: unknown[]) => Promise<unknown[]>>()
const mockSeatCreate = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockSeatUpdate = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockSeatDeleteMany = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockSeatTableFindFirst = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockSeatTableFindMany = jest.fn<(...args: unknown[]) => Promise<unknown[]>>()
const mockSeatTableCreate = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockSeatTableUpdate = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockSeatTableDeleteMany = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockSettingFindUnique = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockSettingUpdate = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockGroupSeatFindMany = jest.fn<(...args: unknown[]) => Promise<unknown[]>>()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockTransaction = jest.fn<(cb: (tx: any) => Promise<any>, options?: any) => Promise<any>>()

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    seat: {
      findFirst: mockSeatFindFirst,
      findMany: mockSeatFindMany,
      create: mockSeatCreate,
      update: mockSeatUpdate,
      deleteMany: mockSeatDeleteMany,
    },
    seatTable: {
      findFirst: mockSeatTableFindFirst,
      findMany: mockSeatTableFindMany,
      create: mockSeatTableCreate,
      update: mockSeatTableUpdate,
      deleteMany: mockSeatTableDeleteMany,
    },
    setting: { findUnique: mockSettingFindUnique, update: mockSettingUpdate },
    groupSeat: { findMany: mockGroupSeatFindMany },
    $transaction: mockTransaction,
  },
}))

const { default: seatsRoutes } = await import('../routes/seats.js')
const { default: seatLayoutRoutes } = await import('../routes/seatLayout.js')

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
  const mockIo: any = { emit: jest.fn() }
  mockIo.to = () => mockIo
  app.decorate('io', mockIo)
  await app.register(seatsRoutes, { prefix: '/api/seats' })
  await app.register(seatLayoutRoutes, { prefix: '/api/seat-layout' })
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

function layoutPayload(tableId: number) {
  return {
    canvasCols: 16,
    canvasRows: 12,
    gridSize: 48,
    tables: [{ id: 10, label: 'T1', x: 1, y: 1, w: 2, h: 2 }],
    seats: [{ id: 20, label: 'A1', x: 1, y: 1, tableId }],
  }
}

describe('席とテーブルの店舗所有権チェック', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  beforeAll(async () => {
    app = await buildTestApp()
  })
  afterAll(async () => {
    await app.close()
  })
  beforeEach(() => {
    jest.resetAllMocks()
    mockSettingFindUnique.mockResolvedValue(null)
    mockGroupSeatFindMany.mockResolvedValue([])
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        setting: { update: mockSettingUpdate },
        seatTable: {
          create: mockSeatTableCreate,
          update: mockSeatTableUpdate,
          deleteMany: mockSeatTableDeleteMany,
        },
        seat: { create: mockSeatCreate, update: mockSeatUpdate, deleteMany: mockSeatDeleteMany },
        groupSeat: { findMany: mockGroupSeatFindMany },
      }
      return cb(tx)
    })
  })

  it('POST /api/seats は他店舗の tableId を 422 で拒否する', async () => {
    mockSeatTableFindFirst.mockResolvedValue(null)
    const res = await app.inject({
      method: 'POST',
      url: '/api/seats',
      headers: { cookie: `token=${token(app)}` },
      payload: { label: 'A1', type: 'table', x: 1, y: 1, tableId: 99 },
    })
    expect(res.statusCode).toBe(422)
    expect(res.json()).toMatchObject({ error: { code: 'seats.save.table_not_found' } })
    expect(mockSeatTableFindFirst).toHaveBeenCalledWith({ where: { id: 99, storeId: STORE_ID } })
    expect(mockSeatCreate).not.toHaveBeenCalled()
  })

  it('POST /api/seats は自店舗の tableId なら作成できる', async () => {
    mockSeatTableFindFirst.mockResolvedValue({ id: 10, storeId: STORE_ID })
    mockSeatCreate.mockResolvedValue({
      id: 1,
      label: 'A1',
      type: 'table',
      x: 1,
      y: 1,
      tableId: 10,
      storeId: STORE_ID,
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/seats',
      headers: { cookie: `token=${token(app)}` },
      payload: { label: 'A1', type: 'table', x: 1, y: 1, tableId: 10 },
    })
    expect(res.statusCode).toBe(201)
    expect(mockSeatCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tableId: 10, storeId: STORE_ID }),
      }),
    )
  })

  it('PUT /api/seats/:id は他店舗の tableId を 422 で拒否する', async () => {
    mockSeatFindFirst.mockResolvedValue({ id: 1, storeId: STORE_ID })
    mockSeatTableFindFirst.mockResolvedValue(null)
    const res = await app.inject({
      method: 'PUT',
      url: '/api/seats/1',
      headers: { cookie: `token=${token(app)}` },
      payload: { tableId: 99 },
    })
    expect(res.statusCode).toBe(422)
    expect(res.json()).toMatchObject({ error: { code: 'seats.save.table_not_found' } })
    expect(mockSeatTableFindFirst).toHaveBeenCalledWith({ where: { id: 99, storeId: STORE_ID } })
    expect(mockSeatUpdate).not.toHaveBeenCalled()
  })

  it('PUT /api/seats/:id は自店舗の tableId なら更新できる', async () => {
    mockSeatFindFirst.mockResolvedValue({ id: 1, storeId: STORE_ID })
    mockSeatTableFindFirst.mockResolvedValue({ id: 10, storeId: STORE_ID })
    mockSeatUpdate.mockResolvedValue({ id: 1, tableId: 10, storeId: STORE_ID })
    const res = await app.inject({
      method: 'PUT',
      url: '/api/seats/1',
      headers: { cookie: `token=${token(app)}` },
      payload: { tableId: 10 },
    })
    expect(res.statusCode).toBe(200)
    expect(mockSeatUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ tableId: 10 }),
      }),
    )
  })

  it('PUT /api/seat-layout は他店舗の正の tableId を 422 で拒否する', async () => {
    mockSeatFindMany.mockResolvedValueOnce([{ id: 20 }]).mockResolvedValueOnce([])
    mockSeatTableFindMany.mockResolvedValueOnce([{ id: 10 }]).mockResolvedValueOnce([])
    const res = await app.inject({
      method: 'PUT',
      url: '/api/seat-layout',
      headers: { cookie: `token=${token(app)}` },
      payload: layoutPayload(99),
    })
    expect(res.statusCode).toBe(422)
    expect(res.json()).toMatchObject({
      error: { code: 'seat_layout.update.invalid_table_id', details: { tableId: 99 } },
    })
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('PUT /api/seat-layout は自店舗の正の tableId なら更新できる', async () => {
    mockSeatFindMany
      .mockResolvedValueOnce([{ id: 20 }])
      .mockResolvedValueOnce([{ id: 20, tableId: 10 }])
    mockSeatTableFindMany.mockResolvedValueOnce([{ id: 10 }]).mockResolvedValueOnce([{ id: 10 }])
    const res = await app.inject({
      method: 'PUT',
      url: '/api/seat-layout',
      headers: { cookie: `token=${token(app)}` },
      payload: layoutPayload(10),
    })
    expect(res.statusCode).toBe(200)
    expect(mockSeatUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 20 },
        data: expect.objectContaining({ tableId: 10 }),
      }),
    )
    expect(mockTransaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }),
    )
  })

  it('PUT /api/seat-layout は Serializable 競合（P2034）を 409 で返す', async () => {
    mockSeatFindMany.mockResolvedValueOnce([{ id: 20 }])
    mockSeatTableFindMany.mockResolvedValueOnce([{ id: 10 }])
    mockTransaction.mockImplementation(async () => {
      throw new Prisma.PrismaClientKnownRequestError('Transaction failed due to a write conflict', {
        code: 'P2034',
        clientVersion: '5.17.0',
      })
    })

    const res = await app.inject({
      method: 'PUT',
      url: '/api/seat-layout',
      headers: { cookie: `token=${token(app)}` },
      payload: {
        canvasCols: 16,
        canvasRows: 12,
        gridSize: 48,
        tables: [],
        seats: [],
      },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({
      error: { code: 'seat_layout.update.busy_seats_included', message: '使用中の席が含まれています' },
    })
  })
})
