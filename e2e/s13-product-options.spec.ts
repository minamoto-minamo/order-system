import ja from '../frontend/src/i18n/locales/ja'
import { ROUTES } from '../frontend/src/lib/routes'
import { loginAs } from './helpers/auth'
import { disconnect, prisma, resetDb } from './helpers/db'
import { SEED } from './helpers/seeds'
import { testWithStore } from './helpers/testWithStore'

const { test, expect, getStore } = testWithStore()

async function setupGroup() {
  const storeId = getStore().id
  const session = await prisma.session.create({ data: { status: 'open', storeId } })
  const seat = await prisma.seat.findFirst({ where: { storeId } })
  const group = await prisma.group.create({
    data: {
      name: 'オプション検証グループ',
      guestCount: 2,
      sessionId: session.id,
      storeId,
      seats: seat ? { create: [{ seatId: seat.id }] } : undefined,
    },
  })
  return { session, group, seat }
}

async function setupBeerOptions(storeId: number) {
  const beer = await prisma.menuItem.findFirstOrThrow({
    where: { name: SEED.menuItems.beer, storeId },
  })
  await prisma.productOptionGroup.create({
    data: {
      menuItemId: beer.id,
      storeId,
      name: '氷の状態',
      required: true,
      sort: 0,
      choices: {
        create: [
          { name: 'ロック', extraPrice: 0, sort: 0 },
          { name: 'ソーダ', extraPrice: 0, sort: 1 },
        ],
      },
    },
  })
  await prisma.productOptionGroup.create({
    data: {
      menuItemId: beer.id,
      storeId,
      name: 'サイズ',
      required: false,
      sort: 1,
      choices: {
        create: [
          { name: '小盛り', extraPrice: -1000, sort: 0 },
          { name: '大盛り', extraPrice: 200, sort: 1 },
        ],
      },
    },
  })
  return beer
}

function getRockChoice(choices: { id: number; name: string }[]) {
  const rock = choices.find((choice) => choice.name === 'ロック')
  if (!rock) throw new Error('ロックの選択肢が見つかりません')
  return rock
}

test.beforeEach(async ({ page }) => {
  await resetDb(getStore().id)
  await loginAs(page, 'staff')
})

test.afterAll(async () => {
  await disconnect()
})

test('シナリオ2-3: 必須オプション未選択では追加ボタンが無効', async ({ page }) => {
  const { group } = await setupGroup()
  await setupBeerOptions(getStore().id)

  await page.goto(ROUTES.hallGroup(group.id))
  await page.getByRole('button', { name: ja.group.menuTab, exact: true }).click()
  await page.getByRole('button', { name: ja.orderOption.selectButton }).first().click()

  await expect(page.getByText(ja.orderOption.required)).toBeVisible()
  await expect(page.getByRole('button', { name: ja.common.add, exact: true })).toBeDisabled()
})

test('シナリオ2-2/2-4: 追加課金選択肢を選ぶと金額に加算され、注文明細に反映される', async ({
  page,
}) => {
  const { group } = await setupGroup()
  await setupBeerOptions(getStore().id)

  await page.goto(ROUTES.hallGroup(group.id))
  await page.getByRole('button', { name: ja.group.menuTab, exact: true }).click()
  await page.getByRole('button', { name: ja.orderOption.selectButton }).first().click()

  await page.getByRole('radio').first().check()
  await page.getByRole('button', { name: ja.common.add, exact: true }).click()

  await page.getByRole('button', { name: ja.group.reviewOrder }).click()
  await expect(page.getByText('氷の状態: ロック')).toBeVisible()
  await page.getByRole('button', { name: ja.group.confirmOrderDineIn }).click()

  await page.getByRole('button', { name: ja.group.orderHistory }).click()
  await expect(page.getByText('¥550').first()).toBeVisible()
})

test('シナリオ2-2: 正の追加課金選択肢を選ぶと商品価格に加算されて確定できる', async ({ page }) => {
  const { group } = await setupGroup()
  const beer = await setupBeerOptions(getStore().id)
  const expectedPrice = beer.price + 200

  await page.goto(ROUTES.hallGroup(group.id))
  await page.getByRole('button', { name: ja.group.menuTab, exact: true }).click()
  await page.getByRole('button', { name: ja.orderOption.selectButton }).first().click()

  const radios = page.getByRole('radio')
  await radios.nth(0).check()
  await radios.nth(3).check()
  await page.getByRole('button', { name: ja.common.add, exact: true }).click()

  await page.getByRole('button', { name: ja.group.reviewOrder }).click()
  await expect(page.getByText(`¥${expectedPrice.toLocaleString()}`).first()).toBeVisible()
  await page.getByRole('button', { name: ja.group.confirmOrderDineIn }).click()

  await expect
    .poll(async () => prisma.orderItem.count({ where: { groupId: group.id } }))
    .toBeGreaterThan(0)
  const order = await prisma.orderItem.findFirstOrThrow({ where: { groupId: group.id } })
  expect(order.price).toBe(expectedPrice)

  await page.getByRole('button', { name: ja.group.orderHistory }).click()
  await expect(page.getByText(`¥${expectedPrice.toLocaleString()}`).first()).toBeVisible()
})

test('シナリオ4: マイナス値選択肢で金額が0円未満にならない', async ({ page }) => {
  const { group } = await setupGroup()
  await setupBeerOptions(getStore().id)

  await page.goto(ROUTES.hallGroup(group.id))
  await page.getByRole('button', { name: ja.group.menuTab, exact: true }).click()
  await page.getByRole('button', { name: ja.orderOption.selectButton }).first().click()

  const radios = page.getByRole('radio')
  await radios.nth(0).check()
  await radios.nth(2).check()
  await page.getByRole('button', { name: ja.common.add, exact: true }).click()

  await page.getByRole('button', { name: ja.group.reviewOrder }).click()
  await expect(page.getByText('¥0').first()).toBeVisible()
  await page.getByRole('button', { name: ja.group.confirmOrderDineIn }).click()

  await expect
    .poll(async () => prisma.orderItem.count({ where: { groupId: group.id } }))
    .toBeGreaterThan(0)
  const order = await prisma.orderItem.findFirstOrThrow({ where: { groupId: group.id } })
  expect(order.price).toBe(0)
})

test('シナリオ3-1/3-2: 厨房チケットにオプション名が表示され、会計合計に加算分が反映される', async ({
  page,
}) => {
  const { group } = await setupGroup()
  await setupBeerOptions(getStore().id)
  const beer = await prisma.menuItem.findFirstOrThrow({
    where: { name: SEED.menuItems.beer, storeId: getStore().id },
  })
  const iceGroup = await prisma.productOptionGroup.findFirstOrThrow({
    where: { menuItemId: beer.id, name: '氷の状態' },
    include: { choices: true },
  })
  const rock = getRockChoice(iceGroup.choices)

  await prisma.orderItem.create({
    data: {
      groupId: group.id,
      menuItemId: beer.id,
      menuItemName: beer.name,
      price: beer.price,
      originalPrice: beer.price,
      qty: 1,
      isTakeout: false,
      storeId: getStore().id,
      options: {
        create: [{ groupName: '氷の状態', choiceName: 'ロック', extraPrice: 0, choiceId: rock.id }],
      },
    },
  })

  await page.goto(ROUTES.kitchen)
  await expect(page.getByText('氷の状態: ロック')).toBeVisible()

  await page.goto(ROUTES.hallGroup(group.id))
  await page.getByRole('button', { name: ja.group.orderHistory }).click()
  await expect(page.getByText(ja.group.totalWithTax)).toBeVisible()
  await expect(page.getByText(`¥${beer.price.toLocaleString()}`).first()).toBeVisible()
})

test('シナリオ5: オプション分類削除後も過去注文明細は変化しない', async ({ page }) => {
  const { group } = await setupGroup()
  const storeId = getStore().id
  const beer = await setupBeerOptions(storeId)
  const iceGroup = await prisma.productOptionGroup.findFirstOrThrow({
    where: { menuItemId: beer.id, name: '氷の状態' },
    include: { choices: true },
  })
  const rock = getRockChoice(iceGroup.choices)

  const created = await prisma.orderItem.create({
    data: {
      groupId: group.id,
      menuItemId: beer.id,
      menuItemName: beer.name,
      price: beer.price,
      originalPrice: beer.price,
      qty: 1,
      isTakeout: false,
      storeId,
      options: {
        create: [{ groupName: '氷の状態', choiceName: 'ロック', extraPrice: 0, choiceId: rock.id }],
      },
    },
  })

  await prisma.productOptionGroup.delete({ where: { id: iceGroup.id } })

  const after = await prisma.orderItem.findUniqueOrThrow({
    where: { id: created.id },
    include: { options: true },
  })
  expect(after.price).toBe(beer.price)
  expect(after.options).toHaveLength(1)
  expect(after.options[0].choiceName).toBe('ロック')

  await page.goto(ROUTES.hallGroup(group.id))
  await page.getByRole('button', { name: ja.group.orderHistory }).click()
  await expect(page.getByText(beer.name).first()).toBeVisible()
  await expect(page.getByText(`¥${beer.price.toLocaleString()}`).first()).toBeVisible()
})
