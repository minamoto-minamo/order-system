import type { FastifyPluginAsync } from 'fastify'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { requireAdmin } from '../plugins/auth.js'

const updateBodySchema = {
  type: 'object',
  required: ['status'],
  properties: {
    status: { type: 'string', enum: ['open', 'closed'] },
  },
  additionalProperties: false,
} as const

const sessionsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request) => {
    const { status } = request.query as { status?: string }
    const where = status ? { status: status as 'open' | 'closed' } : {}
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

  fastify.get('/current', async (_request, reply) => {
    const session = await prisma.session.findFirst({ where: { status: 'open' } })
    if (!session) return reply.send(null)
    return {
      id: session.id,
      status: session.status,
      openedAt: session.openedAt.toISOString(),
      closedAt: session.closedAt?.toISOString() ?? null,
    }
  })

  fastify.post('/', { preHandler: requireAdmin }, async (request, reply) => {
    const existing = await prisma.session.findFirst({ where: { status: 'open' } })
    if (existing) {
      return reply.status(409).send({ error: '既に営業中のセッションがあります' })
    }
    const session = await prisma.session.create({ data: { status: 'open' } })
    return reply.status(201).send({
      id: session.id,
      status: session.status,
      openedAt: session.openedAt.toISOString(),
      closedAt: null,
    })
  })

  fastify.get('/:id/report', async (request, reply) => {
    const { id } = request.params as { id: string }
    const sessionId = Number(id)

    const session = await prisma.session.findUnique({ where: { id: sessionId } })
    if (!session) return reply.status(404).send({ error: 'セッションが見つかりません' })

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
    const rankMap = new Map<number, { name: string; qty: number; amount: number; categoryName: string; subCategoryName: string }>()

    for (const item of orderItems) {
      const catName = item.menuItem.category.name
      const subName = item.menuItem.subCategory.name
      const amount = item.price * item.qty

      categoryBreakdown[catName] = (categoryBreakdown[catName] ?? 0) + amount
      subBreakdown[subName] = (subBreakdown[subName] ?? 0) + amount

      const hour = item.orderedAt.getHours()
      if (!hourlyMap.has(hour)) hourlyMap.set(hour, {})
      const hourEntry = hourlyMap.get(hour)!
      hourEntry[catName] = (hourEntry[catName] ?? 0) + amount

      const existing = rankMap.get(item.menuItemId) ?? {
        name: item.menuItemName,
        qty: 0,
        amount: 0,
        categoryName: catName,
        subCategoryName: subName,
      }
      existing.qty += item.qty
      existing.amount += amount
      rankMap.set(item.menuItemId, existing)
    }

    const hourly = [...hourlyMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([hour, cats]) => ({ hour, ...cats }))

    const ranking = [...rankMap.values()].sort((a, b) => b.amount - a.amount)

    const totalSeats = await prisma.seat.count()
    const usedSeatIds = new Set(groups.flatMap(g => g.seats.map(gs => gs.seatId)))
    const seatUsageRate = totalSeats > 0 ? Math.round(usedSeatIds.size / totalSeats * 100) : 0

    return {
      total,
      groups: groups.length,
      guests: totalGuests,
      seatUsageRate,
      categoryBreakdown,
      subBreakdown,
      hourly,
      ranking,
    }
  })

  fastify.put('/:id', { schema: { body: updateBodySchema }, preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { status } = request.body as { status: 'open' | 'closed' }

    if (status === 'closed') {
      const activeCount = await prisma.group.count({
        where: {
          sessionId: Number(id),
          status: { in: ['active', 'bill_requested'] },
        },
      })
      if (activeCount > 0) {
        return reply.status(409).send({ error: 'active_groups_exist', count: activeCount })
      }
    }

    try {
      const session = await prisma.session.update({
        where: { id: Number(id) },
        data: {
          status,
          closedAt: status === 'closed' ? new Date() : null,
        },
      })
      const result = {
        id: session.id,
        status: session.status,
        openedAt: session.openedAt.toISOString(),
        closedAt: session.closedAt?.toISOString() ?? null,
      }
      fastify.io.emit('session:updated', result)
      return result
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        return reply.status(404).send({ error: 'セッションが見つかりません' })
      }
      throw e
    }
  })
}

export default sessionsRoutes
