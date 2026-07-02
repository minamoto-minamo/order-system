import type { FastifyPluginAsync } from 'fastify'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'
import { requirePlatformAdmin } from '../plugins/auth.js'

const RESERVED_SUBDOMAINS = new Set(['admin'])

const DEFAULT_SETTING = {
  storeName: '居酒屋',
  closingTime: '23:00',
  taxRateInHouse: 10,
  taxRateTakeout: 8,
}

const createBodySchema = {
  type: 'object',
  required: ['subdomain', 'name', 'adminUsername', 'adminPassword'],
  properties: {
    subdomain: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$|^[a-z0-9]$' },
    name: { type: 'string', minLength: 1 },
    adminUsername: { type: 'string', minLength: 1 },
    adminPassword: { type: 'string', minLength: 8, maxLength: 100 },
  },
  additionalProperties: false,
} as const

const updateBodySchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    isActive: { type: 'boolean' },
  },
  additionalProperties: false,
} as const

// passwordHash 等の内部情報を含めないための明示的な select
const select = { id: true, subdomain: true, name: true, isActive: true, createdAt: true }

const platformStoresRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', requirePlatformAdmin)

  fastify.get('/', async () => {
    return prisma.store.findMany({ select, orderBy: { createdAt: 'asc' } })
  })

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const store = await prisma.store.findUnique({ where: { id: Number(id) }, select })
    if (!store) return reply.status(404).send({ error: '店舗が見つかりません' })
    return store
  })

  fastify.post('/', { schema: { body: createBodySchema } }, async (request, reply) => {
    const { subdomain, name, adminUsername, adminPassword } = request.body as {
      subdomain: string; name: string; adminUsername: string; adminPassword: string
    }

    if (RESERVED_SUBDOMAINS.has(subdomain)) {
      return reply.status(422).send({ error: 'このサブドメインは予約されているため使用できません' })
    }

    const existing = await prisma.store.findUnique({ where: { subdomain } })
    if (existing) return reply.status(409).send({ error: 'そのサブドメインは既に使用されています' })

    const passwordHash = await bcrypt.hash(adminPassword, 12)

    const store = await prisma.$transaction(async (tx) => {
      const store = await tx.store.create({ data: { subdomain, name }, select })
      await tx.setting.create({ data: { ...DEFAULT_SETTING, storeId: store.id } })
      await tx.staff.create({
        data: { storeId: store.id, username: adminUsername, passwordHash, role: 'admin' },
      })
      return store
    })

    return reply.status(201).send(store)
  })

  fastify.put('/:id', { schema: { body: updateBodySchema } }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { name?: string; isActive?: boolean }
    const existing = await prisma.store.findUnique({ where: { id: Number(id) } })
    if (!existing) return reply.status(404).send({ error: '店舗が見つかりません' })
    const store = await prisma.store.update({ where: { id: Number(id) }, data: body, select })
    return store
  })

  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const storeId = Number(id)
    const existing = await prisma.store.findUnique({ where: { id: storeId } })
    if (!existing) return reply.status(404).send({ error: '店舗が見つかりません' })

    // FK 依存の逆順で削除する（GroupSeat/CourseFoodItem/DrinkPlanItem/RefreshToken は onDelete: Cascade で自動削除される）
    await prisma.$transaction([
      prisma.orderItem.deleteMany({ where: { storeId } }),
      prisma.group.deleteMany({ where: { storeId } }),
      prisma.session.deleteMany({ where: { storeId } }),
      prisma.course.deleteMany({ where: { storeId } }),
      prisma.drinkPlan.deleteMany({ where: { storeId } }),
      prisma.menuItem.deleteMany({ where: { storeId } }),
      prisma.subCategory.deleteMany({ where: { storeId } }),
      prisma.category.deleteMany({ where: { storeId } }),
      prisma.seat.deleteMany({ where: { storeId } }),
      prisma.seatTable.deleteMany({ where: { storeId } }),
      prisma.staff.deleteMany({ where: { storeId } }),
      prisma.setting.deleteMany({ where: { storeId } }),
      prisma.store.delete({ where: { id: storeId } }),
    ])

    return reply.status(204).send()
  })
}

export default platformStoresRoutes
