import { test, expect } from '@playwright/test'
import { resetDb, disconnect } from './helpers/db'
import { loginAs } from './helpers/auth'
import { ROUTES } from '../frontend/src/lib/routes'
import { SEED } from './helpers/seeds'
import ja from '../frontend/src/i18n/locales/ja'

test.beforeEach(async ({ page }) => {
  await resetDb()
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

test('← 戻るで前の画面に遷移', async ({ page }) => {
  await page.goto(ROUTES.root)
  await page.goto(ROUTES.adminSettings)
  await page.getByRole('button', { name: `← ${ja.admin.menuTitle}` }).click()
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
