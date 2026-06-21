import { test, expect } from '@playwright/test'
import { resetDb, prisma, disconnect } from './helpers/db'
import { loginAs } from './helpers/auth'
import { ROUTES } from '../frontend/src/lib/routes'
import { SEED } from './helpers/seeds'
import ja from '../frontend/src/i18n/locales/ja'

test.beforeEach(async ({ page }) => {
  await resetDb()
  await prisma.session.create({ data: { status: 'open' } })
  await loginAs(page, 'staff')
})

test.afterAll(async () => {
  await disconnect()
})

test('席一覧が表示される', async ({ page }) => {
  await page.goto(ROUTES.hall)
  await expect(page.getByText(ja.hall.title)).toBeVisible()
  await expect(page.locator('.seat-cell').first()).toBeVisible()
})

test('席ラベルが表示される（A1, CT1）', async ({ page }) => {
  await page.goto(ROUTES.hall)
  await expect(page.getByText(SEED.seats.a1)).toBeVisible()
  await expect(page.getByText(SEED.seats.ct1)).toBeVisible()
})

test('空席をクリックして選択 → グループ作成ボタンが出る', async ({ page }) => {
  await page.goto(ROUTES.hall)
  await page.locator('.seat-cell').first().click({ force: true })
  await expect(page.getByRole('button', { name: ja.hall.createGroup })).toBeVisible()
})

test('複数席選択してグループ作成 → 詳細ページに遷移', async ({ page }) => {
  await page.goto(ROUTES.hall)
  const seats = page.locator('.seat-cell')
  await seats.nth(0).click({ force: true })
  await page.getByRole('button', { name: ja.hall.createGroup }).click()
  await page.getByRole('button', { name: /作成する/ }).click()
  await expect(page).toHaveURL(/\/hall\/group\/\d+/)
})

test('キッチンボタンでキッチンへ遷移', async ({ page }) => {
  await page.goto(ROUTES.hall)
  await page.getByRole('button', { name: ja.nav.openMenu }).click()
  await page.getByRole('button', { name: ja.mode.kitchen }).click()
  await expect(page).toHaveURL(ROUTES.kitchen)
})

test('グループ作成後に席が使用中として表示される', async ({ page }) => {
  const seat = await prisma.seat.findFirst({ where: { label: SEED.seats.a1 } })
  const session = await prisma.session.findFirst({ where: { status: 'open' } })
  await prisma.group.create({
    data: {
      name: 'テストグループ',
      guestCount: 2,
      sessionId: session!.id,
      seats: seat ? { create: [{ seatId: seat.id }] } : undefined,
    },
  })
  await page.goto(ROUTES.hall)
  await expect(page.getByText(ja.hall.occupied).first()).toBeVisible()
})
