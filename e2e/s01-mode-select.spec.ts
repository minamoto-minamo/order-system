import ja from '../frontend/src/i18n/locales/ja'
import { ROUTES } from '../frontend/src/lib/routes'
import { loginAs } from './helpers/auth'
import { disconnect, resetDb } from './helpers/db'
import { testWithStore } from './helpers/testWithStore'

const { test, expect, getStore } = testWithStore()

test.beforeEach(async ({ page }) => {
  await resetDb(getStore().id)
  await loginAs(page, 'admin')
})

test.afterAll(async () => {
  await disconnect()
})

test('ページが表示される', async ({ page }) => {
  await page.goto(ROUTES.root)
  await expect(page.getByText(ja.nav.home)).toBeVisible()
})

test('セッションなし状態でホール・キッチンボタンが無効', async ({ page }) => {
  await page.goto(ROUTES.root)
  await expect(page.getByText(ja.session.noSession)).toBeVisible()
  const hallBtn = page.getByRole('button', { name: ja.mode.hall })
  await expect(hallBtn).toBeDisabled()
  const kitchenBtn = page.getByRole('button', { name: ja.mode.kitchen })
  await expect(kitchenBtn).toBeDisabled()
})

async function startNewSession(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: ja.session.newSessionAction }).click()
  await page.getByRole('button', { name: ja.session.newSessionAction }).last().click()
}

test('新しい営業を開始する → 営業中になる', async ({ page }) => {
  await page.goto(ROUTES.root)
  await startNewSession(page)
  await expect(page.getByText(ja.session.open)).toBeVisible()
})

test('営業開始後にホールへ遷移', async ({ page }) => {
  await page.goto(ROUTES.root)
  await startNewSession(page)
  await expect(page.getByText(ja.session.open)).toBeVisible()
  await page.getByRole('button', { name: ja.mode.hall }).click()
  await expect(page).toHaveURL(ROUTES.hall)
})

test('営業開始後にキッチンへ遷移', async ({ page }) => {
  await page.goto(ROUTES.root)
  await startNewSession(page)
  await expect(page.getByText(ja.session.open)).toBeVisible()
  await page.getByRole('button', { name: ja.mode.kitchen }).click()
  await expect(page).toHaveURL(ROUTES.kitchen)
})

test('営業を締める → 締め済みになる', async ({ page }) => {
  await page.goto(ROUTES.root)
  await startNewSession(page)
  await expect(page.getByText(ja.session.open)).toBeVisible()
  await page.getByRole('button', { name: ja.session.closeAction }).click()
  await page.getByRole('button', { name: ja.session.close, exact: true }).click()
  await expect(page.getByText(ja.session.closed)).toBeVisible()
})

test('管理者メニューへ遷移できる', async ({ page }) => {
  await page.goto(ROUTES.root)
  await page.getByRole('button', { name: ja.nav.openMenu }).click()
  await page.getByRole('button', { name: ja.mode.admin, exact: true }).click()
  await expect(page).toHaveURL(ROUTES.admin)
})
