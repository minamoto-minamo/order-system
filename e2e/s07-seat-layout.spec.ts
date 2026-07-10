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

test('席レイアウト設定ページが表示される', async ({ page }) => {
  await page.goto(ROUTES.adminSeats)
  await expect(page.getByText(ja.admin.seats)).toBeVisible()
})

test('席ラベルがAPIから読み込まれてキャンバスに表示される', async ({ page }) => {
  await page.goto(ROUTES.adminSeats)
  await expect(page.getByText(SEED.seats.a1)).toBeVisible()
  await expect(page.getByText(SEED.seats.ct1)).toBeVisible()
})

test('席とテーブルがキャンバス上に表示される', async ({ page }) => {
  await page.goto(ROUTES.adminSeats)
  await expect(page.locator('.draggable').first()).toBeVisible()
})

test('保存ボタンを押すと完了メッセージが表示される', async ({ page }) => {
  await page.goto(ROUTES.adminSeats)
  await expect(page.getByText(SEED.seats.a1)).toBeVisible()
  await page.getByRole('button', { name: ja.common.save }).click()
  await expect(page.getByText(ja.common.saved)).toBeVisible()
})

test('戻るで前の画面に遷移', async ({ page }) => {
  await page.goto(ROUTES.root)
  await page.goto(ROUTES.adminSeats)
  await page.getByRole('button', { name: ja.admin.menuTitle }).click()
  await expect(page).toHaveURL(ROUTES.admin)
})
