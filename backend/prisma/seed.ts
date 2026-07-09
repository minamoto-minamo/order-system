/// <reference types="node" />
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '../env/backend.env') })

import { PrismaClient, TakeoutType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function seedStore(storeId: number, subdomain: string, storeName: string, idOffset: number) {
  const id = (n: number) => n + idOffset

  await prisma.setting.upsert({
    where: { storeId },
    update: {},
    create: {
      storeId,
      storeName,
      closingTime: '23:00',
      taxRateInHouse: 10,
      taxRateTakeout: 8,
      taxInclusive: false,
      canvasCols: 16,
      canvasRows: 12,
      canvasColsMin: 8,
      canvasColsMax: 32,
      canvasRowsMin: 6,
      canvasRowsMax: 24,
      gridSize: 48,
      gridSizeMin: 32,
      gridSizeMax: 80,
    },
  })

  // Categories（大分類）
  const catDrink = await prisma.category.upsert({
    where: { id: id(1) },
    update: {},
    create: { id: id(1), storeId, name: 'ドリンク', sort: 1 },
  })
  const catFood = await prisma.category.upsert({
    where: { id: id(2) },
    update: {},
    create: { id: id(2), storeId, name: 'フード', sort: 2 },
  })
  const catOther = await prisma.category.upsert({
    where: { id: id(3) },
    update: {},
    create: { id: id(3), storeId, name: 'その他', sort: 3 },
  })

  // SubCategories（小分類）
  const subAlcohol = await prisma.subCategory.upsert({
    where: { id: id(1) },
    update: {},
    create: { id: id(1), storeId, categoryId: catDrink.id, name: 'アルコール', sort: 1 },
  })
  const subNonAlcohol = await prisma.subCategory.upsert({
    where: { id: id(2) },
    update: {},
    create: { id: id(2), storeId, categoryId: catDrink.id, name: 'ノンアル', sort: 2 },
  })
  const subFryer = await prisma.subCategory.upsert({
    where: { id: id(3) },
    update: {},
    create: { id: id(3), storeId, categoryId: catFood.id, name: 'フライヤー', sort: 1 },
  })
  const subGrill = await prisma.subCategory.upsert({
    where: { id: id(4) },
    update: {},
    create: { id: id(4), storeId, categoryId: catFood.id, name: 'グリル', sort: 2 },
  })
  const subCold = await prisma.subCategory.upsert({
    where: { id: id(5) },
    update: {},
    create: { id: id(5), storeId, categoryId: catFood.id, name: '冷菜', sort: 3 },
  })
  const subDessert = await prisma.subCategory.upsert({
    where: { id: id(6) },
    update: {},
    create: { id: id(6), storeId, categoryId: catOther.id, name: 'デザート', sort: 1 },
  })
  const subTakeout = await prisma.subCategory.upsert({
    where: { id: id(7) },
    update: {},
    create: { id: id(7), storeId, categoryId: catFood.id, name: 'テイクアウト', sort: 4 },
  })

  // MenuItems
  const menuItems: Array<{
    id: number
    name: string
    price: number
    categoryId: number
    subCategoryId: number
    soldOut: boolean
    takeout: TakeoutType
  }> = [
      { id: id(101), name: '生ビール', price: 550, categoryId: catDrink.id, subCategoryId: subAlcohol.id, soldOut: false, takeout: TakeoutType.dine_in },
      { id: id(102), name: 'ハイボール', price: 480, categoryId: catDrink.id, subCategoryId: subAlcohol.id, soldOut: false, takeout: TakeoutType.dine_in },
      { id: id(103), name: '梅酒ロック', price: 480, categoryId: catDrink.id, subCategoryId: subAlcohol.id, soldOut: false, takeout: TakeoutType.dine_in },
      { id: id(104), name: '日本酒', price: 550, categoryId: catDrink.id, subCategoryId: subAlcohol.id, soldOut: false, takeout: TakeoutType.dine_in },
      { id: id(105), name: 'ウーロン茶', price: 280, categoryId: catDrink.id, subCategoryId: subNonAlcohol.id, soldOut: false, takeout: TakeoutType.both },
      { id: id(106), name: 'コーラ', price: 280, categoryId: catDrink.id, subCategoryId: subNonAlcohol.id, soldOut: false, takeout: TakeoutType.both },
      { id: id(107), name: 'ジンジャーエール', price: 280, categoryId: catDrink.id, subCategoryId: subNonAlcohol.id, soldOut: false, takeout: TakeoutType.both },
      { id: id(201), name: '唐揚げ', price: 580, categoryId: catFood.id, subCategoryId: subFryer.id, soldOut: false, takeout: TakeoutType.both },
      { id: id(202), name: 'ポテトフライ', price: 420, categoryId: catFood.id, subCategoryId: subFryer.id, soldOut: false, takeout: TakeoutType.both },
      { id: id(203), name: '焼き鳥（5本）', price: 680, categoryId: catFood.id, subCategoryId: subGrill.id, soldOut: false, takeout: TakeoutType.both },
      { id: id(204), name: '刺身盛り', price: 980, categoryId: catFood.id, subCategoryId: subCold.id, soldOut: false, takeout: TakeoutType.dine_in },
      { id: id(205), name: '枝豆', price: 380, categoryId: catFood.id, subCategoryId: subCold.id, soldOut: false, takeout: TakeoutType.both },
      { id: id(206), name: '冷ややっこ', price: 320, categoryId: catFood.id, subCategoryId: subCold.id, soldOut: false, takeout: TakeoutType.both },
      { id: id(301), name: 'アイスクリーム', price: 380, categoryId: catOther.id, subCategoryId: subDessert.id, soldOut: false, takeout: TakeoutType.both },
      { id: id(401), name: 'お弁当（唐揚げ）', price: 780, categoryId: catFood.id, subCategoryId: subTakeout.id, soldOut: false, takeout: TakeoutType.takeout },
      { id: id(402), name: 'お弁当（焼き鳥）', price: 880, categoryId: catFood.id, subCategoryId: subTakeout.id, soldOut: false, takeout: TakeoutType.takeout },
    ]

  for (const item of menuItems) {
    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: {},
      create: { ...item, storeId },
    })
  }

  // DrinkPlans
  const dp1 = await prisma.drinkPlan.upsert({
    where: { id: id(1) },
    update: {},
    create: { id: id(1), storeId, name: '飲み放題A' },
  })
  // 飲み放題A のアイテム: 生ビール, ハイボール, 梅酒ロック, 日本酒
  for (const menuItemId of [id(101), id(102), id(103), id(104)]) {
    await prisma.drinkPlanItem.upsert({
      where: { drinkPlanId_menuItemId: { drinkPlanId: dp1.id, menuItemId } },
      update: {},
      create: { drinkPlanId: dp1.id, menuItemId },
    })
  }

  const dp2 = await prisma.drinkPlan.upsert({
    where: { id: id(2) },
    update: {},
    create: { id: id(2), storeId, name: 'ソフトドリンク飲み放題' },
  })
  // ソフトドリンク飲み放題: ウーロン茶, コーラ, ジンジャーエール
  for (const menuItemId of [id(105), id(106), id(107)]) {
    await prisma.drinkPlanItem.upsert({
      where: { drinkPlanId_menuItemId: { drinkPlanId: dp2.id, menuItemId } },
      update: {},
      create: { drinkPlanId: dp2.id, menuItemId },
    })
  }

  // Courses
  const c1 = await prisma.course.upsert({
    where: { id: id(1) },
    update: {},
    create: { id: id(1), storeId, name: '飲み放題コース', price: 1500, drinkPlanId: dp1.id },
  })
  // 飲み放題コースは料理なし

  const c2 = await prisma.course.upsert({
    where: { id: id(2) },
    update: {},
    create: { id: id(2), storeId, name: '飲み放題＋おつまみコース', price: 2800, drinkPlanId: dp1.id },
  })
  // 料理: 枝豆x1, 唐揚げx1, ポテトフライx1
  for (const [menuItemId, qty] of [[id(205), 1], [id(201), 1], [id(202), 1]] as [number, number][]) {
    await prisma.courseFoodItem.upsert({
      where: { courseId_menuItemId: { courseId: c2.id, menuItemId } },
      update: {},
      create: { courseId: c2.id, menuItemId, qty },
    })
  }

  const c3 = await prisma.course.upsert({
    where: { id: id(3) },
    update: {},
    create: { id: id(3), storeId, name: '刺身＆焼き鳥コース', price: 1800, drinkPlanId: null },
  })
  // 料理: 刺身盛りx1, 焼き鳥x1, 冷ややっこx1
  for (const [menuItemId, qty] of [[id(204), 1], [id(203), 1], [id(206), 1]] as [number, number][]) {
    await prisma.courseFoodItem.upsert({
      where: { courseId_menuItemId: { courseId: c3.id, menuItemId } },
      update: {},
      create: { courseId: c3.id, menuItemId, qty },
    })
  }

  // SeatTables
  // G=1: DBにはグリッド単位の整数を保存する。フロントが gridSize を乗算してピクセル座標に変換する。
  const G = 1
  const st1 = await prisma.seatTable.upsert({
    where: { id: id(1) },
    update: { label: 'テーブル1', x: G * 1, y: G * 1, w: G * 4, h: G * 2 },
    create: { id: id(1), storeId, label: 'テーブル1', x: G * 1, y: G * 1, w: G * 4, h: G * 2 },
  })
  const st2 = await prisma.seatTable.upsert({
    where: { id: id(2) },
    update: { label: 'テーブル2', x: G * 1, y: G * 4, w: G * 4, h: G * 2 },
    create: { id: id(2), storeId, label: 'テーブル2', x: G * 1, y: G * 4, w: G * 4, h: G * 2 },
  })
  const st3 = await prisma.seatTable.upsert({
    where: { id: id(3) },
    update: { label: 'テーブル3', x: G * 6, y: G * 1, w: G * 4, h: G * 3 },
    create: { id: id(3), storeId, label: 'テーブル3', x: G * 6, y: G * 1, w: G * 4, h: G * 3 },
  })
  const st4 = await prisma.seatTable.upsert({
    where: { id: id(4) },
    update: { label: 'テーブル4', x: G * 6, y: G * 5, w: G * 4, h: G * 3 },
    create: { id: id(4), storeId, label: 'テーブル4', x: G * 6, y: G * 5, w: G * 4, h: G * 3 },
  })
  const st5 = await prisma.seatTable.upsert({
    where: { id: id(5) },
    update: { label: 'テーブル5', x: G * 11, y: G * 2, w: G * 4, h: G * 5 },
    create: { id: id(5), storeId, label: 'テーブル5', x: G * 11, y: G * 2, w: G * 4, h: G * 5 },
  })

  // Seats
  const seats: Array<{
    id: number
    label: string
    type: 'counter' | 'table'
    x: number
    y: number
    tableId: number | null
  }> = [
      // テーブル1（2人）
      { id: id(10), label: 'A-1', type: 'table', x: G * 1, y: G * 1, tableId: st1.id },
      { id: id(11), label: 'A-2', type: 'table', x: G * 3, y: G * 1, tableId: st1.id },
      // テーブル2（2人）
      { id: id(12), label: 'B-1', type: 'table', x: G * 1, y: G * 4, tableId: st2.id },
      { id: id(13), label: 'B-2', type: 'table', x: G * 3, y: G * 4, tableId: st2.id },
      // テーブル3（4人）
      { id: id(14), label: 'C-1', type: 'table', x: G * 6, y: G * 1, tableId: st3.id },
      { id: id(15), label: 'C-2', type: 'table', x: G * 9, y: G * 1, tableId: st3.id },
      { id: id(16), label: 'C-3', type: 'table', x: G * 6, y: G * 3, tableId: st3.id },
      { id: id(17), label: 'C-4', type: 'table', x: G * 9, y: G * 3, tableId: st3.id },
      // テーブル4（4人）
      { id: id(18), label: 'D-1', type: 'table', x: G * 6, y: G * 5, tableId: st4.id },
      { id: id(19), label: 'D-2', type: 'table', x: G * 9, y: G * 5, tableId: st4.id },
      { id: id(20), label: 'D-3', type: 'table', x: G * 6, y: G * 7, tableId: st4.id },
      { id: id(21), label: 'D-4', type: 'table', x: G * 9, y: G * 7, tableId: st4.id },
      // テーブル5（6人）
      { id: id(22), label: 'E-1', type: 'table', x: G * 11, y: G * 2, tableId: st5.id },
      { id: id(23), label: 'E-2', type: 'table', x: G * 13, y: G * 2, tableId: st5.id },
      { id: id(24), label: 'E-3', type: 'table', x: G * 11, y: G * 4, tableId: st5.id },
      { id: id(25), label: 'E-4', type: 'table', x: G * 13, y: G * 4, tableId: st5.id },
      { id: id(26), label: 'E-5', type: 'table', x: G * 11, y: G * 6, tableId: st5.id },
      { id: id(27), label: 'E-6', type: 'table', x: G * 13, y: G * 6, tableId: st5.id },
      // カウンター（6席）
      { id: id(28), label: 'CT-1', type: 'counter', x: G * 1, y: G * 10, tableId: null },
      { id: id(29), label: 'CT-2', type: 'counter', x: G * 2, y: G * 10, tableId: null },
      { id: id(30), label: 'CT-3', type: 'counter', x: G * 3, y: G * 10, tableId: null },
      { id: id(31), label: 'CT-4', type: 'counter', x: G * 4, y: G * 10, tableId: null },
      { id: id(32), label: 'CT-5', type: 'counter', x: G * 5, y: G * 10, tableId: null },
      { id: id(33), label: 'CT-6', type: 'counter', x: G * 6, y: G * 10, tableId: null },
    ]

  for (const seat of seats) {
    await prisma.seat.upsert({
      where: { id: seat.id },
      update: { label: seat.label, type: seat.type, x: seat.x, y: seat.y, tableId: seat.tableId },
      create: { ...seat, storeId },
    })
  }

  // Users
  const adminHash = await bcrypt.hash('admin1234', 10)
  const staffHash = await bcrypt.hash('staff1234', 10)
  await prisma.staff.upsert({
    where: { storeId_username: { storeId, username: 'admin' } },
    update: {},
    create: { storeId, username: 'admin', passwordHash: adminHash, role: 'admin' },
  })
  await prisma.staff.upsert({
    where: { storeId_username: { storeId, username: 'staff' } },
    update: {},
    create: { storeId, username: 'staff', passwordHash: staffHash, role: 'staff' },
  })
}

async function main() {
  const store1 = await prisma.store.upsert({
    where: { subdomain: 'store1' },
    update: {},
    create: { subdomain: 'store1', name: 'おいしい居酒屋 店1' },
  })
  const store2 = await prisma.store.upsert({
    where: { subdomain: 'store2' },
    update: {},
    create: { subdomain: 'store2', name: 'おいしい居酒屋 店2' },
  })

  await seedStore(store1.id, 'store1', 'おいしい居酒屋 店1', 0)
  await seedStore(store2.id, 'store2', 'おいしい居酒屋 店2', 10000)

  const platformAdminHash = await bcrypt.hash('platform1234', 10)
  await prisma.platformAdmin.upsert({
    where: { username: 'platform' },
    update: {},
    create: { username: 'platform', passwordHash: platformAdminHash },
  })

  // 明示的 ID 挿入後に autoincrement シーケンスを同期（PostgreSQL 固有の問題）
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Category"',    'id'), (SELECT MAX(id) FROM "Category"))`
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"SubCategory"', 'id'), (SELECT MAX(id) FROM "SubCategory"))`
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"MenuItem"',    'id'), (SELECT MAX(id) FROM "MenuItem"))`
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"DrinkPlan"',   'id'), (SELECT MAX(id) FROM "DrinkPlan"))`
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Course"',      'id'), (SELECT MAX(id) FROM "Course"))`
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"SeatTable"',   'id'), (SELECT MAX(id) FROM "SeatTable"))`
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Seat"',        'id'), (SELECT MAX(id) FROM "Seat"))`

  console.log('Seed 完了')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
