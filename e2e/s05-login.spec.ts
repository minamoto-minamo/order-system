import { test, expect } from '@playwright/test'
import { resetDb, disconnect } from './helpers/db'
import { loginAs, CREDS } from './helpers/auth'
import { ROUTES } from '../frontend/src/lib/routes'
import ja from '../frontend/src/i18n/locales/ja'

test.beforeEach(async () => {
  await resetDb()
})

test.afterAll(async () => {
  await disconnect()
})

test('ログインページが表示される', async ({ page }) => {
  await page.goto(ROUTES.login)
  await expect(page.getByText(ja.login.title).first()).toBeVisible()
  await expect(page.getByPlaceholder(ja.login.usernamePlaceholder)).toBeVisible()
  await expect(page.getByPlaceholder(ja.login.passwordPlaceholder)).toBeVisible()
})

test('誤ったパスワードでエラーが表示される', async ({ page }) => {
  await page.goto(ROUTES.login)
  await page.getByPlaceholder(ja.login.usernamePlaceholder).fill(CREDS.staff.username)
  await page.getByPlaceholder(ja.login.passwordPlaceholder).fill('wrongpassword')
  await page.getByRole('button', { name: ja.login.submit }).click()
  await expect(page.getByText(ja.login.errorInvalid)).toBeVisible()
})

test('staff でログインすると / にリダイレクト', async ({ page }) => {
  await page.goto(ROUTES.login)
  await page.getByPlaceholder(ja.login.usernamePlaceholder).fill(CREDS.staff.username)
  await page.getByPlaceholder(ja.login.passwordPlaceholder).fill(CREDS.staff.password)
  await page.getByRole('button', { name: ja.login.submit }).click()
  await expect(page).toHaveURL(ROUTES.root)
  await expect(page.getByText(ja.nav.home)).toBeVisible()
})

test('admin でログインすると / にリダイレクト', async ({ page }) => {
  await page.goto(ROUTES.login)
  await page.getByPlaceholder(ja.login.usernamePlaceholder).fill(CREDS.admin.username)
  await page.getByPlaceholder(ja.login.passwordPlaceholder).fill(CREDS.admin.password)
  await page.getByRole('button', { name: ja.login.submit }).click()
  await expect(page).toHaveURL(ROUTES.root)
  await expect(page.getByText(ja.nav.home)).toBeVisible()
})

test('未ログイン状態で /hall にアクセスすると /login にリダイレクト', async ({ page }) => {
  await page.goto(ROUTES.hall)
  await expect(page).toHaveURL(ROUTES.login)
})

test('未ログイン状態で /admin/products にアクセスすると /login にリダイレクト', async ({ page }) => {
  await page.goto(ROUTES.adminProducts)
  await expect(page).toHaveURL(ROUTES.login)
})

test('ログイン済みで /login にアクセスすると / にリダイレクト', async ({ page }) => {
  await loginAs(page, 'staff')
  await page.goto(ROUTES.login)
  await expect(page).toHaveURL(ROUTES.root)
})

test('staff ロールで /admin/products にアクセスすると / にリダイレクト', async ({ page }) => {
  await loginAs(page, 'staff')
  await page.goto(ROUTES.adminProducts)
  await expect(page).toHaveURL(ROUTES.root)
})
