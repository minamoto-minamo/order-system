import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import Fastify from 'fastify'

type Group = { id: string; status: string; drinkPlanId: number | null }
type MenuItem = { id: number; name: string; price: number; soldOut: boolean; takeout?: string }
type DrinkPlanItem = { menuItemId: number }

const mockGroupFindFirst = jest.fn<(...args: unknown[]) => Promise<Group | null>>()
const mockMenuItemFindMany = jest.fn<(...args: unknown[]) => Promise<MenuItem[]>>()
const mockDrinkPlanItemFindMany = jest.fn<(...args: unknown[]) => Promise<DrinkPlanItem[]>>()
const mockSettingFindUnique = jest.fn<(...args: unknown[]) => Promise<{ taxRateInHouse: { toNumber(): number } } | null>>()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockTransaction = jest.fn<(cb: (tx: any) => Promise<any>) => Promise<any>>()

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    group: { findFirst: mockGroupFindFirst },
    menuItem: { findMany: mockMenuItemFindMany },
    drinkPlanItem: { findMany: mockDrinkPlanItemFindMany },
    setting: { findUnique: mockSettingFindUnique },
    $transaction: mockTransaction,
  },
}))

const { default: customerRoutes } = await import('../routes/customer.js')

const GROUP_ID = 'gggggggg-gggg-gggg-gggg-gggggggggggg'
const STORE_ID = 1

async function buildTestApp() {
  const app = Fastify({ logger: false })
  app.decorateRequest('storeId', 0)
  app.addHook('onRequest', async (request) => { request.storeId = STORE_ID })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockIo: any = { emit: jest.fn() }
  mockIo.to = () => mockIo
  app.decorate('io', mockIo)
  await app.register(customerRoutes, { prefix: '/api/customer' })
  await app.ready()
  return app
}

function mockTx(createFn: (...args: unknown[]) => Promise<unknown>) {
  mockTransaction.mockImplementation(async (cb) => {
    const tx = {
      group: { findUnique: () => Promise.resolve({ status: 'active' }) },
      orderItem: { create: createFn },
    }
    return cb(tx)
  })
}

describe('POST /api/customer/orders — 飲み放題プラン対象商品の0円化', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  beforeAll(async () => { app = await buildTestApp() })
  afterAll(async () => { await app.close() })
  beforeEach(() => { jest.clearAllMocks() })

  it('drinkPlan 対象商品を注文すると price が 0 になる', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', drinkPlanId: 5 })
    mockMenuItemFindMany.mockResolvedValue([{ id: 1, name: '生ビール', price: 600, soldOut: false }])
    mockDrinkPlanItemFindMany.mockResolvedValue([{ menuItemId: 1 }])
    mockSettingFindUnique.mockResolvedValue({ taxRateInHouse: { toNumber: () => 10 } })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockCreate = jest.fn<any>().mockResolvedValue({ id: 'item-1', groupId: GROUP_ID, menuItemId: 1, menuItemName: '生ビール', price: 0, originalPrice: 600, qty: 1, status: 'pending', isTakeout: false, taxRate: { toNumber: () => 10 }, courseId: null, orderedAt: new Date() })
    mockTx(mockCreate)

    const res = await app.inject({
      method: 'POST', url: '/api/customer/orders',
      payload: { groupId: GROUP_ID, items: [{ menuItemId: 1, qty: 1 }] },
    })

    expect(res.statusCode).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ menuItemId: 1, price: 0, originalPrice: 600 }),
    }))
  })

  it('drinkPlan が設定されていないグループでは通常単価のまま', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', drinkPlanId: null })
    mockMenuItemFindMany.mockResolvedValue([{ id: 1, name: '生ビール', price: 600, soldOut: false }])
    mockSettingFindUnique.mockResolvedValue({ taxRateInHouse: { toNumber: () => 10 } })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockCreate = jest.fn<any>().mockResolvedValue({ id: 'item-1', groupId: GROUP_ID, menuItemId: 1, menuItemName: '生ビール', price: 600, originalPrice: null, qty: 1, status: 'pending', isTakeout: false, taxRate: { toNumber: () => 10 }, courseId: null, orderedAt: new Date() })
    mockTx(mockCreate)

    const res = await app.inject({
      method: 'POST', url: '/api/customer/orders',
      payload: { groupId: GROUP_ID, items: [{ menuItemId: 1, qty: 1 }] },
    })

    expect(res.statusCode).toBe(201)
    expect(mockDrinkPlanItemFindMany).not.toHaveBeenCalled()
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ menuItemId: 1, price: 600, originalPrice: null }),
    }))
  })

  it('プラン外商品を注文すると 422 を返す', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', drinkPlanId: 5 })
    mockMenuItemFindMany.mockResolvedValue([{ id: 2, name: 'ウーロン茶', price: 300, soldOut: false }])
    mockDrinkPlanItemFindMany.mockResolvedValue([{ menuItemId: 1 }])

    const res = await app.inject({
      method: 'POST', url: '/api/customer/orders',
      payload: { groupId: GROUP_ID, items: [{ menuItemId: 2, qty: 1 }] },
    })

    expect(res.statusCode).toBe(422)
    expect(res.json()).toMatchObject({ error: 'ドリンクプランに含まれていない商品が選択されています' })
  })

  it('テイクアウト専用商品を注文すると 422 を返す', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', drinkPlanId: null })
    mockMenuItemFindMany.mockResolvedValue([{ id: 1, name: '弁当', price: 800, soldOut: false, takeout: 'takeout' }])

    const res = await app.inject({
      method: 'POST', url: '/api/customer/orders',
      payload: { groupId: GROUP_ID, items: [{ menuItemId: 1, qty: 1 }] },
    })

    expect(res.statusCode).toBe(422)
    expect(res.json()).toMatchObject({ error: 'テイクアウト専用の商品は店内でご注文いただけません' })
  })
})
