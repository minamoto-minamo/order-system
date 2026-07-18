import { TakeoutType } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { CREDS } from './auth'
import { prisma } from './db'

// backend/prisma/seed.ts のデータ定義を踏襲した、動的テスト店舗向けの最小フィクスチャ
export async function seedStoreFixtures(storeId: number) {
  const catDrink = await prisma.category.create({ data: { storeId, name: 'ドリンク', sort: 1 } })
  const catFood = await prisma.category.create({ data: { storeId, name: 'フード', sort: 2 } })
  await prisma.category.create({ data: { storeId, name: 'その他', sort: 3 } })

  const subAlcohol = await prisma.subCategory.create({
    data: { storeId, categoryId: catDrink.id, name: 'アルコール', sort: 1 },
  })
  const subFryer = await prisma.subCategory.create({
    data: { storeId, categoryId: catFood.id, name: 'フライヤー', sort: 1 },
  })

  const beer = await prisma.menuItem.create({
    data: {
      storeId,
      name: '生ビール',
      price: 550,
      categoryId: catDrink.id,
      subCategoryId: subAlcohol.id,
      soldOut: false,
      takeout: TakeoutType.dine_in,
    },
  })
  await prisma.menuItem.create({
    data: {
      storeId,
      name: '唐揚げ',
      price: 580,
      categoryId: catFood.id,
      subCategoryId: subFryer.id,
      soldOut: false,
      takeout: TakeoutType.both,
    },
  })

  const drinkPlan = await prisma.drinkPlan.create({ data: { storeId, name: '飲み放題A' } })
  await prisma.drinkPlanItem.create({ data: { drinkPlanId: drinkPlan.id, menuItemId: beer.id } })
  await prisma.course.create({
    data: { storeId, name: '飲み放題コース', price: 1500, drinkPlanId: drinkPlan.id },
  })

  const table = await prisma.seatTable.create({
    data: { storeId, label: 'テーブル1', x: 1, y: 1, w: 4, h: 2 },
  })
  await prisma.seat.create({
    data: { storeId, label: 'A-1', type: 'table', x: 1, y: 1, tableId: table.id },
  })
  await prisma.seat.create({
    data: { storeId, label: 'A-2', type: 'table', x: 3, y: 1, tableId: table.id },
  })
  await prisma.seat.create({
    data: { storeId, label: 'CT-1', type: 'counter', x: 1, y: 10, tableId: null },
  })

  const staffHash = await bcrypt.hash(CREDS.staff.password, 10)
  await prisma.staff.create({
    data: { storeId, username: CREDS.staff.username, passwordHash: staffHash, role: 'staff' },
  })
}
