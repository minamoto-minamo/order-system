import { test, expect } from '@playwright/test'
import { resetDb, prisma, disconnect } from './helpers/db'
import { loginAs } from './helpers/auth'
import { ROUTES } from '../frontend/src/lib/routes'
import ja from '../frontend/src/i18n/locales/ja'

const TEST_GROUP_NAME = 'テストグループ'

async function setupOrderedSession() {
  const session = await prisma.session.create({ data: { status: 'open' } })
  const seat = await prisma.seat.findFirst()
  const group = await prisma.group.create({
    data: {
      name: TEST_GROUP_NAME,
      guestCount: 2,
      sessionId: session.id,
      seats: seat ? { create: [{ seatId: seat.id }] } : undefined,
    },
  })
  const menu = await prisma.menuItem.findFirst({ where: { soldOut: false } })
  if (menu) {
    await prisma.orderItem.create({
      data: {
        groupId: group.id,
        menuItemId: menu.id,
        menuItemName: menu.name,
        price: menu.price,
        qty: 1,
        status: 'pending',
      },
    })
  }
  return { session, group, menu }
}

test.beforeEach(async ({ page }) => {
  await resetDb()
  await loginAs(page, 'staff')
})

test.afterAll(async () => {
  await disconnect()
})

test('注文がない場合「未対応の注文はありません」と表示', async ({ page }) => {
  await prisma.session.create({ data: { status: 'open' } })
  await page.goto(ROUTES.kitchen)
  await expect(page.getByText(ja.kitchen.noOrders)).toBeVisible()
})

test('pending 注文がチケットとして表示される', async ({ page }) => {
  const { menu } = await setupOrderedSession()
  await page.goto(ROUTES.kitchen)
  if (menu) {
    await expect(page.getByText(menu.name)).toBeVisible()
  }
  await expect(page.getByRole('button', { name: ja.kitchen.complete }).first()).toBeVisible()
})

test('グループビューに切り替えられる', async ({ page }) => {
  await setupOrderedSession()
  await page.goto(ROUTES.kitchen)
  await page.getByRole('button', { name: ja.kitchen.groupView }).click()
  await expect(page.getByText(TEST_GROUP_NAME)).toBeVisible()
})

test('ホールボタンでホールへ遷移', async ({ page }) => {
  await prisma.session.create({ data: { status: 'open' } })
  await page.goto(ROUTES.kitchen)
  await page.getByRole('button', { name: ja.nav.openMenu }).click()
  await page.getByRole('button', { name: ja.mode.hall }).click()
  await expect(page).toHaveURL(ROUTES.hall)
})

test('完了ボタンをクリックすると注文が提供待ちになる', async ({ page }) => {
  const { menu } = await setupOrderedSession()
  if (!menu) test.skip()
  await page.goto(ROUTES.kitchen)
  await expect(page.getByRole('button', { name: ja.kitchen.complete }).first()).toBeVisible()
  await page.getByRole('button', { name: ja.kitchen.complete }).first().click()
  await expect(page.getByText(ja.common.readyToServe)).toBeVisible()
})
