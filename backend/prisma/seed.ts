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
      storeName: '居酒屋',
      closingTime: '23:00',
      taxRateInHouse: 10,
      taxRateTakeout: 8,
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
    create: { id: 7, categoryId: catOther.id, name: 'テイクアウト', sort: 2 },
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

  // Seats
  const G = 48
  const seats: Array<{
    id: number
    label: string
    type: 'counter' | 'table'
    x: number
    y: number
    tableId: number | null
  }> = [
      { id: 10, label: 'A1', type: 'table', x: G * 2, y: G * 1, tableId: null },
      { id: 11, label: 'A2', type: 'table', x: G * 3, y: G * 1, tableId: null },
      { id: 12, label: 'A3', type: 'table', x: G * 4, y: G * 1, tableId: null },
      { id: 13, label: 'A4', type: 'table', x: G * 2, y: G * 2, tableId: null },
      { id: 14, label: 'B1', type: 'table', x: G * 6, y: G * 1, tableId: null },
      { id: 15, label: 'B2', type: 'table', x: G * 7, y: G * 1, tableId: null },
      { id: 16, label: 'C1', type: 'table', x: G * 2, y: G * 4, tableId: null },
      { id: 17, label: 'C2', type: 'table', x: G * 3, y: G * 4, tableId: null },
      { id: 18, label: 'C3', type: 'table', x: G * 4, y: G * 4, tableId: null },
      { id: 19, label: 'C4', type: 'table', x: G * 5, y: G * 4, tableId: null },
      { id: 20, label: 'CT1', type: 'counter', x: G * 1, y: G * 7, tableId: null },
      { id: 21, label: 'CT2', type: 'counter', x: G * 2, y: G * 7, tableId: null },
      { id: 22, label: 'CT3', type: 'counter', x: G * 3, y: G * 7, tableId: null },
      { id: 23, label: 'CT4', type: 'counter', x: G * 4, y: G * 7, tableId: null },
      { id: 24, label: 'CT5', type: 'counter', x: G * 5, y: G * 7, tableId: null },
    ]

  for (const seat of seats) {
    await prisma.seat.upsert({
      where: { id: seat.id },
      update: {},
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

  console.log('Seed 完了')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
