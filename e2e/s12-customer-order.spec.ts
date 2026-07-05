import { resetDb, prisma, disconnect } from './helpers/db'
import { testWithStore } from './helpers/testWithStore'
import { ROUTES } from '../frontend/src/lib/routes'
import { SEED } from './helpers/seeds'
import ja from '../frontend/src/i18n/locales/ja'

const { test, expect, getStore } = testWithStore()

test.beforeEach(async () => {
  await resetDb(getStore().id)
})

test.afterAll(async () => {
  await disconnect()
})

async function createActiveGroup() {
  const storeId = getStore().id
  const session = await prisma.session.create({ data: { status: 'open', storeId } })
  return prisma.group.create({
    data: { name: 'テストグループ', guestCount: 2, sessionId: session.id, storeId },
  })
}

test('注文画面が表示され、数量を選ぶと注文フッターが出る', async ({ page }) => {
  const group = await createActiveGroup()
  await page.goto(ROUTES.customerOrder(group.id))

  await expect(page.getByText(SEED.menuItems.beer)).toBeVisible()
  await expect(page.getByRole('button', { name: ja.group.reviewOrder })).toHaveCount(0)

  await page.getByRole('button', { name: '＋' }).first().click()
  await expect(page.getByRole('button', { name: ja.group.reviewOrder })).toBeVisible()
})

test('会計リクエスト後は会計ボタンが消え、タブが注文履歴のみになる', async ({ page }) => {
  const group = await createActiveGroup()
  await page.goto(ROUTES.customerOrder(group.id))

  // 会計前：¥ボタンとメニュータブが表示され、数量を選ぶと注文フッターが出る
  await expect(page.getByRole('button', { name: ja.customerOrder.requestBill })).toBeVisible()
  await expect(page.getByRole('button', { name: ja.customerOrder.menuTab })).toBeVisible()
  await page.getByRole('button', { name: '＋' }).first().click()
  await expect(page.getByRole('button', { name: ja.group.reviewOrder })).toBeVisible()

  // 会計リクエスト（¥ボタン → 確認モーダルの実行ボタン）
  await page.getByRole('button', { name: ja.customerOrder.requestBill }).click()
  await page.getByRole('button', { name: ja.customerOrder.requestBill }).last().click()

  // 会計後：¥ボタンとメニュータブが消え、注文履歴タブに切り替わる
  await expect(page.getByRole('button', { name: ja.customerOrder.requestBill })).toHaveCount(0)
  await expect(page.getByRole('button', { name: ja.customerOrder.menuTab })).toHaveCount(0)
  await expect(page.getByRole('button', { name: ja.group.reviewOrder })).toHaveCount(0)
  await expect(page.getByText(ja.customerOrder.noOrders)).toBeVisible()
})

test('会計リクエスト済みグループでは最初からメニュータブが表示されない', async ({ page }) => {
  const storeId = getStore().id
  const session = await prisma.session.create({ data: { status: 'open', storeId } })
  const group = await prisma.group.create({
    data: { name: 'テストグループ', guestCount: 2, sessionId: session.id, storeId, status: 'bill_requested' },
  })

  await page.goto(ROUTES.customerOrder(group.id))
  await expect(page.getByRole('button', { name: ja.customerOrder.historyTab })).toBeVisible()
  await expect(page.getByRole('button', { name: ja.customerOrder.menuTab })).toHaveCount(0)
  await expect(page.getByRole('button', { name: ja.customerOrder.requestBill })).toHaveCount(0)
})
