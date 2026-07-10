import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals'
import Fastify from 'fastify'

const mockStoreFindUnique =
  jest.fn<
    (...args: unknown[]) => Promise<{
      id: number
      subdomain: string
      isActive: boolean
    } | null>
  >()
const mockStoreUpdate = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockStoreDelete = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockTransaction = jest.fn<(ops: Promise<unknown>[]) => Promise<unknown>>()

const mockOrderItemDeleteMany = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockGroupDeleteMany = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockSessionDeleteMany = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockCourseDeleteMany = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockDrinkPlanDeleteMany = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockMenuItemDeleteMany = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockSubCategoryDeleteMany = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockCategoryDeleteMany = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockSeatDeleteMany = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockSeatTableDeleteMany = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockStaffDeleteMany = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockSettingDeleteMany = jest.fn<(...args: unknown[]) => Promise<unknown>>()

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    store: { findUnique: mockStoreFindUnique, update: mockStoreUpdate, delete: mockStoreDelete },
    orderItem: { deleteMany: mockOrderItemDeleteMany },
    group: { deleteMany: mockGroupDeleteMany },
    session: { deleteMany: mockSessionDeleteMany },
    course: { deleteMany: mockCourseDeleteMany },
    drinkPlan: { deleteMany: mockDrinkPlanDeleteMany },
    menuItem: { deleteMany: mockMenuItemDeleteMany },
    subCategory: { deleteMany: mockSubCategoryDeleteMany },
    category: { deleteMany: mockCategoryDeleteMany },
    seat: { deleteMany: mockSeatDeleteMany },
    seatTable: { deleteMany: mockSeatTableDeleteMany },
    staff: { deleteMany: mockStaffDeleteMany },
    setting: { deleteMany: mockSettingDeleteMany },
    $transaction: mockTransaction,
  },
}))

const { default: platformStoresRoutes } = await import('../routes/platformStores.js')

const SECRET = 'test-secret'
const STORE_ID = 42

async function buildTestApp() {
  const app = Fastify({ logger: false })
  await app.register(cookie)
  await app.register(jwt, { secret: SECRET })
  await app.register(platformStoresRoutes, { prefix: '/api/platform/stores' })
  await app.ready()
  return app
}

describe('DELETE /api/platform/stores/:id', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>

  beforeAll(async () => {
    app = await buildTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockTransaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops))
    for (const mock of [
      mockOrderItemDeleteMany,
      mockGroupDeleteMany,
      mockSessionDeleteMany,
      mockCourseDeleteMany,
      mockDrinkPlanDeleteMany,
      mockMenuItemDeleteMany,
      mockSubCategoryDeleteMany,
      mockCategoryDeleteMany,
      mockSeatDeleteMany,
      mockSeatTableDeleteMany,
      mockStaffDeleteMany,
      mockSettingDeleteMany,
    ]) {
      mock.mockResolvedValue({ count: 0 })
    }
    mockStoreUpdate.mockResolvedValue({ id: STORE_ID })
    mockStoreDelete.mockResolvedValue({ id: STORE_ID })
  })

  function platformCookie() {
    const token = app.jwt.sign({
      type: 'platform' as const,
      adminId: 'admin-1',
      username: 'platform-admin',
    })
    return `platform_token=${token}`
  }

  it('platform_token がない場合は 401 を返す', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/platform/stores/${STORE_ID}` })
    expect(res.statusCode).toBe(401)
    expect(mockStoreFindUnique).not.toHaveBeenCalled()
  })

  it('存在しない店舗を指定すると 404 を返す', async () => {
    mockStoreFindUnique.mockResolvedValue(null)
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/platform/stores/${STORE_ID}`,
      headers: { cookie: platformCookie() },
    })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toMatchObject({ error: { message: '店舗が見つかりません' } })
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('存在する店舗を削除すると 204 を返し、storeId で全テーブルを削除する', async () => {
    mockStoreFindUnique.mockResolvedValue({ id: STORE_ID, subdomain: 'e2e-test', isActive: true })

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/platform/stores/${STORE_ID}`,
      headers: { cookie: platformCookie() },
    })

    expect(res.statusCode).toBe(204)
    expect(mockStoreUpdate).toHaveBeenCalledWith({
      where: { id: STORE_ID },
      data: { isActive: false },
    })
    expect(mockTransaction).toHaveBeenCalledTimes(1)
    expect(mockOrderItemDeleteMany).toHaveBeenCalledWith({ where: { storeId: STORE_ID } })
    expect(mockGroupDeleteMany).toHaveBeenCalledWith({ where: { storeId: STORE_ID } })
    expect(mockSessionDeleteMany).toHaveBeenCalledWith({ where: { storeId: STORE_ID } })
    expect(mockCourseDeleteMany).toHaveBeenCalledWith({ where: { storeId: STORE_ID } })
    expect(mockDrinkPlanDeleteMany).toHaveBeenCalledWith({ where: { storeId: STORE_ID } })
    expect(mockMenuItemDeleteMany).toHaveBeenCalledWith({ where: { storeId: STORE_ID } })
    expect(mockSubCategoryDeleteMany).toHaveBeenCalledWith({ where: { storeId: STORE_ID } })
    expect(mockCategoryDeleteMany).toHaveBeenCalledWith({ where: { storeId: STORE_ID } })
    expect(mockSeatDeleteMany).toHaveBeenCalledWith({ where: { storeId: STORE_ID } })
    expect(mockSeatTableDeleteMany).toHaveBeenCalledWith({ where: { storeId: STORE_ID } })
    expect(mockStaffDeleteMany).toHaveBeenCalledWith({ where: { storeId: STORE_ID } })
    expect(mockSettingDeleteMany).toHaveBeenCalledWith({ where: { storeId: STORE_ID } })
    expect(mockStoreDelete).toHaveBeenCalledWith({ where: { id: STORE_ID } })
  })

  it('削除トランザクションが失敗すると isActive を true へ戻してログを出す', async () => {
    const error = new Error('delete failed')
    const logError = jest.spyOn(app.log, 'error').mockImplementation(() => undefined)
    mockStoreFindUnique.mockResolvedValue({ id: STORE_ID, subdomain: 'e2e-test', isActive: true })
    mockTransaction.mockRejectedValue(error)

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/platform/stores/${STORE_ID}`,
      headers: { cookie: platformCookie() },
    })

    expect(res.statusCode).toBe(500)
    expect(mockStoreUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: STORE_ID },
      data: { isActive: false },
    })
    expect(mockStoreUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: STORE_ID },
      data: { isActive: true },
    })
    expect(logError).toHaveBeenCalledWith(
      { err: error, storeId: STORE_ID, subdomain: 'e2e-test' },
      'Failed to delete store after deactivation',
    )

    logError.mockRestore()
  })
})
