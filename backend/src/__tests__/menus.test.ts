import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { Prisma } from '@prisma/client'
import Fastify from 'fastify'

const mockOrderItemCount = jest.fn<(...args: unknown[]) => Promise<number>>()
const mockMenuItemFindFirst = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockMenuItemUpdate = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockMenuItemDelete = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockSubCategoryFindFirst = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockCourseFoodItemCount = jest.fn<(...args: unknown[]) => Promise<number>>()
const mockDrinkPlanItemCount = jest.fn<(...args: unknown[]) => Promise<number>>()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockTransaction = jest.fn<(cb: (tx: any) => Promise<any>) => Promise<any>>()

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    orderItem: { count: mockOrderItemCount },
    menuItem: {
      findFirst: mockMenuItemFindFirst,
      update: mockMenuItemUpdate,
      delete: mockMenuItemDelete,
    },
    subCategory: { findFirst: mockSubCategoryFindFirst },
    courseFoodItem: { count: mockCourseFoodItemCount },
    drinkPlanItem: { count: mockDrinkPlanItemCount },
    $transaction: mockTransaction,
  },
}))

const { default: menusRoutes } = await import('../routes/menus.js')

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
  app.decorate('io', { to: () => ({ emit: jest.fn() }), emit: jest.fn() } as any)
  await app.register(menusRoutes, { prefix: '/api/menus' })
  await app.ready()
  return app
}

describe('PUT /api/menus/:id — カテゴリとサブカテゴリの整合性', () => {
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

  it('categoryId のみ変更して現在の subCategory と不整合になる場合は 422 を返す', async () => {
    mockMenuItemFindFirst.mockResolvedValue({
      id: 1,
      categoryId: 10,
      subCategoryId: 100,
      soldOut: false,
    })
    mockSubCategoryFindFirst.mockResolvedValue({ id: 100, categoryId: 10 })

    const res = await app.inject({
      method: 'PUT',
      url: '/api/menus/1',
      headers: { cookie: `token=${token()}` },
      payload: { categoryId: 20 },
    })

    expect(res.statusCode).toBe(422)
    expect(res.json()).toMatchObject({
      error: {
        code: 'menus.save.subcategory_mismatch',
        message: 'サブカテゴリがカテゴリと一致しません',
      },
    })
    expect(mockSubCategoryFindFirst).toHaveBeenCalledWith({
      where: { id: 100, storeId: STORE_ID },
    })
    expect(mockMenuItemUpdate).not.toHaveBeenCalled()
  })

  it('categoryId と subCategoryId を整合的に変更できる', async () => {
    const updated = { id: 1, categoryId: 20, subCategoryId: 200, soldOut: false }
    mockMenuItemFindFirst.mockResolvedValue({
      id: 1,
      categoryId: 10,
      subCategoryId: 100,
      soldOut: false,
    })
    mockSubCategoryFindFirst.mockResolvedValue({ id: 200, categoryId: 20 })
    mockMenuItemUpdate.mockResolvedValue(updated)

    const res = await app.inject({
      method: 'PUT',
      url: '/api/menus/1',
      headers: { cookie: `token=${token()}` },
      payload: { categoryId: 20, subCategoryId: 200 },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject(updated)
    expect(mockSubCategoryFindFirst).toHaveBeenCalledWith({
      where: { id: 200, storeId: STORE_ID },
    })
    expect(mockMenuItemUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({ categoryId: 20, subCategoryId: 200 }),
    })
  })

  it('subCategoryId: null は整合性検証をスキップして成功する', async () => {
    const updated = { id: 1, categoryId: 10, subCategoryId: 100, soldOut: false }
    mockMenuItemFindFirst.mockResolvedValue({
      id: 1,
      categoryId: 10,
      subCategoryId: 100,
      soldOut: false,
    })
    mockMenuItemUpdate.mockResolvedValue(updated)

    const res = await app.inject({
      method: 'PUT',
      url: '/api/menus/1',
      headers: { cookie: `token=${token()}` },
      payload: { subCategoryId: null },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject(updated)
    expect(mockSubCategoryFindFirst).not.toHaveBeenCalled()
    expect(mockMenuItemUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({ subCategoryId: undefined }),
    })
  })
})

describe('DELETE /api/menus/:id — 削除制御', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>

  beforeAll(async () => {
    app = await buildTestApp()
  })
  afterAll(async () => {
    await app.close()
  })
  beforeEach(() => {
    jest.clearAllMocks()
    mockCourseFoodItemCount.mockResolvedValue(0)
    mockDrinkPlanItemCount.mockResolvedValue(0)
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        orderItem: { count: mockOrderItemCount },
        menuItem: { delete: mockMenuItemDelete },
        courseFoodItem: { count: mockCourseFoodItemCount },
        drinkPlanItem: { count: mockDrinkPlanItemCount },
      }
      return cb(tx)
    })
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

  it('pending の注文があれば 409 を返す', async () => {
    mockMenuItemFindFirst.mockResolvedValue({ id: 1 })
    mockOrderItemCount.mockResolvedValue(1)
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/menus/1',
      headers: { cookie: `token=${token()}` },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({
      error: { message: '処理中の注文があるため削除できません' },
    })
    expect(mockMenuItemDelete).not.toHaveBeenCalled()
  })

  it('ready の注文があれば 409 を返す', async () => {
    mockMenuItemFindFirst.mockResolvedValue({ id: 2 })
    mockOrderItemCount.mockResolvedValue(3)
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/menus/2',
      headers: { cookie: `token=${token()}` },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({
      error: { message: '処理中の注文があるため削除できません' },
    })
    expect(mockMenuItemDelete).not.toHaveBeenCalled()
  })

  it('処理中の注文がなければ 204 を返す', async () => {
    mockMenuItemFindFirst.mockResolvedValue({ id: 1 })
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
    mockMenuItemFindFirst.mockResolvedValue(null)
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/menus/999',
      headers: { cookie: `token=${token()}` },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ error: { message: 'メニューが見つかりません' } })
    expect(mockMenuItemDelete).not.toHaveBeenCalled()
  })

  it('コースから参照されていれば 409 を返す', async () => {
    mockMenuItemFindFirst.mockResolvedValue({ id: 3 })
    mockOrderItemCount.mockResolvedValue(0)
    mockCourseFoodItemCount.mockResolvedValue(1)
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/menus/3',
      headers: { cookie: `token=${token()}` },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({
      error: { message: 'コースに含まれているメニューは削除できません' },
    })
    expect(mockMenuItemDelete).not.toHaveBeenCalled()
  })

  it('飲み放題プランから参照されていれば 409 を返す', async () => {
    mockMenuItemFindFirst.mockResolvedValue({ id: 4 })
    mockOrderItemCount.mockResolvedValue(0)
    mockDrinkPlanItemCount.mockResolvedValue(1)
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/menus/4',
      headers: { cookie: `token=${token()}` },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({
      error: { message: '飲み放題プランに含まれているメニューは削除できません' },
    })
    expect(mockMenuItemDelete).not.toHaveBeenCalled()
  })

  it('チェック通過後に競合してFK制約違反(P2003)になった場合も409を返す', async () => {
    mockMenuItemFindFirst.mockResolvedValue({ id: 5 })
    mockOrderItemCount.mockResolvedValue(0)
    mockTransaction.mockImplementation(async () => {
      throw new Prisma.PrismaClientKnownRequestError('FK制約違反', {
        code: 'P2003',
        clientVersion: 'test',
      })
    })
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/menus/5',
      headers: { cookie: `token=${token()}` },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({
      error: { message: 'コースまたは飲み放題プランで使用されているため削除できません' },
    })
  })
})
