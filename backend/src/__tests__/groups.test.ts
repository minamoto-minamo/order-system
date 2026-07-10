import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { Prisma } from '@prisma/client'
import Fastify from 'fastify'

type GroupSeat = { groupId: string; seatId: number }
type Group = {
  id: string
  name: string
  guestCount: number
  status: string
  sessionId: number
  courseId: number | null
  drinkPlanId: number | null
  billedTaxRateInHouse: { toNumber(): number } | null
  billedTaxRateTakeout: { toNumber(): number } | null
  billedTaxInclusive: boolean | null
  createdAt: Date
  seats: { seatId: number }[]
}

const mockSessionFindFirst = jest.fn<() => Promise<{ id: number; status: string } | null>>()
const mockSeatFindMany = jest.fn<() => Promise<{ id: number; label: string }[]>>()
const mockSeatCount = jest.fn<() => Promise<number>>()
const mockGroupFindFirst = jest.fn<() => Promise<{ id: string; sessionId?: number } | null>>()
const mockGroupSeatFindFirst = jest.fn<() => Promise<GroupSeat | null>>()
const mockGroupCreate = jest.fn<() => Promise<Group>>()
const mockGroupUpdate = jest.fn<() => Promise<Group>>()
const mockSettingFindUnique = jest.fn<() => Promise<any>>()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockTransaction = jest.fn<(cb: (tx: any) => Promise<any>) => Promise<any>>()

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    session: { findFirst: mockSessionFindFirst },
    seat: { findMany: mockSeatFindMany, count: mockSeatCount },
    groupSeat: { findFirst: mockGroupSeatFindFirst },
    group: { findFirst: mockGroupFindFirst, create: mockGroupCreate, update: mockGroupUpdate },
    setting: { findUnique: mockSettingFindUnique },
    $transaction: mockTransaction,
  },
}))

const { default: groupsRoutes } = await import('../routes/groups.js')

const SECRET = 'test-secret'
const ADMIN_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const GROUP_ID = 'gggggggg-gggg-gggg-gggg-gggggggggggg'
const STORE_ID = 1
const groupTax = {
  billedTaxRateInHouse: null,
  billedTaxRateTakeout: null,
  billedTaxInclusive: null,
}

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
  await app.register(groupsRoutes, { prefix: '/api/groups' })
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

describe('GET /api/groups/:id — 税率設定', () => {
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

  it('Setting が存在しない場合、デフォルト税率へフォールバックせず 500 を返す', async () => {
    mockGroupFindFirst.mockResolvedValue({
      id: GROUP_ID,
      name: 'A-1',
      guestCount: 2,
      status: 'active',
      sessionId: 1,
      courseId: null,
      drinkPlanId: null,
      ...groupTax,
      createdAt: new Date(),
      seats: [],
    } as any)
    mockSettingFindUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'GET',
      url: `/api/groups/${GROUP_ID}`,
      headers: { cookie: `token=${token(app)}` },
    })

    expect(res.statusCode).toBe(500)
    expect(res.json()).toMatchObject({
      error: { code: 'common.setting_not_found', message: '店舗設定が見つかりません' },
    })
  })
})

describe('POST /api/groups — グループ作成', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  beforeAll(async () => {
    app = await buildTestApp()
  })
  afterAll(async () => {
    await app.close()
  })
  beforeEach(() => {
    jest.clearAllMocks()
    mockSettingFindUnique.mockResolvedValue({
      taxRateInHouse: { toNumber: () => 10 },
      taxRateTakeout: { toNumber: () => 8 },
      taxInclusive: false,
    })
  })

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
      method: 'POST',
      url: '/api/groups',
      headers: { cookie: `token=${token(app)}` },
      payload: { guestCount: 2, seatIds: [1] },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: { message: '営業中のセッションがありません' } })
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
      method: 'POST',
      url: '/api/groups',
      headers: { cookie: `token=${token(app)}` },
      payload: { guestCount: 2, seatIds: [1] },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: { message: '選択した席はすでに使用中です' } })
    expect(mockGroupCreate).not.toHaveBeenCalled()
  })

  it('Serializable 分離レベルでの書き込み競合（P2034）でも 409 を返す', async () => {
    mockSeatFindMany.mockResolvedValue([{ id: 1, label: 'A-1' }])
    mockTransaction.mockImplementation(async () => {
      throw new Prisma.PrismaClientKnownRequestError('Transaction failed due to a write conflict', {
        code: 'P2034',
        clientVersion: '5.17.0',
      })
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/groups',
      headers: { cookie: `token=${token(app)}` },
      payload: { guestCount: 2, seatIds: [1] },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: { message: '選択した席はすでに使用中です' } })
  })

  it('競合席がない場合グループを作成して 201 を返す', async () => {
    const newGroup: Group = {
      id: GROUP_ID,
      name: 'A-1',
      guestCount: 2,
      status: 'active',
      sessionId: 1,
      courseId: null,
      drinkPlanId: null,
      ...groupTax,
      createdAt: new Date(),
      seats: [{ seatId: 1 }],
    }
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
      method: 'POST',
      url: '/api/groups',
      headers: { cookie: `token=${token(app)}` },
      payload: { guestCount: 2, seatIds: [1] },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ id: GROUP_ID, name: 'A-1' })
  })
})

describe('PUT /api/groups/:id — グループ更新（席変更）', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  beforeAll(async () => {
    app = await buildTestApp()
  })
  afterAll(async () => {
    await app.close()
  })
  beforeEach(() => {
    jest.clearAllMocks()
    mockSettingFindUnique.mockResolvedValue({
      taxRateInHouse: { toNumber: () => 10 },
      taxRateTakeout: { toNumber: () => 8 },
      taxInclusive: false,
    })
    mockSessionFindFirst.mockResolvedValue({ id: 1, status: 'open' })
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, sessionId: 1 })
  })

  it('対象グループのセッションが closed の場合 409 を返す（店舗内の他セッションが open でも通さない）', async () => {
    mockSessionFindFirst.mockResolvedValue({ id: 1, status: 'closed' })
    const res = await app.inject({
      method: 'PUT',
      url: `/api/groups/${GROUP_ID}`,
      headers: { cookie: `token=${token(app)}` },
      payload: { name: 'テスト' },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: { message: '営業中のセッションがありません' } })
  })

  it('closed グループへの status 以外の更新（name等）は 409 を返す', async () => {
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        group: {
          findUnique: () => Promise.resolve({ id: GROUP_ID, status: 'closed' }),
          update: mockGroupUpdate,
        },
        groupSeat: { findFirst: mockGroupSeatFindFirst },
      }
      return cb(tx)
    })
    const res = await app.inject({
      method: 'PUT',
      url: `/api/groups/${GROUP_ID}`,
      headers: { cookie: `token=${token(app)}` },
      payload: { name: 'テスト' },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({
      error: { message: '会計済み・会計待ちのグループは変更できません' },
    })
    expect(mockGroupUpdate).not.toHaveBeenCalled()
  })

  it('bill_requested グループへの status 以外の更新（name等）は 409 を返す', async () => {
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        group: {
          findUnique: () => Promise.resolve({ id: GROUP_ID, status: 'bill_requested' }),
          update: mockGroupUpdate,
        },
        groupSeat: { findFirst: mockGroupSeatFindFirst },
      }
      return cb(tx)
    })
    const res = await app.inject({
      method: 'PUT',
      url: `/api/groups/${GROUP_ID}`,
      headers: { cookie: `token=${token(app)}` },
      payload: { guestCount: 5 },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({
      error: { message: '会計済み・会計待ちのグループは変更できません' },
    })
    expect(mockGroupUpdate).not.toHaveBeenCalled()
  })

  it('seatIds に競合席がある場合 409 を返す', async () => {
    mockSeatFindMany.mockResolvedValue([])
    mockSeatCount.mockResolvedValue(1)
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        group: {
          findUnique: () => Promise.resolve({ id: GROUP_ID, status: 'active' }),
          update: mockGroupUpdate,
        },
        groupSeat: { findFirst: () => Promise.resolve({ groupId: 'other', seatId: 2 }) },
      }
      return cb(tx)
    })
    const res = await app.inject({
      method: 'PUT',
      url: `/api/groups/${GROUP_ID}`,
      headers: { cookie: `token=${token(app)}` },
      payload: { seatIds: [2] },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: { message: '選択した席はすでに使用中です' } })
    expect(mockGroupUpdate).not.toHaveBeenCalled()
  })

  it('Serializable 分離レベルでの書き込み競合（P2034）でも 409 を返す', async () => {
    mockSeatFindMany.mockResolvedValue([])
    mockSeatCount.mockResolvedValue(1)
    mockTransaction.mockImplementation(async () => {
      throw new Prisma.PrismaClientKnownRequestError('Transaction failed due to a write conflict', {
        code: 'P2034',
        clientVersion: '5.17.0',
      })
    })
    const res = await app.inject({
      method: 'PUT',
      url: `/api/groups/${GROUP_ID}`,
      headers: { cookie: `token=${token(app)}` },
      payload: { seatIds: [2] },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ error: { message: '選択した席はすでに使用中です' } })
  })

  it('seatIds に競合席がない場合グループを更新して 200 を返す', async () => {
    const updatedGroup: Group = {
      id: GROUP_ID,
      name: 'B-1',
      guestCount: 2,
      status: 'active',
      sessionId: 1,
      courseId: null,
      drinkPlanId: null,
      ...groupTax,
      createdAt: new Date(),
      seats: [{ seatId: 3 }],
    }
    mockSeatFindMany.mockResolvedValue([])
    mockSeatCount.mockResolvedValue(1)
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        group: {
          findUnique: () => Promise.resolve({ id: GROUP_ID, status: 'active' }),
          update: () => Promise.resolve(updatedGroup),
        },
        groupSeat: { findFirst: () => Promise.resolve(null) },
      }
      return cb(tx)
    })
    const res = await app.inject({
      method: 'PUT',
      url: `/api/groups/${GROUP_ID}`,
      headers: { cookie: `token=${token(app)}` },
      payload: { seatIds: [3] },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ id: GROUP_ID })
  })

  it('bill_requested から closed へ遷移すると現在の税率を Group にスナップショットする', async () => {
    const billedSetting = {
      taxRateInHouse: { toNumber: () => 12 },
      taxRateTakeout: { toNumber: () => 9 },
      taxInclusive: true,
    }
    const updatedGroup: Group = {
      id: GROUP_ID,
      name: 'テスト',
      guestCount: 2,
      status: 'closed',
      sessionId: 1,
      courseId: null,
      drinkPlanId: null,
      billedTaxRateInHouse: billedSetting.taxRateInHouse,
      billedTaxRateTakeout: billedSetting.taxRateTakeout,
      billedTaxInclusive: true,
      createdAt: new Date(),
      seats: [],
    }
    const mockTxGroupUpdate = jest.fn<any>().mockResolvedValue(updatedGroup)
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        group: {
          findUnique: () => Promise.resolve({ id: GROUP_ID, status: 'bill_requested' }),
          update: mockTxGroupUpdate,
        },
        setting: { findUnique: () => Promise.resolve(billedSetting) },
        groupSeat: { findFirst: () => Promise.resolve(null) },
      }
      return cb(tx)
    })

    const res = await app.inject({
      method: 'PUT',
      url: `/api/groups/${GROUP_ID}`,
      headers: { cookie: `token=${token(app)}` },
      payload: { status: 'closed' },
    })

    expect(res.statusCode).toBe(200)
    expect(mockTxGroupUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'closed',
          billedTaxRateInHouse: billedSetting.taxRateInHouse,
          billedTaxRateTakeout: billedSetting.taxRateTakeout,
          billedTaxInclusive: true,
        }),
      }),
    )
    expect(res.json()).toMatchObject({
      effectiveTaxRateInHouse: 12,
      effectiveTaxRateTakeout: 9,
      effectiveTaxInclusive: true,
    })
  })

  it('bill_requested から active へ戻すと税率スナップショットを書き込まない', async () => {
    const updatedGroup: Group = {
      id: GROUP_ID,
      name: 'テスト',
      guestCount: 2,
      status: 'active',
      sessionId: 1,
      courseId: null,
      drinkPlanId: null,
      ...groupTax,
      createdAt: new Date(),
      seats: [],
    }
    const mockTxGroupUpdate = jest.fn<any>().mockResolvedValue(updatedGroup)
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        group: {
          findUnique: () => Promise.resolve({ id: GROUP_ID, status: 'bill_requested' }),
          update: mockTxGroupUpdate,
        },
        setting: { findUnique: jest.fn() },
        groupSeat: { findFirst: () => Promise.resolve(null) },
      }
      return cb(tx)
    })

    const res = await app.inject({
      method: 'PUT',
      url: `/api/groups/${GROUP_ID}`,
      headers: { cookie: `token=${token(app)}` },
      payload: { status: 'active' },
    })

    expect(res.statusCode).toBe(200)
    expect(mockTxGroupUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'active' },
      }),
    )
  })

  it('courseId / drinkPlanId を送っても更新データに反映されない（コース適用は POST /:id/course 経由に限定）', async () => {
    const updatedGroup: Group = {
      id: GROUP_ID,
      name: 'テスト',
      guestCount: 2,
      status: 'active',
      sessionId: 1,
      courseId: null,
      drinkPlanId: null,
      ...groupTax,
      createdAt: new Date(),
      seats: [],
    }
    mockSeatFindMany.mockResolvedValue([])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockTxGroupUpdate = jest.fn<any>().mockResolvedValue(updatedGroup)
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        group: {
          findUnique: () => Promise.resolve({ id: GROUP_ID, status: 'active' }),
          update: mockTxGroupUpdate,
        },
        groupSeat: { findFirst: () => Promise.resolve(null) },
      }
      return cb(tx)
    })
    const res = await app.inject({
      method: 'PUT',
      url: `/api/groups/${GROUP_ID}`,
      headers: { cookie: `token=${token(app)}` },
      payload: { courseId: 1, drinkPlanId: 2, name: 'テスト' },
    })
    expect(res.statusCode).toBe(200)
    expect(mockTxGroupUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: 'テスト' },
      }),
    )
  })
})
