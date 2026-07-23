import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { Prisma } from '@prisma/client'
import Fastify from 'fastify'

type Group = { id: string; status: string; drinkPlanId: number | null }
type MenuItem = { id: number; name: string; price: number; soldOut: boolean; takeout?: string }
type DrinkPlanItem = { menuItemId: number }
type Category = { id: number; name: string; sort: number }
type SubCategory = { id: number; name: string; sort: number; categoryId: number }

const mockGroupFindFirst = jest.fn<(...args: unknown[]) => Promise<Group | null>>()
const mockGroupFindUniqueOrThrow = jest.fn<(...args: unknown[]) => Promise<Group>>()
const mockMenuItemFindMany = jest.fn<(...args: unknown[]) => Promise<MenuItem[]>>()
const mockDrinkPlanItemFindMany = jest.fn<(...args: unknown[]) => Promise<DrinkPlanItem[]>>()
const mockCategoryFindMany = jest.fn<(...args: unknown[]) => Promise<Category[]>>()
const mockSubCategoryFindMany = jest.fn<(...args: unknown[]) => Promise<SubCategory[]>>()
const mockSettingFindUnique =
  jest.fn<
    (...args: unknown[]) => Promise<{
      taxRateInHouse: { toNumber(): number }
      taxRateTakeout?: { toNumber(): number }
      taxInclusive?: boolean
    } | null>
  >()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockTransaction =
  jest.fn<(cb: (tx: any) => Promise<any>, options?: unknown) => Promise<any>>()

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    group: {
      findFirst: mockGroupFindFirst,
      findUniqueOrThrow: mockGroupFindUniqueOrThrow,
    },
    menuItem: { findMany: mockMenuItemFindMany },
    drinkPlanItem: { findMany: mockDrinkPlanItemFindMany },
    category: { findMany: mockCategoryFindMany },
    subCategory: { findMany: mockSubCategoryFindMany },
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
  app.addHook('onRequest', async (request) => {
    request.storeId = STORE_ID
  })
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

describe('GET /api/customer/groups/:id — 税率設定', () => {
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
      billedTaxRateInHouse: null,
      billedTaxRateTakeout: null,
      billedTaxInclusive: null,
      createdAt: new Date(),
      seats: [],
    } as any)
    mockSettingFindUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'GET',
      url: `/api/customer/groups/${GROUP_ID}`,
    })

    expect(res.statusCode).toBe(500)
    expect(res.json()).toMatchObject({
      error: { code: 'common.setting_not_found', message: '店舗設定が見つかりません' },
    })
  })
})

describe('POST /api/customer/groups/:id/bill — 会計依頼', () => {
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

  it('トランザクション内再検証で active でなくなっていた場合、状態を書き換えず 400/BillRequestNotAllowed を返す', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', drinkPlanId: null })
    mockSettingFindUnique.mockResolvedValue({ taxRateInHouse: { toNumber: () => 10 } })
    const mockTxGroupUpdate = jest.fn()
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        group: { findFirst: () => Promise.resolve(null), update: mockTxGroupUpdate },
        orderItem: { count: jest.fn() },
      }
      return cb(tx)
    })

    const res = await app.inject({
      method: 'POST',
      url: `/api/customer/groups/${GROUP_ID}/bill`,
    })

    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({
      error: { code: 'customer.bill.not_allowed', message: '会計を依頼できない状態です' },
    })
    expect(mockTxGroupUpdate).not.toHaveBeenCalled()
    expect(mockGroupFindUniqueOrThrow).not.toHaveBeenCalled()
  })

  it('active だが未提供（pending/ready）の注文明細が残っている場合、状態を書き換えず 409/UnservedItemsExist を返す', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', drinkPlanId: null })
    mockSettingFindUnique.mockResolvedValue({ taxRateInHouse: { toNumber: () => 10 } })
    const mockTxGroupUpdate = jest.fn()
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        group: {
          findFirst: () => Promise.resolve({ id: GROUP_ID, status: 'active' }),
          update: mockTxGroupUpdate,
        },
        orderItem: { count: () => Promise.resolve(2) },
      }
      return cb(tx)
    })

    const res = await app.inject({
      method: 'POST',
      url: `/api/customer/groups/${GROUP_ID}/bill`,
    })

    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({
      error: {
        code: 'customer.bill.unserved_items_exist',
        message: '未提供の注文が残っているため会計を依頼できません',
        details: { count: 2 },
      },
    })
    expect(mockTxGroupUpdate).not.toHaveBeenCalled()
    expect(mockGroupFindUniqueOrThrow).not.toHaveBeenCalled()
  })

  it('active かつ未提供 0 件の場合は 204 を返し bill_requested に更新して group:updated を emit する', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', drinkPlanId: null })
    mockSettingFindUnique.mockResolvedValue({
      taxRateInHouse: { toNumber: () => 10 },
      taxRateTakeout: { toNumber: () => 8 },
      taxInclusive: false,
    })
    const mockTxGroupUpdate = jest.fn<(...args: unknown[]) => Promise<unknown>>()
    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        group: {
          findFirst: () => Promise.resolve({ id: GROUP_ID, status: 'active' }),
          update: mockTxGroupUpdate,
        },
        orderItem: { count: () => Promise.resolve(0) },
      }
      return cb(tx)
    })
    mockGroupFindUniqueOrThrow.mockResolvedValue({
      id: GROUP_ID,
      name: 'A-1',
      guestCount: 2,
      status: 'bill_requested',
      sessionId: 1,
      courseId: null,
      drinkPlanId: null,
      billedTaxRateInHouse: null,
      billedTaxRateTakeout: null,
      billedTaxInclusive: null,
      createdAt: new Date(),
      seats: [],
    } as any)

    const res = await app.inject({
      method: 'POST',
      url: `/api/customer/groups/${GROUP_ID}/bill`,
    })

    expect(res.statusCode).toBe(204)
    expect(mockTxGroupUpdate).toHaveBeenCalledWith({
      where: { id: GROUP_ID },
      data: { status: 'bill_requested' },
    })
    expect(mockGroupFindUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: GROUP_ID },
      include: { seats: true },
    })
  })
})

describe('GET /api/customer/groups/:id/menus — 飲み放題対象商品の返却', () => {
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

  it('drinkPlan 適用中は対象 menuItemId 一覧を返す', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', drinkPlanId: 5 })
    mockMenuItemFindMany.mockResolvedValue([
      { id: 1, name: '生ビール', price: 600, soldOut: false, takeout: 'both' },
    ])
    mockCategoryFindMany.mockResolvedValue([{ id: 10, name: 'ドリンク', sort: 1 }])
    mockSubCategoryFindMany.mockResolvedValue([
      { id: 100, name: 'ビール', sort: 1, categoryId: 10 },
    ])
    mockDrinkPlanItemFindMany.mockResolvedValue([{ menuItemId: 1 }, { menuItemId: 2 }])

    const res = await app.inject({
      method: 'GET',
      url: `/api/customer/groups/${GROUP_ID}/menus`,
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      drinkPlanMenuItemIds: [1, 2],
      menus: [
        expect.objectContaining({
          id: 1,
          name: '生ビール',
        }),
      ],
    })
  })

  it('drinkPlan 未適用なら対象 menuItemId 一覧は空で返す', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', drinkPlanId: null })
    mockMenuItemFindMany.mockResolvedValue([])
    mockCategoryFindMany.mockResolvedValue([])
    mockSubCategoryFindMany.mockResolvedValue([])

    const res = await app.inject({
      method: 'GET',
      url: `/api/customer/groups/${GROUP_ID}/menus`,
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ drinkPlanMenuItemIds: [] })
    expect(mockDrinkPlanItemFindMany).not.toHaveBeenCalled()
  })
})

describe('POST /api/customer/orders — 飲み放題プラン対象商品の0円化', () => {
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

  it('drinkPlan 対象商品を注文すると price が 0 になる', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', drinkPlanId: 5 })
    mockMenuItemFindMany.mockResolvedValue([
      { id: 1, name: '生ビール', price: 600, soldOut: false },
    ])
    mockDrinkPlanItemFindMany.mockResolvedValue([{ menuItemId: 1 }])
    mockSettingFindUnique.mockResolvedValue({ taxRateInHouse: { toNumber: () => 10 } })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockCreate = jest.fn<any>().mockResolvedValue({
      id: 'item-1',
      groupId: GROUP_ID,
      menuItemId: 1,
      menuItemName: '生ビール',
      price: 0,
      originalPrice: 600,
      qty: 1,
      status: 'pending',
      isTakeout: false,
      taxRate: { toNumber: () => 10 },
      courseId: null,
      orderedAt: new Date(),
    })
    mockTx(mockCreate)

    const res = await app.inject({
      method: 'POST',
      url: '/api/customer/orders',
      payload: { groupId: GROUP_ID, items: [{ menuItemId: 1, qty: 1 }] },
    })

    expect(res.statusCode).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ menuItemId: 1, price: 0, originalPrice: 600 }),
      }),
    )
  })

  it('drinkPlan が設定されていないグループでは通常単価のまま、originalPrice は注文時点単価を持つ', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', drinkPlanId: null })
    mockMenuItemFindMany.mockResolvedValue([
      { id: 1, name: '生ビール', price: 600, soldOut: false },
    ])
    mockSettingFindUnique.mockResolvedValue({ taxRateInHouse: { toNumber: () => 10 } })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockCreate = jest.fn<any>().mockResolvedValue({
      id: 'item-1',
      groupId: GROUP_ID,
      menuItemId: 1,
      menuItemName: '生ビール',
      price: 600,
      originalPrice: 600,
      qty: 1,
      status: 'pending',
      isTakeout: false,
      taxRate: { toNumber: () => 10 },
      courseId: null,
      orderedAt: new Date(),
    })
    mockTx(mockCreate)

    const res = await app.inject({
      method: 'POST',
      url: '/api/customer/orders',
      payload: { groupId: GROUP_ID, items: [{ menuItemId: 1, qty: 1 }] },
    })

    expect(res.statusCode).toBe(201)
    expect(mockDrinkPlanItemFindMany).not.toHaveBeenCalled()
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ menuItemId: 1, price: 600, originalPrice: 600 }),
      }),
    )
  })

  it('Serializable 分離レベルでの作成競合（P2034）でも 409 を返す', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', drinkPlanId: null })
    mockMenuItemFindMany.mockResolvedValue([{ id: 1, name: '枝豆', price: 300, soldOut: false }])
    mockTransaction.mockImplementation(async () => {
      throw new Prisma.PrismaClientKnownRequestError('Transaction failed due to a write conflict', {
        code: 'P2034',
        clientVersion: '5.17.0',
      })
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/customer/orders',
      payload: { groupId: GROUP_ID, items: [{ menuItemId: 1, qty: 1 }] },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({
      error: { message: '他の操作と競合しました。もう一度お試しください' },
    })
    expect(mockTransaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })
  })

  it('注文作成中に対象メニューが削除されて FK 制約違反（P2003）になっても 409 を返す', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', drinkPlanId: null })
    mockMenuItemFindMany.mockResolvedValue([{ id: 1, name: '枝豆', price: 300, soldOut: false }])
    mockTransaction.mockImplementation(async () => {
      throw new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
        code: 'P2003',
        clientVersion: '5.17.0',
      })
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/customer/orders',
      payload: { groupId: GROUP_ID, items: [{ menuItemId: 1, qty: 1 }] },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({
      error: {
        code: 'customer.orders.menu_item_deleted',
        message: '注文対象のメニューが削除されたため、注文を作成できません',
      },
    })
  })

  it('プラン対象外商品のみの注文は拒否されず、通常単価で登録される', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', drinkPlanId: 5 })
    mockMenuItemFindMany.mockResolvedValue([
      { id: 2, name: 'ウーロン茶', price: 300, soldOut: false },
    ])
    mockDrinkPlanItemFindMany.mockResolvedValue([{ menuItemId: 1 }])
    mockSettingFindUnique.mockResolvedValue({ taxRateInHouse: { toNumber: () => 10 } })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockCreate = jest.fn<any>().mockResolvedValue({
      id: 'item-1',
      groupId: GROUP_ID,
      menuItemId: 2,
      menuItemName: 'ウーロン茶',
      price: 300,
      originalPrice: 300,
      qty: 1,
      status: 'pending',
      isTakeout: false,
      taxRate: { toNumber: () => 10 },
      courseId: null,
      orderedAt: new Date(),
    })
    mockTx(mockCreate)

    const res = await app.inject({
      method: 'POST',
      url: '/api/customer/orders',
      payload: { groupId: GROUP_ID, items: [{ menuItemId: 2, qty: 1 }] },
    })

    expect(res.statusCode).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ menuItemId: 2, price: 300, originalPrice: 300 }),
      }),
    )
  })

  it('プラン対象商品と対象外商品が混在する注文は拒否されず、対象商品のみ0円で登録される', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', drinkPlanId: 5 })
    mockMenuItemFindMany.mockResolvedValue([
      { id: 1, name: '生ビール', price: 600, soldOut: false },
      { id: 2, name: 'ウーロン茶', price: 300, soldOut: false },
    ])
    mockDrinkPlanItemFindMany.mockResolvedValue([{ menuItemId: 1 }])
    mockSettingFindUnique.mockResolvedValue({ taxRateInHouse: { toNumber: () => 10 } })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockCreate = jest.fn<any>().mockImplementation((args: any) => {
      const { menuItemId, menuItemName, price, originalPrice, qty } = args.data
      return Promise.resolve({
        id: `item-${menuItemId}`,
        groupId: GROUP_ID,
        menuItemId,
        menuItemName,
        price,
        originalPrice,
        qty,
        status: 'pending',
        isTakeout: false,
        taxRate: { toNumber: () => 10 },
        courseId: null,
        orderedAt: new Date(),
      })
    })
    mockTx(mockCreate)

    const res = await app.inject({
      method: 'POST',
      url: '/api/customer/orders',
      payload: {
        groupId: GROUP_ID,
        items: [
          { menuItemId: 1, qty: 1 },
          { menuItemId: 2, qty: 1 },
        ],
      },
    })

    expect(res.statusCode).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ menuItemId: 1, price: 0, originalPrice: 600 }),
      }),
    )
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ menuItemId: 2, price: 300, originalPrice: 300 }),
      }),
    )
  })

  it('テイクアウト専用商品を注文すると 422 を返す', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', drinkPlanId: null })
    mockMenuItemFindMany.mockResolvedValue([
      { id: 1, name: '弁当', price: 800, soldOut: false, takeout: 'takeout' },
    ])

    const res = await app.inject({
      method: 'POST',
      url: '/api/customer/orders',
      payload: { groupId: GROUP_ID, items: [{ menuItemId: 1, qty: 1 }] },
    })

    expect(res.statusCode).toBe(422)
    expect(res.json()).toMatchObject({
      error: { message: 'テイクアウト専用の商品は店内でご注文いただけません' },
    })
  })

  it('品切れ商品を注文すると 409 と details に品切れ商品の id・name が入る', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', drinkPlanId: null })
    mockMenuItemFindMany.mockResolvedValue([
      { id: 1, name: '生ビール', price: 600, soldOut: true },
      { id: 2, name: 'ウーロン茶', price: 300, soldOut: false },
    ])

    const res = await app.inject({
      method: 'POST',
      url: '/api/customer/orders',
      payload: {
        groupId: GROUP_ID,
        items: [
          { menuItemId: 1, qty: 1 },
          { menuItemId: 2, qty: 1 },
        ],
      },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({
      error: {
        message: '品切れの商品が注文リストに入っています',
        details: { menuItemIds: [1], menuItemNames: ['生ビール'] },
      },
    })
  })
})

describe('POST /api/customer/orders — 商品オプション', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  beforeAll(async () => {
    app = await buildTestApp()
  })
  afterAll(async () => {
    await app.close()
  })
  beforeEach(() => {
    jest.clearAllMocks()
    mockGroupFindFirst.mockResolvedValue({ id: GROUP_ID, status: 'active', drinkPlanId: null })
  })

  const optionedMenu = {
    id: 1,
    name: 'ソーダ',
    price: 100,
    soldOut: false,
    takeout: 'both',
    optionGroups: [
      {
        id: 10,
        name: 'サイズ',
        required: true,
        choices: [
          { id: 101, name: 'メガサイズ', extraPrice: 200 },
          { id: 102, name: '小', extraPrice: -200 },
        ],
      },
    ],
  }

  it('対象商品に属さない選択肢を 400 で拒否する', async () => {
    mockMenuItemFindMany.mockResolvedValue([optionedMenu])
    const res = await app.inject({
      method: 'POST',
      url: '/api/customer/orders',
      payload: { groupId: GROUP_ID, items: [{ menuItemId: 1, qty: 1, selectedChoiceIds: [999] }] },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({ error: { code: 'customer.orders.invalid_option_choice' } })
  })

  it('同一分類からの複数選択を 400 で拒否する', async () => {
    mockMenuItemFindMany.mockResolvedValue([optionedMenu])
    const res = await app.inject({
      method: 'POST',
      url: '/api/customer/orders',
      payload: {
        groupId: GROUP_ID,
        items: [{ menuItemId: 1, qty: 1, selectedChoiceIds: [101, 102] }],
      },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({
      error: { code: 'customer.orders.duplicate_option_group_selection' },
    })
  })

  it('必須分類が未選択なら 400 を返す', async () => {
    mockMenuItemFindMany.mockResolvedValue([optionedMenu])
    const res = await app.inject({
      method: 'POST',
      url: '/api/customer/orders',
      payload: { groupId: GROUP_ID, items: [{ menuItemId: 1, qty: 1 }] },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({ error: { code: 'customer.orders.missing_required_option' } })
  })

  it('選択肢の金額を加算し、0円未満は0円にクランプして保存する', async () => {
    mockMenuItemFindMany.mockResolvedValue([optionedMenu])
    const mockCreate = jest.fn<any>().mockImplementation(({ data }: any) =>
      Promise.resolve({
        id: 'item-1',
        groupId: GROUP_ID,
        menuItemId: data.menuItemId,
        menuItemName: data.menuItemName,
        price: data.price,
        qty: data.qty,
        status: 'pending',
        isTakeout: false,
        courseId: null,
        isCourseCharge: false,
        isDrinkPlanCharge: false,
        orderedAt: new Date(),
        options: [],
      }),
    )
    mockTx(mockCreate)
    const res = await app.inject({
      method: 'POST',
      url: '/api/customer/orders',
      payload: { groupId: GROUP_ID, items: [{ menuItemId: 1, qty: 1, selectedChoiceIds: [102] }] },
    })
    expect(res.statusCode).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          price: 0,
          originalPrice: 100,
          options: expect.objectContaining({
            create: [expect.objectContaining({ choiceId: 102, extraPrice: -200 })],
          }),
        }),
        include: { options: true },
      }),
    )
  })
})
