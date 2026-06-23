import type { FastifyPluginAsync } from 'fastify'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { toOrderItem } from '../lib/mappers.js'

const createBodySchema = {
  type: 'object',
  required: ['groupId', 'items'],
  properties: {
    groupId: { type: 'integer', minimum: 1 },
    items: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['menuItemId', 'qty'],
        properties: {
          menuItemId: { type: 'integer', minimum: 1 },
          qty: { type: 'integer', minimum: 1 },
          isTakeout: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    },
    courseId: { type: ['integer', 'null'] },
  },
  additionalProperties: false,
} as const

const cancelBodySchema = {
  type: 'object',
  required: ['qty'],
  properties: {
    qty: { type: 'integer', minimum: 1 },
  },
  additionalProperties: false,
} as const

const ordersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request) => {
    const { groupId, status, sessionId } = request.query as { groupId?: string; status?: string | string[]; sessionId?: string }
    const where: Record<string, unknown> = {}
    if (groupId) where.groupId = Number(groupId)
    if (status) {
      if (Array.isArray(status)) {
        where.status = { in: status }
      } else {
        where.status = status.includes(',') ? { in: status.split(',') } : status
      }
    }
    if (sessionId) {
      where.group = { sessionId: Number(sessionId) }
    }
    const items = await prisma.orderItem.findMany({ where, orderBy: { orderedAt: 'asc' } })
    return items.map(toOrderItem)
  })

  fastify.post('/', { schema: { body: createBodySchema } }, async (request, reply) => {
    const body = request.body as {
      groupId: number;
      items: { menuItemId: number; qty: number; isTakeout?: boolean }[];
      courseId?: number | null;
    }

    const group = await prisma.group.findUnique({ where: { id: body.groupId } })
    if (!group) return reply.status(404).send({ error: 'グループが見つかりません' })
    if (group.status !== 'active') return reply.status(409).send({ error: 'このグループには注文を追加できません' })

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

    const created = await prisma.$transaction(
      body.items.map(item =>
        prisma.orderItem.create({
          data: {
            groupId: body.groupId,
            menuItemId: item.menuItemId,
            menuItemName: menuItemMap.get(item.menuItemId)!.name,
            price: menuItemMap.get(item.menuItemId)!.price,
            qty: item.qty,
            isTakeout: item.isTakeout ?? false,
            courseId: body.courseId ?? null,
          },
        })
      )
    )

    const results = created.map(toOrderItem)
    for (const result of results) {
      fastify.io.emit('order:created', result)
    }

    return reply.status(201).send(results)
  })

  fastify.put('/:id/cancel', { schema: { body: cancelBodySchema } }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { qty } = request.body as { qty: number }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const order = await tx.orderItem.findUnique({ where: { id: Number(id) } })
        if (!order) return null
        if (order.status === 'cancelled') {
          return { conflict: true }
        }

        if (qty >= order.qty) {
          return tx.orderItem.update({
            where: { id: Number(id) },
            data: { status: 'cancelled' },
          })
        } else {
          return tx.orderItem.update({
            where: { id: Number(id) },
            data: { qty: order.qty - qty },
          })
        }
      })

      if (result === null) return reply.status(404).send({ error: 'Not found' })
      if ('conflict' in result) return reply.status(409).send({ error: 'キャンセルできないステータスです' })

      const mapped = toOrderItem(result)
      if (result.status === 'cancelled') {
        fastify.io.emit('order:cancelled', mapped.id)
      } else {
        fastify.io.emit('order:updated', mapped)
      }
      return mapped
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        return reply.status(404).send({ error: 'Not found' })
      }
      throw e
    }
  })
}

export default ordersRoutes
