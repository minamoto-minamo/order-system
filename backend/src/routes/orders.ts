import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { toOrderItem } from '../lib/mappers.js'

class GroupStatusError extends Error {}

const createBodySchema = {
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

const VALID_ORDER_STATUSES = new Set(['pending', 'ready', 'served', 'cancelled'])

const ordersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request, reply) => {
    const { groupId, status, sessionId } = request.query as { groupId?: string; status?: string | string[]; sessionId?: string }
    const where: Record<string, unknown> = { storeId: request.storeId }
    if (groupId) where.groupId = groupId
    if (status) {
      const statuses = Array.isArray(status) ? status : status.split(',')
      if (!statuses.every(s => VALID_ORDER_STATUSES.has(s))) {
        return reply.status(400).send({ error: '無効なステータス値です' })
      }
      where.status = statuses.length === 1 ? statuses[0] : { in: statuses }
    }
    if (sessionId) {
      where.group = { sessionId: Number(sessionId) }
    }
    const items = await prisma.orderItem.findMany({ where, orderBy: { orderedAt: 'asc' } })
    return items.map(toOrderItem)
  })

  fastify.post('/', { schema: { body: createBodySchema } }, async (request, reply) => {
    const body = request.body as {
      groupId: string;
      items: { menuItemId: number; qty: number; isTakeout?: boolean }[];
      courseId?: number | null;
    }

    const group = await prisma.group.findFirst({ where: { id: body.groupId, storeId: request.storeId } })
    if (!group) return reply.status(404).send({ error: 'グループが見つかりません' })
    if (group.status !== 'active') return reply.status(409).send({ error: 'このグループには注文を追加できません' })

    const menuItemIds = body.items.map(i => i.menuItemId)
    const menuItems = await prisma.menuItem.findMany({ where: { id: { in: menuItemIds }, storeId: request.storeId } })
    const menuItemMap = new Map(menuItems.map(m => [m.id, m]))

    const missing = menuItemIds.filter(id => !menuItemMap.has(id))
    if (missing.length > 0) {
      return reply.status(422).send({ error: `menuItem ${missing.join(',')} が見つかりません` })
    }

    const soldOut = body.items.filter(i => menuItemMap.get(i.menuItemId)?.soldOut)
    if (soldOut.length > 0) {
      return reply.status(409).send({ error: '品切れの商品が含まれています' })
    }

    const invalidTakeout = body.items.filter(i => {
      const takeoutType = menuItemMap.get(i.menuItemId)?.takeout
      const isTakeout = i.isTakeout === true
      return (isTakeout && takeoutType === 'dine_in') || (!isTakeout && takeoutType === 'takeout')
    })
    if (invalidTakeout.length > 0) {
      return reply.status(422).send({ error: 'テイクアウト設定に合わない商品が含まれています' })
    }

    if (body.courseId != null) {
      const course = await prisma.course.findFirst({ where: { id: body.courseId, storeId: request.storeId } })
      if (!course) return reply.status(422).send({ error: `course ${body.courseId} が見つかりません` })
    }

    let planMenuItemIds: Set<number> | null = null
    if (group.drinkPlanId) {
      const planItems = await prisma.drinkPlanItem.findMany({
        where: { drinkPlanId: group.drinkPlanId },
        select: { menuItemId: true },
      })
      planMenuItemIds = new Set(planItems.map(p => p.menuItemId))
    }

    const setting = await prisma.setting.findUnique({ where: { storeId: request.storeId } })
    if (!setting) fastify.log.warn('setting not found, using default tax rates')
    const taxRateInHouse = setting?.taxRateInHouse.toNumber() ?? 10
    const taxRateTakeout = setting?.taxRateTakeout.toNumber() ?? 8

    const created = await prisma.$transaction(async (tx) => {
      const currentGroup = await tx.group.findUnique({ where: { id: body.groupId } })
      if (currentGroup?.status !== 'active') throw new GroupStatusError()
      return Promise.all(body.items.map(item => {
        const isTakeout = item.isTakeout ?? false
        // 飲み放題プラン対象商品は店内注文に限り0円（テイクアウトはプラン対象外）
        const isPlanItem = !isTakeout && (planMenuItemIds?.has(item.menuItemId) ?? false)
        return tx.orderItem.create({
          data: {
            groupId: body.groupId,
            menuItemId: item.menuItemId,
            // 注文時点の名称・価格・税率をスナップショット保存（後から変更しても履歴が壊れない）
            menuItemName: menuItemMap.get(item.menuItemId)!.name,
            price: isPlanItem ? 0 : menuItemMap.get(item.menuItemId)!.price,
            qty: item.qty,
            isTakeout,
            taxRate: isTakeout ? taxRateTakeout : taxRateInHouse,
            courseId: body.courseId ?? null,
            storeId: request.storeId,
          },
        })
      }))
    }).catch(e => {
      if (e instanceof GroupStatusError) return null
      throw e
    })
    if (!created) return reply.status(409).send({ error: 'このグループには注文を追加できません' })

    const results = created.map(toOrderItem)
    for (const result of results) {
      fastify.io.to(`store:${request.storeId}`).emit('order:created', result)
    }

    return reply.status(201).send(results)
  })

  fastify.put('/:id/cancel', { schema: { body: cancelBodySchema } }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { qty } = request.body as { qty: number }

    // トランザクション内で throw するとロールバックが走るため、特殊値（null / {conflict}）で返す
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.orderItem.findFirst({
        where: { id, storeId: request.storeId },
        include: { group: { include: { session: true } } },
      })
      if (!order) return null
      if (order.status === 'cancelled') {
        return { conflict: true }
      }
      // 会計済み（closed）のグループ・セッションの注文はキャンセルさせない
      if (order.group.status === 'closed' || order.group.session.status === 'closed') {
        return { conflict: true }
      }

      if (qty >= order.qty) {
        return tx.orderItem.update({
          where: { id },
          data: { status: 'cancelled' },
        })
      } else {
        return tx.orderItem.update({
          where: { id },
          data: { qty: order.qty - qty },
        })
      }
    })

    if (result === null) return reply.status(404).send({ error: '注文が見つかりません' })
    if ('conflict' in result) return reply.status(409).send({ error: 'キャンセルできないステータスです' })

    const mapped = toOrderItem(result)
    // 完全キャンセル（IDのみ）と数量変更（全フィールド）はクライアントの処理が異なるためイベントを分ける
    if (result.status === 'cancelled') {
      fastify.io.to(`store:${request.storeId}`).emit('order:cancelled', mapped.id)
    } else {
      fastify.io.to(`store:${request.storeId}`).emit('order:updated', mapped)
    }
    return mapped
  })
}

export default ordersRoutes
