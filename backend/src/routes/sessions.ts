import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { requireAdmin } from '../plugins/auth.js'
import { ErrorCodes, sendError } from '../lib/errors.js'

const updateBodySchema = {
  type: 'object',
  required: ['status'],
  properties: {
    status: { type: 'string', enum: ['open', 'closed'] },
  },
  additionalProperties: false,
} as const

const sessionsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: { status: { type: 'string', enum: ['open', 'closed'] } },
        additionalProperties: false,
      },
    },
  }, async (request) => {
    const { status } = request.query as { status?: string }
    const where: Record<string, unknown> = { storeId: request.storeId }
    if (status) where.status = status
    const sessions = await prisma.session.findMany({
      where,
      orderBy: { openedAt: 'desc' },
    })
    return sessions.map(s => ({
      id: s.id,
      status: s.status,
      openedAt: s.openedAt.toISOString(),
      closedAt: s.closedAt?.toISOString() ?? null,
    }))
  })

  fastify.get('/current', async (request, reply) => {
    const session = await prisma.session.findFirst({ where: { status: 'open', storeId: request.storeId } })
    // return null だと Fastify が本文なしで応答するため reply.send を使う
    if (!session) return reply.send(null)
    return {
      id: session.id,
      status: session.status,
      openedAt: session.openedAt.toISOString(),
      closedAt: session.closedAt?.toISOString() ?? null,
    }
  })

  fastify.post('/', { preHandler: requireAdmin }, async (request, reply) => {
    const { storeId } = request
    const session = await prisma.$transaction(async (tx) => {
      const existing = await tx.session.findFirst({ where: { status: 'open', storeId } })
      if (existing) return null
      return tx.session.create({ data: { status: 'open', storeId } })
    })
    if (!session) return sendError(reply, 409, ErrorCodes.Sessions.AlreadyOpen, '既に営業中のセッションがあります')
    const result = {
      id: session.id,
      status: session.status,
      openedAt: session.openedAt.toISOString(),
      closedAt: null,
    }
    fastify.io.to(`store:${request.storeId}`).emit('session:updated', result)
    return reply.status(201).send(result)
  })

  fastify.get('/:id/report', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const sessionId = Number(id)

    const session = await prisma.session.findFirst({ where: { id: sessionId, storeId: request.storeId } })
    if (!session) return sendError(reply, 404, ErrorCodes.Sessions.NotFound, 'セッションが見つかりません')

    const groups = await prisma.group.findMany({
      where: { sessionId },
      include: { seats: true },
    })
    const groupIds = groups.map(g => g.id)
    const totalGuests = groups.reduce((s, g) => s + g.guestCount, 0)

    const orderItems = await prisma.orderItem.findMany({
      where: {
        groupId: { in: groupIds },
        status: { not: 'cancelled' },
      },
      include: {
        menuItem: {
          include: { category: true, subCategory: true },
        },
      },
    })

    const total = orderItems.reduce((s, item) => s + item.price * item.qty, 0)
    const categoryBreakdown: Record<string, number> = {}
    const subBreakdown: Record<string, number> = {}
    const hourlyMap = new Map<number, Record<string, number>>()
    const rankMap = new Map<number | string, { name: string; qty: number; amount: number; categoryName: string; subCategoryName: string }>()
    const taxBreakdown: Record<string, { subtotal: number; tax: number }> = {}

    for (const item of orderItems) {
      const { menuItem } = item
      const amount = item.price * item.qty

      const rate = item.taxRate.toNumber().toString()
      if (!taxBreakdown[rate]) taxBreakdown[rate] = { subtotal: 0, tax: 0 }
      taxBreakdown[rate].subtotal += amount
      taxBreakdown[rate].tax += Math.floor(amount * item.taxRate.toNumber() / 100)

      const catName = item.isCourseCharge ? 'コース・飲み放題料金' : (menuItem?.category.name ?? '削除済みメニュー')
      const subName = item.isCourseCharge ? 'コース・飲み放題料金' : (menuItem?.subCategory.name ?? '削除済みメニュー')

      categoryBreakdown[catName] = (categoryBreakdown[catName] ?? 0) + amount
      subBreakdown[subName] = (subBreakdown[subName] ?? 0) + amount

      const hour = item.orderedAt.getHours()
      if (!hourlyMap.has(hour)) hourlyMap.set(hour, {})
      const hourEntry = hourlyMap.get(hour)!
      hourEntry[catName] = (hourEntry[catName] ?? 0) + amount

      const rankKey: number | string = item.menuItemId ?? `name:${item.menuItemName}`
      const existing = rankMap.get(rankKey) ?? {
        name: item.menuItemName,
        qty: 0,
        amount: 0,
        categoryName: catName,
        subCategoryName: subName,
      }
      existing.qty += item.qty
      existing.amount += amount
      rankMap.set(rankKey, existing)
    }

    const hourly = [...hourlyMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([hour, cats]) => ({ hour, ...cats }))

    const ranking = [...rankMap.values()].sort((a, b) => b.amount - a.amount)

    const totalSeats = await prisma.seat.count({ where: { storeId: request.storeId } })
    const usedSeatIds = new Set(groups.flatMap(g => g.seats.map(gs => gs.seatId)))
    const seatUsageRate = totalSeats > 0 ? Math.round(usedSeatIds.size / totalSeats * 100) : 0

    return {
      total,
      groups: groups.length,
      guests: totalGuests,
      seatUsageRate,
      categoryBreakdown,
      subBreakdown,
      taxBreakdown,
      hourly,
      ranking,
    }
  })

  fastify.put('/:id', { preHandler: requireAdmin, schema: { body: updateBodySchema } }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { status } = request.body as { status: 'open' | 'closed' }
    const sessionId = Number(id)

    const existing = await prisma.session.findFirst({ where: { id: sessionId, storeId: request.storeId } })
    if (!existing) return sendError(reply, 404, ErrorCodes.Sessions.NotFound, 'セッションが見つかりません')

    try {
      const session = await prisma.$transaction(async (tx) => {
        if (status === 'closed') {
          const activeCount = await tx.group.count({
            where: {
              sessionId,
              status: { in: ['active', 'bill_requested'] },
            },
          })
          if (activeCount > 0) {
            const err = Object.assign(new Error('active_groups_exist'), { count: activeCount })
            throw err
          }
        }
        return tx.session.update({
          where: { id: sessionId },
          data: {
            status,
            closedAt: status === 'closed' ? new Date() : null,
          },
        })
      })
      const result = {
        id: session.id,
        status: session.status,
        openedAt: session.openedAt.toISOString(),
        closedAt: session.closedAt?.toISOString() ?? null,
      }
      fastify.io.to(`store:${request.storeId}`).emit('session:updated', result)
      return result
    } catch (e) {
      if (e instanceof Error && e.message === 'active_groups_exist') {
        return sendError(reply, 409, ErrorCodes.Sessions.ActiveGroupsExist, 'active_groups_exist', { count: (e as any).count })
      }
      throw e
    }
  })
}

export default sessionsRoutes
