import ja from '../frontend/src/i18n/locales/ja'
import { ROUTES } from '../frontend/src/lib/routes'
import { CREDS, loginAs } from './helpers/auth'
import { disconnect, resetDb } from './helpers/db'
import { testWithStore } from './helpers/testWithStore'

const { test, expect, getStore } = testWithStore()

test.beforeEach(async () => {
  await resetDb(getStore().id)
})

test.afterAll(async () => {
  await disconnect()
})

// アクセストークンの cookie を壊し、jwtVerify が失敗する状態を作る（透過リフレッシュの発火条件を再現）
async function corruptAccessToken(page: import('@playwright/test').Page) {
  const cookies = await page.context().cookies()
  const token = cookies.find((c) => c.name === 'token')
  if (!token) throw new Error('token cookie が見つからない')
  await page.context().addCookies([{ ...token, value: `${token.value}-corrupted` }])
}

test('アクセストークン失効後、有効な refresh_token があれば透過的にリフレッシュされ 200 が返る', async ({
  page,
}) => {
  await loginAs(page, 'staff')
  const before = await page.context().cookies()
  const refreshBefore = before.find((c) => c.name === 'refresh_token')?.value

  await corruptAccessToken(page)
  const res = await page.request.get('/api/auth/me')
  expect(res.status()).toBe(200)

  const after = await page.context().cookies()
  const tokenAfter = after.find((c) => c.name === 'token')?.value
  const refreshAfter = after.find((c) => c.name === 'refresh_token')?.value
  expect(tokenAfter).toBeTruthy()
  expect(refreshAfter).toBeTruthy()
  expect(refreshAfter).not.toBe(refreshBefore)
})

test('複数タブ相当の同時リクエストでも誤って reuse 検知されず、どちらも成功する', async ({
  page,
}) => {
  await loginAs(page, 'staff')
  await corruptAccessToken(page)

  const [res1, res2] = await Promise.all([
    page.request.get('/api/auth/me'),
    page.request.get('/api/auth/me'),
  ])
  expect(res1.status()).toBe(200)
  expect(res2.status()).toBe(200)

  // 誤検知で全端末が無効化されていないことを、後続リクエストが引き続き成功することで確認
  const res3 = await page.request.get('/api/auth/me')
  expect(res3.status()).toBe(200)
})

test('admin がスタッフの端末を強制ログアウトすると、その端末は以後 401 になる', async ({
  browser,
}) => {
  const baseURL = getStore().baseURL
  const adminContext = await browser.newContext({ baseURL })
  const staffContext = await browser.newContext({ baseURL })
  const adminPage = await adminContext.newPage()
  const staffPage = await staffContext.newPage()

  await loginAs(staffPage, 'staff')
  await loginAs(adminPage, 'admin')

  await adminPage.goto(ROUTES.adminStaff)
  // hasText はテキストを含む祖先 div も拾うため、最も内側（一覧の行そのもの）を last() で選ぶ
  const staffRow = adminPage
    .locator('div', { hasText: CREDS.staff.username })
    .filter({ has: adminPage.getByRole('button', { name: ja.staff.devices.button }) })
    .last()
  await staffRow.getByRole('button', { name: ja.staff.devices.button }).click()
  await adminPage.getByRole('button', { name: ja.staff.devices.revoke }).first().click()
  await adminPage.getByRole('button', { name: ja.staff.devices.revoke }).last().click()
  await expect(adminPage.getByText(ja.staff.devices.revoked)).toBeVisible()

  await corruptAccessToken(staffPage)
  const res = await staffPage.request.get('/api/auth/me')
  expect(res.status()).toBe(401)

  await adminContext.close()
  await staffContext.close()
})

test('Settings 画面でセッション有効期限方式を固定期限に切り替えて保存できる', async ({ page }) => {
  await loginAs(page, 'admin')
  await page.goto(ROUTES.adminSettings)
  await page.getByRole('button', { name: ja.settings.refreshFixedExpiry }).click()
  await page.getByRole('button', { name: ja.common.save }).click()
  await expect(page.getByText(ja.common.saved)).toBeVisible()

  const res = await page.request.get('/api/settings')
  expect((await res.json()).refreshTokenAutoExtend).toBe(false)

  // 他テストへの影響を避けるためデフォルト（自動延長）に戻す
  await page.request.put('/api/settings', { data: { refreshTokenAutoExtend: true } })
})
