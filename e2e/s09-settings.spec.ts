import ja from '../frontend/src/i18n/locales/ja'
import { ROUTES } from '../frontend/src/lib/routes'
import { loginAs } from './helpers/auth'
import { disconnect, resetDb } from './helpers/db'
import { SEED } from './helpers/seeds'
import { testWithStore } from './helpers/testWithStore'

const { test, expect, getStore } = testWithStore()

test.beforeEach(async ({ page }) => {
  await resetDb(getStore().id)
  await loginAs(page, 'admin')
})

test.afterAll(async () => {
  await disconnect()
})

test('詳細設定ページが表示される', async ({ page }) => {
  await page.goto(ROUTES.adminSettings)
  await expect(page.getByText(ja.settings.title)).toBeVisible()
})

test('店舗名フィールドが表示される', async ({ page }) => {
  await page.goto(ROUTES.adminSettings)
  await expect(page.getByText(ja.settings.storeName)).toBeVisible()
})

test('APIから店舗名が読み込まれる', async ({ page }) => {
  await page.goto(ROUTES.adminSettings)
  await expect(page.locator('input').first()).toHaveValue(SEED.settings.storeName)
})

test('設定を保存すると完了メッセージが表示される', async ({ page }) => {
  await page.goto(ROUTES.adminSettings)
  await page.getByRole('button', { name: ja.common.save }).click()
  await expect(page.getByText(ja.common.saved)).toBeVisible()
})

test('戻るで前の画面に遷移', async ({ page }) => {
  await page.goto(ROUTES.root)
  await page.goto(ROUTES.adminSettings)
  await page.getByRole('button', { name: ja.admin.menuTitle }).click()
  await expect(page).toHaveURL(ROUTES.admin)
})

test('店舗名を変更して保存できる', async ({ page }) => {
  await page.goto(ROUTES.adminSettings)
  const input = page.locator('input').first()
  await input.clear()
  await input.fill('テスト店舗')
  await page.getByRole('button', { name: ja.common.save }).click()
  await expect(page.getByText(ja.common.saved)).toBeVisible()
})

test('税率に上限を超える値を入力するとフォーカスを外した時点で上限にクランプされる', async ({
  page,
}) => {
  await page.goto(ROUTES.adminSettings)
  const taxDineIn = page.locator('input[type="number"]').nth(1)
  await taxDineIn.fill('150')
  await taxDineIn.blur()
  await expect(taxDineIn).toHaveValue('100')
})

test('税率に下限を下回る値を入力するとフォーカスを外した時点で下限にクランプされる', async ({
  page,
}) => {
  await page.goto(ROUTES.adminSettings)
  const taxTakeout = page.locator('input[type="number"]').nth(2)
  await taxTakeout.fill('-5')
  await taxTakeout.blur()
  await expect(taxTakeout).toHaveValue('0')
})
