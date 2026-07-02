import { test, expect } from '@playwright/test'
import { resetDb, disconnect } from './helpers/db'
import { loginAs } from './helpers/auth'
import { createTestStore, deleteTestStore, findStoreIdBySubdomain, type TestStore } from './helpers/store'
import { ROUTES } from '../frontend/src/lib/routes'
import ja from '../frontend/src/i18n/locales/ja'

const ADMIN_HOST = 'http://admin.localhost:5173'

let storeA: TestStore
let storeB: TestStore

test.beforeAll(async ({}, testInfo) => {
  storeA = await createTestStore(`e2e-worker${testInfo.parallelIndex}-a`)
  storeB = await createTestStore(`e2e-worker${testInfo.parallelIndex}-b`)
})

test.afterAll(async () => {
  await deleteTestStore(storeA.id)
  await deleteTestStore(storeB.id)
  await disconnect()
})

test.beforeEach(async () => {
  await resetDb(storeA.id)
  await resetDb(storeB.id)
})

test('store1 で作成したスタッフが store2 の一覧に見えない', async ({ page }) => {
  await loginAs(page, 'admin', { host: storeA.baseURL })
  const created = await page.request.post(`${storeA.baseURL}/api/staff`, {
    data: { username: 'store1only', password: 'password123', role: 'staff' },
  })
  expect(created.status()).toBe(201)

  await loginAs(page, 'admin', { host: storeB.baseURL })
  const res = await page.request.get(`${storeB.baseURL}/api/staff`)
  expect(res.status()).toBe(200)
  const usernames = (await res.json()).map((s: { username: string }) => s.username)
  expect(usernames).not.toContain('store1only')
})

test('store1 で発行された Cookie を store2 ホストへ直接送っても 401 になる', async ({ page }) => {
  await loginAs(page, 'admin', { host: storeA.baseURL })
  const cookies = await page.context().cookies()
  const token = cookies.find(c => c.name === 'token')?.value
  expect(token).toBeTruthy()

  const res = await page.request.get(`${storeB.baseURL}/api/auth/me`, {
    headers: { Cookie: `token=${token}` },
  })
  expect(res.status()).toBe(401)
})

test('存在しないサブドメインへの API アクセスは 404', async ({ page }) => {
  const res = await page.request.get('http://nosuchstore.localhost:5173/api/settings')
  expect(res.status()).toBe(404)
})

test('admin.localhost からプラットフォーム管理者としてログインし、店舗を作成すると即座にその店舗へログインできる', async ({ page }) => {
  const storeCSubdomain = `e2e-worker${test.info().parallelIndex}-c`

  // 前回実行のクラッシュ等で同名店舗が残っている場合に備え、事前に削除しておく
  const existingId = await findStoreIdBySubdomain(storeCSubdomain)
  if (existingId) await deleteTestStore(existingId)

  try {
    await page.goto(`${ADMIN_HOST}${ROUTES.platformLogin}`)
    await page.getByPlaceholder(ja.platform.usernamePlaceholder).fill('platform')
    await page.getByPlaceholder(ja.platform.passwordPlaceholder).fill('platform1234')
    await page.getByRole('button', { name: ja.platform.submit }).click()
    await expect(page).toHaveURL(`${ADMIN_HOST}${ROUTES.platformStores}`)

    await page.getByRole('button', { name: ja.platform.addStore }).click()
    const modal = page.locator('.fixed.inset-0.z-modal')
    await modal.getByPlaceholder(ja.platform.subdomainHint).fill(storeCSubdomain)
    await modal.locator('input:not([type="password"])').nth(1).fill('新規店舗')
    await modal.locator('input:not([type="password"])').nth(2).fill('store3admin')
    await modal.locator('input[type="password"]').fill('store3admin1234')
    await modal.getByRole('button', { name: ja.common.save }).click()
    await expect(page.getByText(storeCSubdomain)).toBeVisible()

    const loginRes = await page.request.post(`http://${storeCSubdomain}.localhost:5173/api/auth/login`, {
      data: { username: 'store3admin', password: 'store3admin1234' },
    })
    expect(loginRes.status()).toBe(200)
  } finally {
    const createdId = await findStoreIdBySubdomain(storeCSubdomain)
    if (createdId) await deleteTestStore(createdId)
  }
})

test('admin.localhost からテナント API を叩くと 404、逆にテナントホストからプラットフォーム API を叩くと 404', async ({ page }) => {
  const fromAdmin = await page.request.get(`${ADMIN_HOST}/api/settings`)
  expect(fromAdmin.status()).toBe(404)

  const fromStore = await page.request.get(`${storeA.baseURL}/api/platform/stores`)
  expect(fromStore.status()).toBe(404)
})
