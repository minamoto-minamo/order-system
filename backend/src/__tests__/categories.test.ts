import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { Prisma } from '@prisma/client'
import Fastify from 'fastify'

const mockCategoryFindFirst = jest.fn<(...args: unknown[]) => Promise<{ id: number } | null>>()
const mockCategoryCreate = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockCategoryUpdate = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockCategoryDelete = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockSubCategoryCount = jest.fn<(...args: unknown[]) => Promise<number>>()
const mockMenuItemCount = jest.fn<(...args: unknown[]) => Promise<number>>()
const mockTransaction =
  jest.fn<
    (
      callback: (tx: {
        category: { findFirst: typeof mockCategoryFindFirst; delete: typeof mockCategoryDelete }
        subCategory: { count: typeof mockSubCategoryCount }
        menuItem: { count: typeof mockMenuItemCount }
      }) => Promise<unknown>,
      options?: unknown,
    ) => Promise<unknown>
  >()

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    $transaction: mockTransaction,
    category: {
      findFirst: mockCategoryFindFirst,
      create: mockCategoryCreate,
      update: mockCategoryUpdate,
      delete: mockCategoryDelete,
    },
    subCategory: { count: mockSubCategoryCount },
    menuItem: { count: mockMenuItemCount },
  },
}))

const { default: categoriesRoutes } = await import('../routes/categories.js')

const SECRET = 'test-secret'
const ADMIN_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const STORE_ID = 1

const mockIoEmit = jest.fn()
const mockIoTo = jest.fn((_room: string) => ({ emit: mockIoEmit }))

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
  app.decorate('io', { to: mockIoTo, emit: jest.fn() } as any)
  await app.register(categoriesRoutes, { prefix: '/api/categories' })
  await app.ready()
  return app
}

describe('DELETE /api/categories/:id — 削除制御', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>

  beforeAll(async () => {
    app = await buildTestApp()
  })
  afterAll(async () => {
    await app.close()
  })
  beforeEach(() => {
    jest.clearAllMocks()
    mockTransaction.mockImplementation(async (callback) =>
      callback({
        category: { findFirst: mockCategoryFindFirst, delete: mockCategoryDelete },
        subCategory: { count: mockSubCategoryCount },
        menuItem: { count: mockMenuItemCount },
      }),
    )
  })

  function token() {
    return app.jwt.sign({
      type: 'staff' as const,
      userId: ADMIN_ID,
      username: 'admin',
      role: 'admin',
      storeId: STORE_ID,
    })
  }

  it('存在しない ID で削除すると 404 を返す', async () => {
    mockCategoryFindFirst.mockResolvedValue(null)

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/categories/999',
      headers: { cookie: `token=${token()}` },
    })

    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({
      error: { code: 'categories.detail.not_found', message: 'カテゴリが見つかりません' },
    })
    expect(mockCategoryFindFirst).toHaveBeenCalledWith({ where: { id: 999, storeId: STORE_ID } })
    expect(mockSubCategoryCount).not.toHaveBeenCalled()
    expect(mockMenuItemCount).not.toHaveBeenCalled()
    expect(mockCategoryDelete).not.toHaveBeenCalled()
    expect(mockTransaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })
  })

  it('サブカテゴリが使用中なら 409 を返す', async () => {
    mockCategoryFindFirst.mockResolvedValue({ id: 1 })
    mockSubCategoryCount.mockResolvedValue(1)
    mockMenuItemCount.mockResolvedValue(0)

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/categories/1',
      headers: { cookie: `token=${token()}` },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({
      error: { code: 'categories.delete.in_use', message: '使用中のカテゴリは削除できません' },
    })
    expect(mockSubCategoryCount).toHaveBeenCalledWith({ where: { categoryId: 1 } })
    expect(mockMenuItemCount).toHaveBeenCalledWith({ where: { categoryId: 1 } })
    expect(mockCategoryDelete).not.toHaveBeenCalled()
  })

  it('メニューが使用中なら 409 を返す', async () => {
    mockCategoryFindFirst.mockResolvedValue({ id: 1 })
    mockSubCategoryCount.mockResolvedValue(0)
    mockMenuItemCount.mockResolvedValue(1)

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/categories/1',
      headers: { cookie: `token=${token()}` },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({
      error: { code: 'categories.delete.in_use', message: '使用中のカテゴリは削除できません' },
    })
    expect(mockCategoryDelete).not.toHaveBeenCalled()
  })

  it('使用中の参照がなければ 204 を返す', async () => {
    mockCategoryFindFirst.mockResolvedValue({ id: 1 })
    mockSubCategoryCount.mockResolvedValue(0)
    mockMenuItemCount.mockResolvedValue(0)
    mockCategoryDelete.mockResolvedValue({})

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/categories/1',
      headers: { cookie: `token=${token()}` },
    })

    expect(res.statusCode).toBe(204)
    expect(mockCategoryDelete).toHaveBeenCalledWith({ where: { id: 1 } })
    expect(mockTransaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })
    expect(mockIoTo).toHaveBeenCalledWith(`store:${STORE_ID}`)
    expect(mockIoEmit).toHaveBeenCalledWith('category:deleted', 1)
  })

  it('Serializable 分離レベルでの書き込み競合（P2034）でも 409 を返す', async () => {
    mockTransaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Transaction failed due to a write conflict', {
        code: 'P2034',
        clientVersion: '5.17.0',
      }),
    )

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/categories/1',
      headers: { cookie: `token=${token()}` },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({
      error: { code: 'categories.delete.in_use', message: '使用中のカテゴリは削除できません' },
    })
    expect(mockCategoryDelete).not.toHaveBeenCalled()
  })
})

describe('POST/PUT /api/categories — Socket配信', () => {
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

  function token() {
    return app.jwt.sign({
      type: 'staff' as const,
      userId: ADMIN_ID,
      username: 'admin',
      role: 'admin',
      storeId: STORE_ID,
    })
  }

  it('POST で作成すると store ルームに category:created を配信する', async () => {
    const created = { id: 1, name: 'デザート', sort: 0 }
    mockCategoryCreate.mockResolvedValue(created)

    const res = await app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: { cookie: `token=${token()}` },
      payload: { name: 'デザート' },
    })

    expect(res.statusCode).toBe(201)
    expect(mockIoTo).toHaveBeenCalledWith(`store:${STORE_ID}`)
    expect(mockIoEmit).toHaveBeenCalledWith('category:created', created)
  })

  it('PUT で更新すると store ルームに category:updated を配信する', async () => {
    const updated = { id: 1, name: '前菜', sort: 1 }
    mockCategoryFindFirst.mockResolvedValue({ id: 1 })
    mockCategoryUpdate.mockResolvedValue(updated)

    const res = await app.inject({
      method: 'PUT',
      url: '/api/categories/1',
      headers: { cookie: `token=${token()}` },
      payload: { name: '前菜' },
    })

    expect(res.statusCode).toBe(200)
    expect(mockIoTo).toHaveBeenCalledWith(`store:${STORE_ID}`)
    expect(mockIoEmit).toHaveBeenCalledWith('category:updated', updated)
  })
})
