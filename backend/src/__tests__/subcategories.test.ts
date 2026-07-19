import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { Prisma } from '@prisma/client'
import Fastify from 'fastify'

const mockCategoryFindFirst = jest.fn<(...args: unknown[]) => Promise<{ id: number } | null>>()
const mockSubCategoryFindFirst = jest.fn<(...args: unknown[]) => Promise<{ id: number } | null>>()
const mockSubCategoryCreate = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockSubCategoryUpdate = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockSubCategoryDelete = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockMenuItemCount = jest.fn<(...args: unknown[]) => Promise<number>>()
const mockTransaction =
  jest.fn<
    (
      callback: (tx: {
        subCategory: {
          findFirst: typeof mockSubCategoryFindFirst
          delete: typeof mockSubCategoryDelete
        }
        menuItem: { count: typeof mockMenuItemCount }
      }) => Promise<unknown>,
      options?: unknown,
    ) => Promise<unknown>
  >()

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    $transaction: mockTransaction,
    category: { findFirst: mockCategoryFindFirst },
    subCategory: {
      findFirst: mockSubCategoryFindFirst,
      create: mockSubCategoryCreate,
      update: mockSubCategoryUpdate,
      delete: mockSubCategoryDelete,
    },
    menuItem: { count: mockMenuItemCount },
  },
}))

const { default: subcategoriesRoutes } = await import('../routes/subcategories.js')

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
  await app.register(subcategoriesRoutes, { prefix: '/api/subcategories' })
  await app.ready()
  return app
}

describe('POST /api/subcategories — categoryId storeId 検証', () => {
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

  it('他店舗の categoryId を指定した場合は 422 を返す', async () => {
    mockCategoryFindFirst.mockResolvedValue(null)
    const res = await app.inject({
      method: 'POST',
      url: '/api/subcategories',
      headers: { cookie: `token=${token()}` },
      payload: { name: 'ビール', categoryId: 99 },
    })

    expect(res.statusCode).toBe(422)
    expect(res.json()).toMatchObject({
      error: { code: 'subcategories.save.category_not_found', message: 'カテゴリが見つかりません' },
    })
    expect(mockCategoryFindFirst).toHaveBeenCalledWith({ where: { id: 99, storeId: STORE_ID } })
    expect(mockSubCategoryCreate).not.toHaveBeenCalled()
  })

  it('自店舗の categoryId なら作成できる', async () => {
    mockCategoryFindFirst.mockResolvedValue({ id: 2 })
    mockSubCategoryCreate.mockResolvedValue({
      id: 10,
      name: 'ビール',
      categoryId: 2,
      sort: 0,
      storeId: STORE_ID,
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/subcategories',
      headers: { cookie: `token=${token()}` },
      payload: { name: 'ビール', categoryId: 2 },
    })

    expect(res.statusCode).toBe(201)
    expect(mockSubCategoryCreate).toHaveBeenCalledWith({
      data: { name: 'ビール', categoryId: 2, sort: 0, storeId: STORE_ID },
    })
    expect(mockIoTo).toHaveBeenCalledWith(`store:${STORE_ID}`)
    expect(mockIoEmit).toHaveBeenCalledWith(
      'subCategory:created',
      expect.objectContaining({ id: 10 }),
    )
  })
})

describe('DELETE /api/subcategories/:id — 削除制御', () => {
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
        subCategory: { findFirst: mockSubCategoryFindFirst, delete: mockSubCategoryDelete },
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
    mockSubCategoryFindFirst.mockResolvedValue(null)

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/subcategories/999',
      headers: { cookie: `token=${token()}` },
    })

    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({
      error: { code: 'subcategories.detail.not_found', message: 'サブカテゴリが見つかりません' },
    })
    expect(mockSubCategoryFindFirst).toHaveBeenCalledWith({
      where: { id: 999, storeId: STORE_ID },
    })
    expect(mockMenuItemCount).not.toHaveBeenCalled()
    expect(mockSubCategoryDelete).not.toHaveBeenCalled()
    expect(mockTransaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })
  })

  it('メニューが使用中なら 409 を返す', async () => {
    mockSubCategoryFindFirst.mockResolvedValue({ id: 10 })
    mockMenuItemCount.mockResolvedValue(1)

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/subcategories/10',
      headers: { cookie: `token=${token()}` },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({
      error: {
        code: 'subcategories.delete.in_use',
        message: '使用中のサブカテゴリは削除できません',
      },
    })
    expect(mockMenuItemCount).toHaveBeenCalledWith({ where: { subCategoryId: 10 } })
    expect(mockSubCategoryDelete).not.toHaveBeenCalled()
  })

  it('使用中メニューがなければ 204 を返す', async () => {
    mockSubCategoryFindFirst.mockResolvedValue({ id: 10 })
    mockMenuItemCount.mockResolvedValue(0)
    mockSubCategoryDelete.mockResolvedValue({})

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/subcategories/10',
      headers: { cookie: `token=${token()}` },
    })

    expect(res.statusCode).toBe(204)
    expect(mockSubCategoryDelete).toHaveBeenCalledWith({ where: { id: 10 } })
    expect(mockTransaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })
    expect(mockIoTo).toHaveBeenCalledWith(`store:${STORE_ID}`)
    expect(mockIoEmit).toHaveBeenCalledWith('subCategory:deleted', 10)
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
      url: '/api/subcategories/10',
      headers: { cookie: `token=${token()}` },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({
      error: {
        code: 'subcategories.delete.in_use',
        message: '使用中のサブカテゴリは削除できません',
      },
    })
    expect(mockSubCategoryDelete).not.toHaveBeenCalled()
  })
})

describe('PUT /api/subcategories/:id — categoryId storeId 検証', () => {
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

  it('他店舗の categoryId への更新は 422 を返す', async () => {
    mockSubCategoryFindFirst.mockResolvedValue({ id: 10 })
    mockCategoryFindFirst.mockResolvedValue(null)
    const res = await app.inject({
      method: 'PUT',
      url: '/api/subcategories/10',
      headers: { cookie: `token=${token()}` },
      payload: { categoryId: 99 },
    })

    expect(res.statusCode).toBe(422)
    expect(res.json()).toMatchObject({
      error: { code: 'subcategories.save.category_not_found', message: 'カテゴリが見つかりません' },
    })
    expect(mockSubCategoryFindFirst).toHaveBeenCalledWith({ where: { id: 10, storeId: STORE_ID } })
    expect(mockCategoryFindFirst).toHaveBeenCalledWith({ where: { id: 99, storeId: STORE_ID } })
    expect(mockSubCategoryUpdate).not.toHaveBeenCalled()
  })

  it('自店舗の categoryId への更新は成功する', async () => {
    mockSubCategoryFindFirst.mockResolvedValue({ id: 10 })
    mockCategoryFindFirst.mockResolvedValue({ id: 2 })
    mockSubCategoryUpdate.mockResolvedValue({
      id: 10,
      name: '日本酒',
      categoryId: 2,
      sort: 0,
      storeId: STORE_ID,
    })
    const res = await app.inject({
      method: 'PUT',
      url: '/api/subcategories/10',
      headers: { cookie: `token=${token()}` },
      payload: { name: '日本酒', categoryId: 2 },
    })

    expect(res.statusCode).toBe(200)
    expect(mockSubCategoryUpdate).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { name: '日本酒', categoryId: 2, sort: undefined },
    })
    expect(mockIoTo).toHaveBeenCalledWith(`store:${STORE_ID}`)
    expect(mockIoEmit).toHaveBeenCalledWith(
      'subCategory:updated',
      expect.objectContaining({ id: 10 }),
    )
  })
})
