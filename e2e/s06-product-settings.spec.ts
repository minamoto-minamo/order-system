import { resetDb, prisma, disconnect } from './helpers/db'
import { loginAs } from './helpers/auth'
import { testWithStore } from './helpers/testWithStore'
import { ROUTES } from '../frontend/src/lib/routes'
import { SEED } from './helpers/seeds'
import ja from '../frontend/src/i18n/locales/ja'

const { test, expect, getStore } = testWithStore()

const NEW_CATEGORY = '新カテゴリ'
const TEST_PRODUCT = 'テスト商品'

test.beforeEach(async ({ page }) => {
  await resetDb(getStore().id)
  await loginAs(page, 'admin')
})

test.afterAll(async () => {
  await disconnect()
})

test('商品設定ページが表示される', async ({ page }) => {
  await page.goto(ROUTES.adminProducts)
  await expect(page.getByText(ja.admin.products)).toBeVisible()
})

test('カテゴリ一覧が表示される', async ({ page }) => {
  await page.goto(ROUTES.adminProducts)
  await expect(page.getByText(SEED.categories.food, { exact: true })).toBeVisible()
  await expect(page.getByText(SEED.categories.drink, { exact: true })).toBeVisible()
})

test('商品一覧がAPIから読み込まれる', async ({ page }) => {
  await page.goto(ROUTES.adminProducts)
  await expect(page.getByText(SEED.menuItems.beer)).toBeVisible()
  await expect(page.getByText(SEED.menuItems.karaage, { exact: true })).toBeVisible()
})

test('大分類を追加できる', async ({ page }) => {
  await page.goto(ROUTES.adminProducts)
  await page.getByText(ja.productSettings.addCategory).click()
  await page.getByPlaceholder('例：ドリンク').fill(NEW_CATEGORY)
  await page.getByRole('button', { name: ja.common.confirm }).click()
  await expect(page.getByText(NEW_CATEGORY).first()).toBeVisible()
})

test('商品を追加できる', async ({ page }) => {
  await page.goto(ROUTES.adminProducts)
  await page.getByRole('button', { name: ja.productSettings.addProductBtn }).click()
  await page.getByPlaceholder('例：生ビール').fill(TEST_PRODUCT)
  await page.getByPlaceholder('例：550').fill('999')
  await page.locator('select').first().selectOption({ label: SEED.subCategories.alcohol })
  await page.getByRole('button', { name: ja.common.add, exact: true }).click()
  await expect(page.getByText(TEST_PRODUCT).first()).toBeVisible()
})

test('← 戻るで前の画面に遷移', async ({ page }) => {
  await page.goto(ROUTES.root)
  await page.goto(ROUTES.adminProducts)
  await page.getByRole('button', { name: `← ${ja.admin.menuTitle}` }).click()
  await expect(page).toHaveURL(ROUTES.admin)
})

// カテゴリ欄が画面高を超えたとき overflow-hidden でクリップされスクロール不能だったバグの回帰テスト
test('カテゴリ欄が画面高を超えてもスクロールして操作できる', async ({ page }) => {
  const storeId = getStore().id
  await prisma.category.createMany({
    data: Array.from({ length: 30 }, (_, i) => ({
      name: `カテゴリ${String(i + 1).padStart(2, '0')}`,
      sort: 100 + i,
      storeId,
    })),
  })

  await page.goto(ROUTES.adminProducts)
  const addCategory = page.getByText(ja.productSettings.addCategory)
  await expect(page.getByText('カテゴリ01', { exact: true })).toBeVisible()
  await expect(addCategory).not.toBeInViewport()

  // カテゴリ欄の上でホイールスクロールして最下部の「大分類追加」を表示する
  await page.getByText('カテゴリ01', { exact: true }).hover()
  await page.mouse.wheel(0, 3000)
  await expect(addCategory).toBeInViewport()
})

test('品切れトグルを切り替えられる', async ({ page }) => {
  await page.goto(ROUTES.adminProducts)
  await page.getByText(SEED.menuItems.beer).first().click()
  await page.getByRole('button', { name: ja.productSettings.soldOut }).click()
  // モーダルが閉じた後、商品行に品切れバッジが表示される
  await expect(page.locator('.tappable').filter({ hasText: SEED.menuItems.beer }).getByText(ja.productSettings.soldOut)).toBeVisible()
})
