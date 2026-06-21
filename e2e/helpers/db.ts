import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
})

export async function resetDb() {
  await prisma.orderItem.deleteMany()
  await prisma.groupSeat.deleteMany()
  await prisma.group.deleteMany()
  await prisma.session.deleteMany()
}

export async function disconnect() {
  await prisma.$disconnect()
}

export { prisma }
