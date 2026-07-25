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
      name: 'セット注文検証グループ',
      guestCount: 2,
      sessionId: session.id,
      storeId,
      seats: seat ? { create: [{ seatId: seat.id }] } : undefined,
    },
  })
  return { session, group, seat }
}

let setProductCounter = 0

// ドリンク枠（生ビール / ウーロン茶）・フード枠（唐揚げ / たこ焼き）の2枠×2選択肢を持つセット商品を作成する。
// 商品名は呼び出し側で一意な値を渡し、resetDb で削除されない MenuItem の蓄積によるUIロケータの曖昧化を避ける。
async function setupSetProduct(storeId: number, name: string) {
  setProductCounter += 1
  const beer = await prisma.menuItem.findFirstOrThrow({
    where: { name: SEED.menuItems.beer, storeId },
  })
  const karaage = await prisma.menuItem.findFirstOrThrow({
    where: { name: SEED.menuItems.karaage, storeId },
  })
  const oolong = await prisma.menuItem.create({
    data: {
      storeId,
      name: `ウーロン茶${setProductCounter}`,
      price: 400,
      categoryId: beer.categoryId,
      subCategoryId: beer.subCategoryId,
      takeout: 'dine_in',
    },
  })
  const takoyaki = await prisma.menuItem.create({
    data: {
      storeId,
      name: `たこ焼き${setProductCounter}`,
      price: 500,
      categoryId: karaage.categoryId,
      subCategoryId: karaage.subCategoryId,
      takeout: 'both',
    },
  })
  const setItem = await prisma.menuItem.create({
    data: {
      storeId,
      name,
      price: 900,
      categoryId: karaage.categoryId,
      subCategoryId: karaage.subCategoryId,
      takeout: 'dine_in',
      isSet: true,
      setFrames: {
        create: [
          {
            storeId,
            name: 'ドリンク',
            sort: 0,
            choices: {
              create: [
                { menuItemId: beer.id, sort: 0 },
                { menuItemId: oolong.id, sort: 1 },
              ],
            },
          },
          {
            storeId,
            name: 'フード',
            sort: 1,
            choices: {
              create: [
                { menuItemId: karaage.id, sort: 0 },
                { menuItemId: takoyaki.id, sort: 1 },
              ],
            },
          },
        ],
      },
    },
  })
  return { setItem, beer, karaage, oolong, takoyaki }
}

async function openSetFrameSheet(page: import('@playwright/test').Page, itemName: string) {
  await page.getByRole('button', { name: ja.group.menuTab, exact: true }).click()
  // セット商品は唐揚げと同じ「フード」カテゴリに属する。デフォルトの選択中タブは
  // sort順で先頭の「ドリンク」のため、フードタブへ切り替えないと商品行が描画されない。
  await page.getByRole('button', { name: SEED.categories.food, exact: true }).click()
  await page
    .locator('.px-5.py-3.border-b.border-surface')
    .filter({ hasText: itemName })
    .getByRole('button', { name: ja.orderOption.selectButton })
    .click()
}

test.beforeEach(async ({ page }) => {
  await resetDb(getStore().id)
  await loginAs(page, 'staff')
})

test.afterAll(async () => {
  await disconnect()
})

test('シナリオ1: 管理画面でセット商品を作成し、枠と選択肢を保存・再表示できる', async ({
  page,
}) => {
  const storeId = getStore().id
  const beer = await prisma.menuItem.findFirstOrThrow({
    where: { name: SEED.menuItems.beer, storeId },
  })
  const karaage = await prisma.menuItem.findFirstOrThrow({
    where: { name: SEED.menuItems.karaage, storeId },
  })
  const ginger = await prisma.menuItem.create({
    data: {
      storeId,
      name: 'ジンジャエール',
      price: 450,
      categoryId: beer.categoryId,
      subCategoryId: beer.subCategoryId,
      takeout: 'dine_in',
    },
  })
  const fries = await prisma.menuItem.create({
    data: {
      storeId,
      name: 'ポテトフライ',
      price: 480,
      categoryId: karaage.categoryId,
      subCategoryId: karaage.subCategoryId,
      takeout: 'both',
    },
  })

  await loginAs(page, 'admin')

  await page.goto(ROUTES.adminProducts)
  await page.getByRole('button', { name: ja.productSettings.addProductBtn }).click()
  await page.getByPlaceholder(ja.productSettings.namePlaceholder).fill('ドリンクフードセット')
  await page.getByPlaceholder(ja.productSettings.pricePlaceholder).fill('900')
  await page.locator('select').first().selectOption({ label: SEED.subCategories.alcohol })

  await page.getByRole('checkbox').check()

  await page.getByText(ja.productSettings.addSetFrame).click()
  await page.getByText(ja.productSettings.addSetFrame).click()

  const frameNameInputs = page.getByPlaceholder(ja.productSettings.setFrameNamePlaceholder)
  await frameNameInputs.nth(0).fill('ドリンク')
  await frameNameInputs.nth(1).fill('フード')

  const addChoiceButtons = page.getByText(ja.productSettings.addSetFrameChoice)
  await addChoiceButtons.nth(0).click()
  await addChoiceButtons.nth(0).click()
  await addChoiceButtons.nth(1).click()
  await addChoiceButtons.nth(1).click()

  const selects = page.locator('select')
  await selects.nth(2).selectOption({ label: SEED.menuItems.beer })
  await selects.nth(3).selectOption({ label: ginger.name })
  await selects.nth(4).selectOption({ label: SEED.menuItems.karaage })
  await selects.nth(5).selectOption({ label: fries.name })

  await page.getByRole('button', { name: ja.common.add, exact: true }).click()

  await expect(page.getByText('ドリンクフードセット').first()).toBeVisible()

  await page.getByText('ドリンクフードセット').first().click()
  await expect(
    page.getByPlaceholder(ja.productSettings.setFrameNamePlaceholder).nth(0),
  ).toHaveValue('ドリンク')
  await expect(
    page.getByPlaceholder(ja.productSettings.setFrameNamePlaceholder).nth(1),
  ).toHaveValue('フード')

  const reopenedSelects = page.locator('select')
  await expect(reopenedSelects.nth(2)).toHaveValue(String(beer.id))
  await expect(reopenedSelects.nth(3)).toHaveValue(String(ginger.id))
  await expect(reopenedSelects.nth(4)).toHaveValue(String(karaage.id))
  await expect(reopenedSelects.nth(5)).toHaveValue(String(fries.id))
})

test('シナリオ2: セットを注文すると内訳商品の個別価格が加算されずセット価格通りになる', async ({
  page,
}) => {
  const { group } = await setupGroup()
  const { setItem, beer, karaage } = await setupSetProduct(getStore().id, 'ドリンクフードセットB')

  await page.goto(ROUTES.hallGroup(group.id))
  await openSetFrameSheet(page, setItem.name)

  const radios = page.getByRole('radio')
  await radios.nth(0).check()
  await radios.nth(2).check()
  await page.getByRole('button', { name: ja.common.add, exact: true }).click()

  await page.getByRole('button', { name: ja.group.reviewOrder }).click()
  await expect(page.getByText(`¥${setItem.price.toLocaleString()}`).first()).toBeVisible()
  await page.getByRole('button', { name: ja.group.confirmOrderDineIn }).click()

  await expect
    .poll(async () => prisma.orderItem.count({ where: { groupId: group.id, isSetCharge: true } }))
    .toBe(1)
  const parent = await prisma.orderItem.findFirstOrThrow({
    where: { groupId: group.id, isSetCharge: true },
  })
  expect(parent.price).toBe(setItem.price)
  const children = await prisma.orderItem.findMany({ where: { setOrderItemId: parent.id } })
  expect(children).toHaveLength(2)
  for (const child of children) expect(child.price).toBe(0)
  expect(children.map((c) => c.menuItemName).sort()).toEqual([beer.name, karaage.name].sort())

  await page.getByRole('button', { name: ja.group.orderHistory }).click()
  await expect(page.getByText(`¥${setItem.price.toLocaleString()}`).first()).toBeVisible()
})

test('シナリオ2: いずれかの枠が未選択では追加ボタンが無効', async ({ page }) => {
  const { group } = await setupGroup()
  const { setItem } = await setupSetProduct(getStore().id, 'ドリンクフードセットC')

  await page.goto(ROUTES.hallGroup(group.id))
  await openSetFrameSheet(page, setItem.name)

  const radios = page.getByRole('radio')
  await radios.nth(0).check()
  await expect(page.getByRole('button', { name: ja.common.add, exact: true })).toBeDisabled()

  await radios.nth(2).check()
  await expect(page.getByRole('button', { name: ja.common.add, exact: true })).toBeEnabled()
})

test('シナリオ2: 同じセットを別の内訳で2回注文すると独立した注文として記録される', async ({
  page,
}) => {
  const { group } = await setupGroup()
  const { setItem } = await setupSetProduct(getStore().id, 'ドリンクフードセットD')

  await page.goto(ROUTES.hallGroup(group.id))

  await openSetFrameSheet(page, setItem.name)
  await page.getByRole('radio').nth(0).check()
  await page.getByRole('radio').nth(2).check()
  await page.getByRole('button', { name: ja.common.add, exact: true }).click()
  await page.getByRole('button', { name: ja.group.reviewOrder }).click()
  await page.getByRole('button', { name: ja.group.confirmOrderDineIn }).click()

  await expect
    .poll(async () => prisma.orderItem.count({ where: { groupId: group.id, isSetCharge: true } }))
    .toBe(1)

  await openSetFrameSheet(page, setItem.name)
  await page.getByRole('radio').nth(1).check()
  await page.getByRole('radio').nth(3).check()
  await page.getByRole('button', { name: ja.common.add, exact: true }).click()
  await page.getByRole('button', { name: ja.group.reviewOrder }).click()
  await page.getByRole('button', { name: ja.group.confirmOrderDineIn }).click()

  await expect
    .poll(async () => prisma.orderItem.count({ where: { groupId: group.id, isSetCharge: true } }))
    .toBe(2)

  const parents = await prisma.orderItem.findMany({
    where: { groupId: group.id, isSetCharge: true },
  })
  const childCounts = await Promise.all(
    parents.map((parent) => prisma.orderItem.count({ where: { setOrderItemId: parent.id } })),
  )
  expect(childCounts).toEqual([2, 2])

  const allChildren = await prisma.orderItem.findMany({
    where: { groupId: group.id, setOrderItemId: { not: null } },
  })
  expect(allChildren).toHaveLength(4)
  // 1回目（生ビール・唐揚げ）と2回目（ウーロン茶・たこ焼き）で内訳が重複しない＝独立した注文として記録されている
  expect(new Set(allChildren.map((c) => c.menuItemName)).size).toBe(4)
})

test('シナリオ3: 厨房に内訳商品が独立チケットとして表示され、注文履歴でセット単位にまとまる', async ({
  page,
}) => {
  const { group } = await setupGroup()
  const { setItem, beer, karaage } = await setupSetProduct(getStore().id, 'ドリンクフードセットE')

  await page.goto(ROUTES.hallGroup(group.id))
  await openSetFrameSheet(page, setItem.name)
  await page.getByRole('radio').nth(0).check()
  await page.getByRole('radio').nth(2).check()
  await page.getByRole('button', { name: ja.common.add, exact: true }).click()
  await page.getByRole('button', { name: ja.group.reviewOrder }).click()
  await page.getByRole('button', { name: ja.group.confirmOrderDineIn }).click()

  await expect
    .poll(async () => prisma.orderItem.count({ where: { groupId: group.id, isSetCharge: true } }))
    .toBe(1)

  await page.goto(ROUTES.kitchen)
  await expect(page.getByText(beer.name)).toBeVisible()
  await expect(page.getByText(karaage.name)).toBeVisible()
  // セット親明細は作成時点で status: 'served' のため、厨房のpending/readyチケットには現れない
  await expect(page.getByText(setItem.name)).not.toBeVisible()

  await page.goto(ROUTES.hallGroup(group.id))
  await page.getByRole('button', { name: ja.group.orderHistory }).click()
  const setSection = page.locator('div.mt-1').filter({ hasText: ja.group.setTab })
  await expect(setSection.getByText(setItem.name)).toBeVisible()
  await expect(setSection.getByText(beer.name)).toBeVisible()
  await expect(setSection.getByText(karaage.name)).toBeVisible()
})

test('シナリオ4: セット親明細をキャンセルすると内訳の子明細も連動してキャンセルされる', async ({
  page,
}) => {
  const { group } = await setupGroup()
  const { setItem } = await setupSetProduct(getStore().id, 'ドリンクフードセットF')

  await page.goto(ROUTES.hallGroup(group.id))
  await openSetFrameSheet(page, setItem.name)
  await page.getByRole('radio').nth(0).check()
  await page.getByRole('radio').nth(2).check()
  await page.getByRole('button', { name: ja.common.add, exact: true }).click()
  await page.getByRole('button', { name: ja.group.reviewOrder }).click()
  await page.getByRole('button', { name: ja.group.confirmOrderDineIn }).click()

  await expect
    .poll(async () => prisma.orderItem.count({ where: { groupId: group.id, isSetCharge: true } }))
    .toBe(1)
  const parent = await prisma.orderItem.findFirstOrThrow({
    where: { groupId: group.id, isSetCharge: true },
  })

  await page.getByRole('button', { name: ja.group.orderHistory }).click()
  await page.getByRole('button', { name: ja.group.cancelOrder }).click()
  await page.getByRole('button', { name: ja.group.cancelConfirm }).click()

  await expect
    .poll(
      async () => (await prisma.orderItem.findUniqueOrThrow({ where: { id: parent.id } })).status,
    )
    .toBe('cancelled')
  const children = await prisma.orderItem.findMany({ where: { setOrderItemId: parent.id } })
  expect(children).toHaveLength(2)
  for (const child of children) expect(child.status).toBe('cancelled')
})

test('シナリオ5: 枠の選択肢商品を削除しても過去のセット注文明細は変化しない', async ({ page }) => {
  const storeId = getStore().id
  const { group } = await setupGroup()
  const { setItem, oolong, beer, karaage } = await setupSetProduct(storeId, 'ドリンクフードセットG')

  const parent = await prisma.orderItem.create({
    data: {
      groupId: group.id,
      menuItemId: setItem.id,
      menuItemName: setItem.name,
      price: setItem.price,
      originalPrice: setItem.price,
      qty: 1,
      isTakeout: false,
      isSetCharge: true,
      status: 'served',
      storeId,
    },
  })
  const childOolong = await prisma.orderItem.create({
    data: {
      groupId: group.id,
      menuItemId: oolong.id,
      menuItemName: oolong.name,
      price: 0,
      originalPrice: oolong.price,
      qty: 1,
      isTakeout: false,
      setOrderItemId: parent.id,
      storeId,
    },
  })
  await prisma.orderItem.create({
    data: {
      groupId: group.id,
      menuItemId: karaage.id,
      menuItemName: karaage.name,
      price: 0,
      originalPrice: karaage.price,
      qty: 1,
      isTakeout: false,
      setOrderItemId: parent.id,
      storeId,
    },
  })

  const frameBefore = await prisma.setFrame.findFirstOrThrow({
    where: { menuItemId: setItem.id, name: 'ドリンク' },
    include: { choices: true },
  })
  expect(frameBefore.choices).toHaveLength(2)

  await prisma.menuItem.delete({ where: { id: oolong.id } })

  const frameAfter = await prisma.setFrame.findFirstOrThrow({
    where: { id: frameBefore.id },
    include: { choices: true },
  })
  expect(frameAfter.choices).toHaveLength(1)
  expect(frameAfter.choices[0].menuItemId).toBe(beer.id)

  const afterChild = await prisma.orderItem.findUniqueOrThrow({ where: { id: childOolong.id } })
  expect(afterChild.menuItemId).toBeNull()
  expect(afterChild.menuItemName).toBe(oolong.name)
  expect(afterChild.price).toBe(0)

  await page.goto(ROUTES.hallGroup(group.id))
  await page.getByRole('button', { name: ja.group.orderHistory }).click()
  await expect(page.getByText(oolong.name).first()).toBeVisible()
  await expect(page.getByText(`¥${setItem.price.toLocaleString()}`).first()).toBeVisible()
})
