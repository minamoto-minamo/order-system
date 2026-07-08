import type { FastifyPluginAsync } from 'fastify'
import rateLimit from '@fastify/rate-limit'
import { prisma } from '../lib/prisma.js'
import { toOrderItem, toGroup } from '../lib/mappers.js'
import { ErrorCodes, sendError } from '../lib/errors.js'

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
    const group = await prisma.group.findFirst({ where: { id, storeId: request.storeId } })
    if (!group) return sendError(reply, 404, ErrorCodes.Customer.GroupNotFound, 'テーブルが見つかりません')
    return { id: group.id, name: group.name, status: group.status }
  })

  fastify.get('/groups/:id/menus', async (request, reply) => {
    const { id } = request.params as { id: string }
    const group = await prisma.group.findFirst({ where: { id, storeId: request.storeId } })
    if (!group) return sendError(reply, 404, ErrorCodes.Customer.GroupNotFound, 'テーブルが見つかりません')

    const [menus, categories, subCategories] = await Promise.all([
      prisma.menuItem.findMany({ where: { soldOut: false, storeId: request.storeId }, orderBy: { id: 'asc' } }),
      prisma.category.findMany({ where: { storeId: request.storeId }, orderBy: { sort: 'asc' } }),
      prisma.subCategory.findMany({ where: { storeId: request.storeId }, orderBy: { sort: 'asc' } }),
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
    const group = await prisma.group.findFirst({ where: { id, storeId: request.storeId } })
    if (!group) return sendError(reply, 404, ErrorCodes.Customer.GroupNotFound, 'テーブルが見つかりません')
    const orders = await prisma.orderItem.findMany({
      where: { groupId: id },
      orderBy: { orderedAt: 'asc' },
    })
    return orders.map(toOrderItem)
  })

  fastify.post('/groups/:id/bill', async (request, reply) => {
    const { id } = request.params as { id: string }
    const group = await prisma.group.findFirst({ where: { id, storeId: request.storeId } })
    if (!group) return sendError(reply, 404, ErrorCodes.Customer.GroupNotFound, 'テーブルが見つかりません')
    if (group.status !== 'active') return sendError(reply, 400, ErrorCodes.Customer.BillRequestNotAllowed, '会計を依頼できない状態です')
    const updated = await prisma.group.update({
      where: { id },
      data: { status: 'bill_requested' },
      include: { seats: true },
    })
    fastify.io.to(`store:${request.storeId}`).to(`group:${id}`).emit('group:updated', toGroup(updated))
    return reply.status(204).send()
  })

  fastify.get('/settings', async (request) => {
    const s = await prisma.setting.findUnique({ where: { storeId: request.storeId } })
    return { taxRateInHouse: s?.taxRateInHouse ?? 10, taxRateTakeout: s?.taxRateTakeout ?? 8 }
  })

  fastify.post('/groups/:id/call-staff', async (request, reply) => {
    const { id } = request.params as { id: string }
    const group = await prisma.group.findFirst({ where: { id, storeId: request.storeId } })
    if (!group) return sendError(reply, 404, ErrorCodes.Customer.GroupNotFound, 'テーブルが見つかりません')
    fastify.io.to(`store:${request.storeId}`).emit('staff:called', group.id, group.name)
    return reply.status(204).send()
  })

  fastify.post('/orders', { schema: { body: createOrderBodySchema } }, async (request, reply) => {
    const body = request.body as {
      groupId: string;
      items: { menuItemId: number; qty: number }[];
    }

    const group = await prisma.group.findFirst({ where: { id: body.groupId, storeId: request.storeId } })
    if (!group) return sendError(reply, 404, ErrorCodes.Customer.GroupNotFound, 'テーブルが見つかりません')
    if (group.status !== 'active') return sendError(reply, 400, ErrorCodes.Customer.OrderingClosed, '現在注文を受け付けていません')

    const menuItemIds = body.items.map(i => i.menuItemId)
    const menuItems = await prisma.menuItem.findMany({ where: { id: { in: menuItemIds }, storeId: request.storeId } })
    const menuItemMap = new Map(menuItems.map(m => [m.id, m]))

    const missing = menuItemIds.filter(id => !menuItemMap.has(id))
    if (missing.length > 0) {
      return sendError(reply, 422, ErrorCodes.Customer.MenuItemsNotFound, `menuItem ${missing.join(',')} が見つかりません`, { menuItemIds: missing })
    }

    const soldOut = body.items.filter(i => menuItemMap.get(i.menuItemId)?.soldOut)
    if (soldOut.length > 0) {
      return sendError(reply, 409, ErrorCodes.Customer.SoldOut, '品切れの商品が注文リストに入っています', {
        menuItemIds: soldOut.map(i => i.menuItemId),
        menuItemNames: soldOut.map(i => menuItemMap.get(i.menuItemId)!.name),
      })
    }

    const takeoutOnly = body.items.filter(i => menuItemMap.get(i.menuItemId)?.takeout === 'takeout')
    if (takeoutOnly.length > 0) {
      return sendError(reply, 422, ErrorCodes.Customer.TakeoutOnly, 'テイクアウト専用の商品は店内でご注文いただけません')
    }

    let planMenuItemIds: Set<number> | null = null
    if (group.drinkPlanId) {
      const planItems = await prisma.drinkPlanItem.findMany({
        where: { drinkPlanId: group.drinkPlanId },
        select: { menuItemId: true },
      })
      planMenuItemIds = new Set(planItems.map(p => p.menuItemId))
      const outOfPlan = body.items.filter(i => !planMenuItemIds!.has(i.menuItemId))
      if (outOfPlan.length > 0) {
        return sendError(reply, 422, ErrorCodes.Customer.DrinkPlanMismatch, 'ドリンクプランに含まれていない商品が選択されています')
      }
    }

    const setting = await prisma.setting.findUnique({ where: { storeId: request.storeId } })
    if (!setting) fastify.log.warn('setting not found, using default tax rates')
    const taxRateInHouse = setting?.taxRateInHouse.toNumber() ?? 10

    const txResult = await prisma.$transaction(async (tx) => {
      const current = await tx.group.findUnique({ where: { id: body.groupId }, select: { status: true } })
      if (current?.status !== 'active') return null
      return Promise.all(
        body.items.map(item => {
          const isPlanItem = planMenuItemIds?.has(item.menuItemId) ?? false
          // 飲み放題対象商品は price を 0 にするため、解除時に復元できるよう元価格を originalPrice に退避する
          const originalPrice = menuItemMap.get(item.menuItemId)!.price
          return tx.orderItem.create({
            data: {
              groupId: body.groupId,
              menuItemId: item.menuItemId,
              menuItemName: menuItemMap.get(item.menuItemId)!.name,
              price: isPlanItem ? 0 : originalPrice,
              originalPrice: isPlanItem ? originalPrice : null,
              qty: item.qty,
              isTakeout: false,
              taxRate: taxRateInHouse,
              courseId: null,
              storeId: request.storeId,
            },
          })
        })
      )
    })

    if (!txResult) return sendError(reply, 400, ErrorCodes.Customer.OrderingClosed, '現在注文を受け付けていません')

    const results = txResult.map(toOrderItem)
    for (const result of results) {
      fastify.io.to(`store:${request.storeId}`).to(`group:${result.groupId}`).emit('order:created', result)
    }

    return reply.status(201).send(results)
  })
}

export default customerRoutes
