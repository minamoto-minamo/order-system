import { PrismaClient } from '@prisma/client'
import { CREDS } from './auth'

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
})

export async function resetDb(storeId: number) {
  await prisma.orderItem.deleteMany({ where: { storeId } })
  await prisma.productOptionGroup.deleteMany({ where: { storeId } })
  await prisma.groupSeat.deleteMany({ where: { group: { storeId } } })
  await prisma.group.deleteMany({ where: { storeId } })
  await prisma.session.deleteMany({ where: { storeId } })
  await prisma.refreshToken.deleteMany({ where: { staff: { storeId } } })
  await prisma.menuItem.updateMany({ where: { storeId }, data: { soldOut: false } })
  // フィクスチャの admin/staff 以外は、テスト中に作成された残骸として削除する
  await prisma.staff.deleteMany({
    where: { storeId, username: { notIn: [CREDS.admin.username, CREDS.staff.username] } },
  })
}

export async function disconnect() {
  await prisma.$disconnect()
}

export { prisma }
