import ja from '../frontend/src/i18n/locales/ja'
import { ROUTES } from '../frontend/src/lib/routes'
import { CREDS, loginAs } from './helpers/auth'
import { disconnect, prisma, resetDb } from './helpers/db'
import { testWithStore } from './helpers/testWithStore'

const { test, expect, getStore } = testWithStore()

test.beforeEach(async () => {
  await resetDb(getStore().id)
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

test('未入力でログインするとエラーが表示される', async ({ page }) => {
  await page.goto(ROUTES.login)
  await page.getByRole('button', { name: ja.login.submit }).click()
  await expect(page.getByText(ja.login.errorRequired)).toBeVisible()
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

test('未ログイン状態で /admin/products にアクセスすると /login にリダイレクト', async ({
  page,
}) => {
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

// ログイン前に確立した Socket.io 接続が未認証のまま使い回されるバグの回帰テスト。
// リロードを挟むと再ハンドシェイクでバグが隠れるため、UI ログイン後は page.goto を使わない
test('ログイン直後にリロードなしで調理完了ボタンが機能する', async ({ page }) => {
  const storeId = getStore().id
  const session = await prisma.session.create({ data: { status: 'open', storeId } })
  const group = await prisma.group.create({
    data: { name: 'テストグループ', guestCount: 2, sessionId: session.id, storeId },
  })
  const menu = await prisma.menuItem.findFirst({ where: { soldOut: false, storeId } })
  if (!menu) test.skip()
  await prisma.orderItem.create({
    data: {
      groupId: group.id,
      menuItemId: menu!.id,
      menuItemName: menu!.name,
      price: menu!.price,
      qty: 1,
      status: 'pending',
      storeId,
    },
  })

  await page.goto(ROUTES.login)
  await page.getByPlaceholder(ja.login.usernamePlaceholder).fill(CREDS.staff.username)
  await page.getByPlaceholder(ja.login.passwordPlaceholder).fill(CREDS.staff.password)
  await page.getByRole('button', { name: ja.login.submit }).click()
  await expect(page).toHaveURL(ROUTES.root)

  await page.getByRole('button', { name: ja.mode.kitchen }).click()
  await expect(page).toHaveURL(ROUTES.kitchen)

  await page.getByRole('button', { name: ja.kitchen.complete }).first().click()
  await expect(page.getByText(ja.common.readyToServe)).toBeVisible()
})

test('営業開始→ログアウト→ログイン画面リロード→再ログインでも営業中と表示される', async ({
  page,
}) => {
  await page.goto(ROUTES.login)
  await page.getByPlaceholder(ja.login.usernamePlaceholder).fill(CREDS.admin.username)
  await page.getByPlaceholder(ja.login.passwordPlaceholder).fill(CREDS.admin.password)
  await page.getByRole('button', { name: ja.login.submit }).click()
  await expect(page).toHaveURL(ROUTES.root)

  await page.getByRole('button', { name: ja.session.newSessionAction }).click()
  await page.getByRole('button', { name: ja.session.newSessionAction }).last().click()
  await expect(page.getByText(ja.session.open)).toBeVisible()

  await page.getByRole('button', { name: ja.nav.openMenu }).click()
  await page.getByRole('button', { name: ja.nav.logout }).click()
  await expect(page).toHaveURL(ROUTES.login)

  // ログイン画面でのリロードを挟むと未認証状態での初期フェッチが発生する
  await page.reload()

  await page.getByPlaceholder(ja.login.usernamePlaceholder).fill(CREDS.admin.username)
  await page.getByPlaceholder(ja.login.passwordPlaceholder).fill(CREDS.admin.password)
  await page.getByRole('button', { name: ja.login.submit }).click()
  await expect(page).toHaveURL(ROUTES.root)

  await expect(page.getByText(ja.session.open)).toBeVisible()
})
