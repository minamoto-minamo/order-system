import { resetDb, prisma, disconnect } from './helpers/db'
import { loginAs } from './helpers/auth'
import { testWithStore } from './helpers/testWithStore'
import { ROUTES } from '../frontend/src/lib/routes'
import { SEED } from './helpers/seeds'
import ja from '../frontend/src/i18n/locales/ja'

const { test, expect, getStore } = testWithStore()

const TEST_GROUP_NAME = 'テストグループ'

async function setupGroup() {
  const storeId = getStore().id
  const session = await prisma.session.create({ data: { status: 'open', storeId } })
  const seat = await prisma.seat.findFirst({ where: { storeId } })
  const group = await prisma.group.create({
    data: {
      name: TEST_GROUP_NAME,
      guestCount: 2,
      sessionId: session.id,
      storeId,
      seats: seat ? { create: [{ seatId: seat.id }] } : undefined,
    },
  })
  return { session, group, seat }
}

test.beforeEach(async ({ page }) => {
  await resetDb(getStore().id)
  await loginAs(page, 'staff')
})

test.afterAll(async () => {
  await disconnect()
})

test('グループ詳細ページが表示される', async ({ page }) => {
  const { group } = await setupGroup()
  await page.goto(ROUTES.hallGroup(group.id))
  await expect(page.getByText(TEST_GROUP_NAME)).toBeVisible()
})

test('タブ「メニュー」「コース」が表示される', async ({ page }) => {
  const { group } = await setupGroup()
  await page.goto(ROUTES.hallGroup(group.id))
  await expect(page.getByRole('button', { name: ja.group.orderHistory })).toBeVisible()
  await expect(page.getByRole('button', { name: ja.group.menuTab })).toBeVisible()
  await expect(page.getByRole('button', { name: ja.group.courseTab })).toBeVisible()
})

test('メニュータブを開いてメニューが表示される', async ({ page }) => {
  const { group } = await setupGroup()
  await page.goto(ROUTES.hallGroup(group.id))
  await page.getByRole('button', { name: ja.group.menuTab, exact: true }).click()
  const firstItem = page.locator('text=¥').first()
  await expect(firstItem).toBeVisible()
})

test('メニューから注文追加 → 注文履歴に表示される', async ({ page }) => {
  const { group } = await setupGroup()
  const menu = await prisma.menuItem.findFirst({ where: { soldOut: false, takeout: { in: ['dine_in', 'both'] }, storeId: getStore().id } })
  if (!menu) test.skip()

  await page.goto(ROUTES.hallGroup(group.id))
  await page.getByRole('button', { name: ja.group.menuTab, exact: true }).click()

  const addBtn = page.locator('button:has-text("＋")').first()
  await expect(addBtn).toBeVisible()
  await addBtn.click()

  const reviewBtn = page.getByRole('button', { name: ja.group.reviewOrder })
  await expect(reviewBtn).toBeVisible()
  await reviewBtn.click()

  const confirmBtn = page.getByRole('button', { name: ja.group.confirmOrderDineIn })
  await expect(confirmBtn).toBeVisible()
  await confirmBtn.click()

  const activeItem = page.locator('.action-btn').first()
  await expect(activeItem).toBeVisible()
})

test('お会計ボタンでモーダルが開く', async ({ page }) => {
  const { group } = await setupGroup()
  await page.goto(ROUTES.hallGroup(group.id))
  await page.getByRole('button', { name: ja.group.orderHistory }).click()
  await page.getByRole('button', { name: ja.group.bill }).click()
  await expect(page.getByText(ja.group.billConfirmTitle)).toBeVisible()
})

test('退店ボタンでモーダルが開く', async ({ page }) => {
  const { group } = await setupGroup()
  await prisma.group.update({ where: { id: group.id }, data: { status: 'bill_requested' } })
  await page.goto(ROUTES.hallGroup(group.id))
  await page.getByRole('button', { name: ja.group.orderHistory }).click()
  await page.getByRole('button', { name: ja.group.checkOut }).click()
  await expect(page.getByText(ja.group.checkOutConfirmTitle)).toBeVisible()
})

test('注文を追加してキャンセルできる', async ({ page }) => {
  const { group } = await setupGroup()
  const menu = await prisma.menuItem.findFirst({ where: { soldOut: false, storeId: getStore().id } })
  if (!menu) test.skip()

  await prisma.orderItem.create({
    data: {
      groupId: group.id,
      menuItemId: menu!.id,
      menuItemName: menu!.name,
      price: menu!.price,
      qty: 1,
      status: 'pending',
      taxRate: 10,
      storeId: getStore().id,
    },
  })

  await page.goto(ROUTES.hallGroup(group.id))
  await page.getByRole('button', { name: ja.group.orderHistory }).click()
  await expect(page.getByText(menu!.name)).toBeVisible()

  await page.locator('button:has-text("×")').first().click()
  await expect(page.getByText(ja.group.cancelQuestion)).toBeVisible()

  await page.getByRole('button', { name: ja.group.cancelConfirm }).click()
  await expect(page.getByText(ja.group.cancelledItems)).toBeVisible()
})

test('コースタブにコース一覧が表示される', async ({ page }) => {
  const { group } = await setupGroup()
  await page.goto(ROUTES.hallGroup(group.id))
  await page.getByRole('button', { name: ja.group.courseTab }).click()
  await expect(page.getByText(SEED.courses.drinkAll)).toBeVisible()
})

test('キッチンルートでもグループ詳細が表示される', async ({ page }) => {
  const { group } = await setupGroup()
  await page.goto(ROUTES.kitchenGroup(group.id))
  await expect(page.getByText(TEST_GROUP_NAME)).toBeVisible()
})
