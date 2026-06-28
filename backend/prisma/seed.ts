/// <reference types="node" />
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '../env/backend.env') })

import { PrismaClient, TakeoutType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Setting（単一行）
  await prisma.setting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      storeName: 'おいしい居酒屋',
      closingTime: '23:00',
      taxRateInHouse: 10,
      taxRateTakeout: 8,
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
    where: { id: 1 },
    update: {},
    create: { id: 1, name: 'ドリンク', sort: 1 },
  })
  const catFood = await prisma.category.upsert({
    where: { id: 2 },
    update: {},
    create: { id: 2, name: 'フード', sort: 2 },
  })
  const catOther = await prisma.category.upsert({
    where: { id: 3 },
    update: {},
    create: { id: 3, name: 'その他', sort: 3 },
  })

  // SubCategories（小分類）
  const subAlcohol = await prisma.subCategory.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, categoryId: catDrink.id, name: 'アルコール', sort: 1 },
  })
  const subNonAlcohol = await prisma.subCategory.upsert({
    where: { id: 2 },
    update: {},
    create: { id: 2, categoryId: catDrink.id, name: 'ノンアル', sort: 2 },
  })
  const subFryer = await prisma.subCategory.upsert({
    where: { id: 3 },
    update: {},
    create: { id: 3, categoryId: catFood.id, name: 'フライヤー', sort: 1 },
  })
  const subGrill = await prisma.subCategory.upsert({
    where: { id: 4 },
    update: {},
    create: { id: 4, categoryId: catFood.id, name: 'グリル', sort: 2 },
  })
  const subCold = await prisma.subCategory.upsert({
    where: { id: 5 },
    update: {},
    create: { id: 5, categoryId: catFood.id, name: '冷菜', sort: 3 },
  })
  const subDessert = await prisma.subCategory.upsert({
    where: { id: 6 },
    update: {},
    create: { id: 6, categoryId: catOther.id, name: 'デザート', sort: 1 },
  })
  const subTakeout = await prisma.subCategory.upsert({
    where: { id: 7 },
    update: {},
    create: { id: 7, categoryId: catFood.id, name: 'テイクアウト', sort: 4 },
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
      { id: 101, name: '生ビール', price: 550, categoryId: catDrink.id, subCategoryId: subAlcohol.id, soldOut: false, takeout: TakeoutType.dine_in },
      { id: 102, name: 'ハイボール', price: 480, categoryId: catDrink.id, subCategoryId: subAlcohol.id, soldOut: false, takeout: TakeoutType.dine_in },
      { id: 103, name: '梅酒ロック', price: 480, categoryId: catDrink.id, subCategoryId: subAlcohol.id, soldOut: false, takeout: TakeoutType.dine_in },
      { id: 104, name: '日本酒', price: 550, categoryId: catDrink.id, subCategoryId: subAlcohol.id, soldOut: false, takeout: TakeoutType.dine_in },
      { id: 105, name: 'ウーロン茶', price: 280, categoryId: catDrink.id, subCategoryId: subNonAlcohol.id, soldOut: false, takeout: TakeoutType.both },
      { id: 106, name: 'コーラ', price: 280, categoryId: catDrink.id, subCategoryId: subNonAlcohol.id, soldOut: false, takeout: TakeoutType.both },
      { id: 107, name: 'ジンジャーエール', price: 280, categoryId: catDrink.id, subCategoryId: subNonAlcohol.id, soldOut: false, takeout: TakeoutType.both },
      { id: 201, name: '唐揚げ', price: 580, categoryId: catFood.id, subCategoryId: subFryer.id, soldOut: false, takeout: TakeoutType.both },
      { id: 202, name: 'ポテトフライ', price: 420, categoryId: catFood.id, subCategoryId: subFryer.id, soldOut: false, takeout: TakeoutType.both },
      { id: 203, name: '焼き鳥（5本）', price: 680, categoryId: catFood.id, subCategoryId: subGrill.id, soldOut: false, takeout: TakeoutType.both },
      { id: 204, name: '刺身盛り', price: 980, categoryId: catFood.id, subCategoryId: subCold.id, soldOut: false, takeout: TakeoutType.dine_in },
      { id: 205, name: '枝豆', price: 380, categoryId: catFood.id, subCategoryId: subCold.id, soldOut: false, takeout: TakeoutType.both },
      { id: 206, name: '冷ややっこ', price: 320, categoryId: catFood.id, subCategoryId: subCold.id, soldOut: false, takeout: TakeoutType.both },
      { id: 301, name: 'アイスクリーム', price: 380, categoryId: catOther.id, subCategoryId: subDessert.id, soldOut: false, takeout: TakeoutType.both },
      { id: 401, name: 'お弁当（唐揚げ）', price: 780, categoryId: catFood.id, subCategoryId: subTakeout.id, soldOut: false, takeout: TakeoutType.takeout },
      { id: 402, name: 'お弁当（焼き鳥）', price: 880, categoryId: catFood.id, subCategoryId: subTakeout.id, soldOut: false, takeout: TakeoutType.takeout },
    ]

  for (const item of menuItems) {
    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: {},
      create: item,
    })
  }

  // DrinkPlans
  const dp1 = await prisma.drinkPlan.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: '飲み放題A' },
  })
  // 飲み放題A のアイテム: 生ビール, ハイボール, 梅酒ロック, 日本酒
  for (const menuItemId of [101, 102, 103, 104]) {
    await prisma.drinkPlanItem.upsert({
      where: { drinkPlanId_menuItemId: { drinkPlanId: dp1.id, menuItemId } },
      update: {},
      create: { drinkPlanId: dp1.id, menuItemId },
    })
  }

  const dp2 = await prisma.drinkPlan.upsert({
    where: { id: 2 },
    update: {},
    create: { id: 2, name: 'ソフトドリンク飲み放題' },
  })
  // ソフトドリンク飲み放題: ウーロン茶, コーラ, ジンジャーエール
  for (const menuItemId of [105, 106, 107]) {
    await prisma.drinkPlanItem.upsert({
      where: { drinkPlanId_menuItemId: { drinkPlanId: dp2.id, menuItemId } },
      update: {},
      create: { drinkPlanId: dp2.id, menuItemId },
    })
  }

  // Courses
  const c1 = await prisma.course.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: '飲み放題コース', price: 1500, drinkPlanId: dp1.id },
  })
  // 飲み放題コースは料理なし

  const c2 = await prisma.course.upsert({
    where: { id: 2 },
    update: {},
    create: { id: 2, name: '飲み放題＋おつまみコース', price: 2800, drinkPlanId: dp1.id },
  })
  // 料理: 枝豆x1, 唐揚げx1, ポテトフライx1
  for (const [menuItemId, qty] of [[205, 1], [201, 1], [202, 1]] as [number, number][]) {
    await prisma.courseFoodItem.upsert({
      where: { courseId_menuItemId: { courseId: c2.id, menuItemId } },
      update: {},
      create: { courseId: c2.id, menuItemId, qty },
    })
  }

  const c3 = await prisma.course.upsert({
    where: { id: 3 },
    update: {},
    create: { id: 3, name: '刺身＆焼き鳥コース', price: 1800, drinkPlanId: null },
  })
  // 料理: 刺身盛りx1, 焼き鳥x1, 冷ややっこx1
  for (const [menuItemId, qty] of [[204, 1], [203, 1], [206, 1]] as [number, number][]) {
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
    where: { id: 1 },
    update: { label: 'テーブル1', x: G * 1, y: G * 1, w: G * 4, h: G * 2 },
    create: { id: 1, label: 'テーブル1', x: G * 1, y: G * 1, w: G * 4, h: G * 2 },
  })
  const st2 = await prisma.seatTable.upsert({
    where: { id: 2 },
    update: { label: 'テーブル2', x: G * 1, y: G * 4, w: G * 4, h: G * 2 },
    create: { id: 2, label: 'テーブル2', x: G * 1, y: G * 4, w: G * 4, h: G * 2 },
  })
  const st3 = await prisma.seatTable.upsert({
    where: { id: 3 },
    update: { label: 'テーブル3', x: G * 6, y: G * 1, w: G * 4, h: G * 3 },
    create: { id: 3, label: 'テーブル3', x: G * 6, y: G * 1, w: G * 4, h: G * 3 },
  })
  const st4 = await prisma.seatTable.upsert({
    where: { id: 4 },
    update: { label: 'テーブル4', x: G * 6, y: G * 5, w: G * 4, h: G * 3 },
    create: { id: 4, label: 'テーブル4', x: G * 6, y: G * 5, w: G * 4, h: G * 3 },
  })
  const st5 = await prisma.seatTable.upsert({
    where: { id: 5 },
    update: { label: 'テーブル5', x: G * 11, y: G * 2, w: G * 4, h: G * 5 },
    create: { id: 5, label: 'テーブル5', x: G * 11, y: G * 2, w: G * 4, h: G * 5 },
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
      { id: 10, label: 'A-1', type: 'table', x: G * 1, y: G * 1, tableId: st1.id },
      { id: 11, label: 'A-2', type: 'table', x: G * 3, y: G * 1, tableId: st1.id },
      // テーブル2（2人）
      { id: 12, label: 'B-1', type: 'table', x: G * 1, y: G * 4, tableId: st2.id },
      { id: 13, label: 'B-2', type: 'table', x: G * 3, y: G * 4, tableId: st2.id },
      // テーブル3（4人）
      { id: 14, label: 'C-1', type: 'table', x: G * 6, y: G * 1, tableId: st3.id },
      { id: 15, label: 'C-2', type: 'table', x: G * 9, y: G * 1, tableId: st3.id },
      { id: 16, label: 'C-3', type: 'table', x: G * 6, y: G * 3, tableId: st3.id },
      { id: 17, label: 'C-4', type: 'table', x: G * 9, y: G * 3, tableId: st3.id },
      // テーブル4（4人）
      { id: 18, label: 'D-1', type: 'table', x: G * 6, y: G * 5, tableId: st4.id },
      { id: 19, label: 'D-2', type: 'table', x: G * 9, y: G * 5, tableId: st4.id },
      { id: 20, label: 'D-3', type: 'table', x: G * 6, y: G * 7, tableId: st4.id },
      { id: 21, label: 'D-4', type: 'table', x: G * 9, y: G * 7, tableId: st4.id },
      // テーブル5（6人）
      { id: 22, label: 'E-1', type: 'table', x: G * 11, y: G * 2, tableId: st5.id },
      { id: 23, label: 'E-2', type: 'table', x: G * 13, y: G * 2, tableId: st5.id },
      { id: 24, label: 'E-3', type: 'table', x: G * 11, y: G * 4, tableId: st5.id },
      { id: 25, label: 'E-4', type: 'table', x: G * 13, y: G * 4, tableId: st5.id },
      { id: 26, label: 'E-5', type: 'table', x: G * 11, y: G * 6, tableId: st5.id },
      { id: 27, label: 'E-6', type: 'table', x: G * 13, y: G * 6, tableId: st5.id },
      // カウンター（6席）
      { id: 28, label: 'CT-1', type: 'counter', x: G * 1, y: G * 10, tableId: null },
      { id: 29, label: 'CT-2', type: 'counter', x: G * 2, y: G * 10, tableId: null },
      { id: 30, label: 'CT-3', type: 'counter', x: G * 3, y: G * 10, tableId: null },
      { id: 31, label: 'CT-4', type: 'counter', x: G * 4, y: G * 10, tableId: null },
      { id: 32, label: 'CT-5', type: 'counter', x: G * 5, y: G * 10, tableId: null },
      { id: 33, label: 'CT-6', type: 'counter', x: G * 6, y: G * 10, tableId: null },
    ]

  for (const seat of seats) {
    await prisma.seat.upsert({
      where: { id: seat.id },
      update: { label: seat.label, type: seat.type, x: seat.x, y: seat.y, tableId: seat.tableId },
      create: seat,
    })
  }

  // Users
  const adminHash = await bcrypt.hash('admin1234', 10)
  const staffHash = await bcrypt.hash('staff1234', 10)
  await prisma.staff.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', passwordHash: adminHash, role: 'admin' },
  })
  await prisma.staff.upsert({
    where: { username: 'staff' },
    update: {},
    create: { username: 'staff', passwordHash: staffHash, role: 'staff' },
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
