import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import { Prisma } from '@prisma/client'

type GroupSeat = { groupId: string; seatId: number }
type Group = { id: string; name: string; guestCount: number; status: string; sessionId: number; courseId: number | null; drinkPlanId: number | null; createdAt: Date; seats: { seatId: number }[] }

const mockSessionFindFirst = jest.fn<() => Promise<{ id: number; status: string } | null>>()
const mockSeatFindMany = jest.fn<() => Promise<{ id: number; label: string }[]>>()
const mockSeatCount = jest.fn<() => Promise<number>>()
const mockGroupFindFirst = jest.fn<() => Promise<{ id: string } | null>>()
const mockGroupSeatFindFirst = jest.fn<() => Promise<GroupSeat | null>>()
const mockGroupCreate = jest.fn<() => Promise<Group>>()
const mockGroupUpdate = jest.fn<() => Promise<Group>>()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockTransaction = jest.fn<(cb: (tx: any) => Promise<any>) => Promise<any>>()

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    session: { findFirst: mockSessionFindFirst },
    seat: { findMany: mockSeatFindMany, count: mockSeatCount },
    groupSeat: { findFirst: mockGroupSeatFindFirst },
    group: { findFirst: mockGroupFindFirst, create: mockGroupCreate, update: mockGroupUpdate },
    $transaction: mockTransaction,
  },
}))

const { default: groupsRoutes } = await import('../routes/groups.js')

const SECRET = 'test-secret'
const ADMIN_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const GROUP_ID = 'gggggggg-gggg-gggg-gggg-gggggggggggg'
const STORE_ID = 1

async function buildTestApp() {
  const app = Fastify({ logger: false })
  app.decorateRequest('storeId', 0)
  app.addHook('onRequest', async (request) => { request.storeId = STORE_ID })
  await app.register(cookie)
  await app.register(jwt, { secret: SECRET, cookie: { cookieName: 'token', signed: false } })
  app.addHook('preHandler', async (request, reply) => {
    try { await request.jwtVerify() }
    catch { reply.status(401).send({ error: '認証が必要です' }) }
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.decorate('io', { to: () => ({ emit: jest.fn() }), emit: jest.fn() } as any)
  await app.register(groupsRoutes, { prefix: '/api/groups' })
  await app.ready()
  return app
}

function token(app: Awaited<ReturnType<typeof buildTestApp>>) {
  return app.jwt.sign({ type: 'staff' as const, userId: ADMIN_ID, username: 'admin', role: 'admin', storeId: STORE_ID })
}

describe('POST /api/groups — グループ作成', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  beforeAll(async () => { app = await buildTestApp() })
  afterAll(async () => { await app.close() })
  beforeEach(() => { jest.clearAllMocks() })

  it('営業中セッションがない場合 409 を返す', async () => {
    mockSeatFindMany.mockResolvedValue([{ id: 1, label: 'A-1' }])
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        session: { findFirst: () => Promise.resolve(null) },
        groupSeat: { findFirst: mockGroupSeatFindFirst },
        group: { create: mockGroupCreate },
      }
      return cb(tx)
    })
    const res = await app.inject({
      method: 'POST', url: '/api/groups',
      headers: { cookie: `token=${token(app)}` },
      payload: { guestCount: 2, seatIds: [1] },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: '営業中のセッションがありません' })
  })

  it('競合席がある場合 409 を返す', async () => {
    mockSeatFindMany.mockResolvedValue([{ id: 1, label: 'A-1' }])
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        session: { findFirst: () => Promise.resolve({ id: 1, status: 'open' }) },
        groupSeat: { findFirst: () => Promise.resolve({ groupId: 'other', seatId: 1 }) },
        group: { create: mockGroupCreate },
      }
      return cb(tx)
    })
    const res = await app.inject({
      method: 'POST', url: '/api/groups',
      headers: { cookie: `token=${token(app)}` },
      payload: { guestCount: 2, seatIds: [1] },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: '選択した席はすでに使用中です' })
    expect(mockGroupCreate).not.toHaveBeenCalled()
  })

  it('Serializable 分離レベルでの書き込み競合（P2034）でも 409 を返す', async () => {
    mockSeatFindMany.mockResolvedValue([{ id: 1, label: 'A-1' }])
    mockTransaction.mockImplementation(async () => {
      throw new Prisma.PrismaClientKnownRequestError('Transaction failed due to a write conflict', { code: 'P2034', clientVersion: '5.17.0' })
    })
    const res = await app.inject({
      method: 'POST', url: '/api/groups',
      headers: { cookie: `token=${token(app)}` },
      payload: { guestCount: 2, seatIds: [1] },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: '選択した席はすでに使用中です' })
  })

  it('競合席がない場合グループを作成して 201 を返す', async () => {
    const newGroup: Group = { id: GROUP_ID, name: 'A-1', guestCount: 2, status: 'active', sessionId: 1, courseId: null, drinkPlanId: null, createdAt: new Date(), seats: [{ seatId: 1 }] }
    mockSeatFindMany.mockResolvedValue([{ id: 1, label: 'A-1' }])
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        session: { findFirst: () => Promise.resolve({ id: 1, status: 'open' }) },
        groupSeat: { findFirst: () => Promise.resolve(null) },
        group: { create: () => Promise.resolve(newGroup) },
      }
      return cb(tx)
    })
    const res = await app.inject({
      method: 'POST', url: '/api/groups',
      headers: { cookie: `token=${token(app)}` },
      payload: { guestCount: 2, seatIds: [1] },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ id: GROUP_ID, name: 'A-1' })
  })
})

describe('PUT /api/groups/:id — グループ更新（席変更）', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  beforeAll(async () => { app = await buildTestApp() })
  afterAll(async () => { await app.close() })
  beforeEach(() => {
    jest.clearAllMocks()
    mockSessionFindFirst.mockResolvedValue({ id: 1, status: 'open' })
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID })
  })

  it('seatIds に競合席がある場合 409 を返す', async () => {
    mockSeatFindMany.mockResolvedValue([])
    mockSeatCount.mockResolvedValue(1)
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        groupSeat: { findFirst: () => Promise.resolve({ groupId: 'other', seatId: 2 }) },
        group: { update: mockGroupUpdate },
      }
      return cb(tx)
    })
    const res = await app.inject({
      method: 'PUT', url: `/api/groups/${GROUP_ID}`,
      headers: { cookie: `token=${token(app)}` },
      payload: { seatIds: [2] },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: '選択した席はすでに使用中です' })
    expect(mockGroupUpdate).not.toHaveBeenCalled()
  })

  it('Serializable 分離レベルでの書き込み競合（P2034）でも 409 を返す', async () => {
    mockSeatFindMany.mockResolvedValue([])
    mockSeatCount.mockResolvedValue(1)
    mockTransaction.mockImplementation(async () => {
      throw new Prisma.PrismaClientKnownRequestError('Transaction failed due to a write conflict', { code: 'P2034', clientVersion: '5.17.0' })
    })
    const res = await app.inject({
      method: 'PUT', url: `/api/groups/${GROUP_ID}`,
      headers: { cookie: `token=${token(app)}` },
      payload: { seatIds: [2] },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: '選択した席はすでに使用中です' })
  })

  it('seatIds に競合席がない場合グループを更新して 200 を返す', async () => {
    const updatedGroup: Group = { id: GROUP_ID, name: 'B-1', guestCount: 2, status: 'active', sessionId: 1, courseId: null, drinkPlanId: null, createdAt: new Date(), seats: [{ seatId: 3 }] }
    mockSeatFindMany.mockResolvedValue([])
    mockSeatCount.mockResolvedValue(1)
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        groupSeat: { findFirst: () => Promise.resolve(null) },
        group: { update: () => Promise.resolve(updatedGroup) },
      }
      return cb(tx)
    })
    const res = await app.inject({
      method: 'PUT', url: `/api/groups/${GROUP_ID}`,
      headers: { cookie: `token=${token(app)}` },
      payload: { seatIds: [3] },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ id: GROUP_ID })
  })

  it('courseId / drinkPlanId を送っても更新データに反映されない（コース適用は POST /:id/course 経由に限定）', async () => {
    const updatedGroup: Group = { id: GROUP_ID, name: 'テスト', guestCount: 2, status: 'active', sessionId: 1, courseId: null, drinkPlanId: null, createdAt: new Date(), seats: [] }
    mockSeatFindMany.mockResolvedValue([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockTxGroupUpdate = jest.fn<any>().mockResolvedValue(updatedGroup)
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        groupSeat: { findFirst: () => Promise.resolve(null) },
        group: { update: mockTxGroupUpdate },
      }
      return cb(tx)
    })
    const res = await app.inject({
      method: 'PUT', url: `/api/groups/${GROUP_ID}`,
      headers: { cookie: `token=${token(app)}` },
      payload: { courseId: 1, drinkPlanId: 2, name: 'テスト' },
    })
    expect(res.statusCode).toBe(200)
    expect(mockTxGroupUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { name: 'テスト' },
    }))
  })
})
