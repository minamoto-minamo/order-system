import { test, expect } from '@playwright/test'
import { resetDb, disconnect } from './helpers/db'
import { loginAs } from './helpers/auth'
import { ROUTES } from '../frontend/src/lib/routes'
import ja from '../frontend/src/i18n/locales/ja'

test.beforeEach(async ({ page }) => {
  await resetDb()
  await loginAs(page, 'admin')
})

test.afterAll(async () => {
  await disconnect()
})

test('日次レポートページが表示される', async ({ page }) => {
  await page.goto(ROUTES.adminReport)
  await expect(page.getByText(ja.admin.report)).toBeVisible()
})

test('締め済みセッションがない場合は空状態が表示される', async ({ page }) => {
  await page.goto(ROUTES.adminReport)
  await expect(page.getByText(ja.report.noSessions)).toBeVisible()
})

test('締め済みセッションがある場合にセッション一覧とサマリーが表示される', async ({ page }) => {
  const createRes = await page.request.post('/api/sessions')
  const session = await createRes.json() as { id: number }
  await page.request.put(`/api/sessions/${session.id}`, {
    data: { status: 'closed' },
  })

  await page.goto(ROUTES.adminReport)
  await expect(page.locator('button').filter({ hasText: '〜' }).first()).toBeVisible()
  await expect(page.getByText(ja.report.totalSales)).toBeVisible()
  await expect(page.getByText(ja.report.groups)).toBeVisible()
})

test('← 戻るで前の画面に遷移', async ({ page }) => {
  await page.goto(ROUTES.root)
  await page.goto(ROUTES.adminReport)
  await page.getByRole('button', { name: `← ${ja.admin.menuTitle}` }).click()
  await expect(page).toHaveURL(ROUTES.admin)
})
