import type { FastifyPluginAsync } from 'fastify'
import rateLimit from '@fastify/rate-limit'
import { prisma } from '../lib/prisma.js'
import { toOrderItem, toGroup } from '../lib/mappers.js'

const createOrderBodySchema = {
  type: 'object',
  required: ['groupId', 'items'],
  properties: {
    groupId: { type: 'string', minLength: 1 },
    items: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['menuItemId', 'qty'],
        properties: {
          menuItemId: { type: 'integer', minimum: 1 },
          qty: { type: 'integer', minimum: 1, maximum: 99 },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
} as const

const customerRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(rateLimit, { max: 60, timeWindow: '1 minute' })

  fastify.get('/groups/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const group = await prisma.group.findUnique({ where: { id } })
    if (!group) return reply.status(404).send({ error: 'テーブルが見つかりません' })
    return { id: group.id, name: group.name, status: group.status }
  })

  fastify.get('/groups/:id/menus', async (request, reply) => {
    const { id } = request.params as { id: string }
    const group = await prisma.group.findUnique({ where: { id } })
    if (!group) return reply.status(404).send({ error: 'テーブルが見つかりません' })

    const [menus, categories, subCategories] = await Promise.all([
      prisma.menuItem.findMany({ where: { soldOut: false }, orderBy: { id: 'asc' } }),
      prisma.category.findMany({ orderBy: { sort: 'asc' } }),
      prisma.subCategory.findMany({ orderBy: { sort: 'asc' } }),
    ])

    return {
      menus: menus.map(m => ({
        id: m.id, name: m.name, price: m.price,
        categoryId: m.categoryId, subCategoryId: m.subCategoryId,
        takeout: m.takeout, soldOut: m.soldOut,
      })),
      categories: categories.map(c => ({ id: c.id, name: c.name, sort: c.sort })),
      subCategories: subCategories.map(s => ({ id: s.id, name: s.name, sort: s.sort, categoryId: s.categoryId })),
    }
  })

  fastify.get('/groups/:id/orders', async (request, reply) => {
    const { id } = request.params as { id: string }
    const group = await prisma.group.findUnique({ where: { id } })
    if (!group) return reply.status(404).send({ error: 'テーブルが見つかりません' })
    const orders = await prisma.orderItem.findMany({
      where: { groupId: id },
      orderBy: { orderedAt: 'asc' },
    })
    return orders.map(toOrderItem)
  })

  fastify.post('/groups/:id/bill', async (request, reply) => {
    const { id } = request.params as { id: string }
    const group = await prisma.group.findUnique({ where: { id } })
    if (!group) return reply.status(404).send({ error: 'テーブルが見つかりません' })
    if (group.status !== 'active') return reply.status(400).send({ error: '会計を依頼できない状態です' })
    const updated = await prisma.group.update({
      where: { id },
      data: { status: 'bill_requested' },
      include: { seats: true },
    })
    fastify.io.to('staff').emit('group:updated', toGroup(updated))
    return reply.status(204).send()
  })

  fastify.get('/settings', async () => {
    const s = await prisma.setting.findFirst()
    return { taxRateInHouse: s?.taxRateInHouse ?? 10, taxRateTakeout: s?.taxRateTakeout ?? 8 }
  })

  fastify.post('/groups/:id/call-staff', async (request, reply) => {
    const { id } = request.params as { id: string }
    const group = await prisma.group.findUnique({ where: { id } })
    if (!group) return reply.status(404).send({ error: 'テーブルが見つかりません' })
    fastify.io.to('staff').emit('staff:called', group.id, group.name)
    return reply.status(204).send()
  })

  fastify.post('/orders', { schema: { body: createOrderBodySchema } }, async (request, reply) => {
    const body = request.body as {
      groupId: string;
      items: { menuItemId: number; qty: number }[];
    }

    const group = await prisma.group.findUnique({ where: { id: body.groupId } })
    if (!group) return reply.status(404).send({ error: 'テーブルが見つかりません' })
    if (group.status !== 'active') return reply.status(400).send({ error: '現在注文を受け付けていません' })

    const menuItemIds = body.items.map(i => i.menuItemId)
    const menuItems = await prisma.menuItem.findMany({ where: { id: { in: menuItemIds } } })
    const menuItemMap = new Map(menuItems.map(m => [m.id, m]))

    const missing = menuItemIds.filter(id => !menuItemMap.has(id))
    if (missing.length > 0) {
      return reply.status(422).send({ error: `menuItem ${missing.join(',')} が見つかりません` })
    }

    const soldOut = body.items.filter(i => menuItemMap.get(i.menuItemId)?.soldOut)
    if (soldOut.length > 0) {
      return reply.status(409).send({ error: '品切れの商品が含まれています' })
    }

    if (group.drinkPlanId) {
      const planItems = await prisma.drinkPlanItem.findMany({
        where: { drinkPlanId: group.drinkPlanId },
        select: { menuItemId: true },
      })
      const planMenuItemIds = new Set(planItems.map(p => p.menuItemId))
      const outOfPlan = body.items.filter(i => !planMenuItemIds.has(i.menuItemId))
      if (outOfPlan.length > 0) {
        return reply.status(422).send({ error: 'ドリンクプランに含まれていない商品が選択されています' })
      }
    }

    const setting = await prisma.setting.findUnique({ where: { id: 1 } })
    if (!setting) fastify.log.warn('setting not found, using default tax rates')
    const taxRateInHouse = setting?.taxRateInHouse.toNumber() ?? 10

    const txResult = await prisma.$transaction(async (tx) => {
      const current = await tx.group.findUnique({ where: { id: body.groupId }, select: { status: true } })
      if (current?.status !== 'active') return null
      return Promise.all(
        body.items.map(item =>
          tx.orderItem.create({
            data: {
              groupId: body.groupId,
              menuItemId: item.menuItemId,
              menuItemName: menuItemMap.get(item.menuItemId)!.name,
              price: menuItemMap.get(item.menuItemId)!.price,
              qty: item.qty,
              isTakeout: false,
              taxRate: taxRateInHouse,
              courseId: null,
            },
          })
        )
      )
    })

    if (!txResult) return reply.status(400).send({ error: '現在注文を受け付けていません' })

    const results = txResult.map(toOrderItem)
    for (const result of results) {
      fastify.io.to('staff').emit('order:created', result)
    }

    return reply.status(201).send(results)
  })
}

export default customerRoutes
