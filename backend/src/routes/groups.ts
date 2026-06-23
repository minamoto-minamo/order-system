import type { FastifyPluginAsync } from 'fastify'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { toGroup } from '../lib/mappers.js'

const createBodySchema = {
  type: 'object',
  required: ['guestCount', 'seatIds'],
  properties: {
    name: { type: 'string' },
    guestCount: { type: 'integer', minimum: 1 },
    seatIds: { type: 'array', items: { type: 'integer', minimum: 1 }, minItems: 1 },
  },
  additionalProperties: false,
} as const

const updateBodySchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['active', 'bill_requested', 'closed'] },
    courseId: { type: ['integer', 'null'] },
    drinkPlanId: { type: ['integer', 'null'] },
    name: { type: 'string', minLength: 1 },
    guestCount: { type: 'integer', minimum: 1 },
    seatIds: { type: 'array', items: { type: 'integer', minimum: 1 } },
  },
  additionalProperties: false,
} as const

const groupsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request) => {
    const { sessionId, status } = request.query as { sessionId?: string; status?: string | string[] }
    const where: Record<string, unknown> = {}
    if (sessionId) where.sessionId = Number(sessionId)
    if (status) {
      if (Array.isArray(status)) {
        where.status = { in: status }
      } else {
        // クライアントが ?status=active,bill_requested のようにカンマ区切りで渡す場合も受け付ける
        where.status = status.includes(',') ? { in: status.split(',') } : status
      }
    }
    const groups = await prisma.group.findMany({
      where,
      include: { seats: true },
      orderBy: { createdAt: 'asc' },
    })
    return groups.map(toGroup)
  })

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const group = await prisma.group.findUnique({
      where: { id: Number(id) },
      include: { seats: true },
    })
    if (!group) return reply.status(404).send({ error: 'グループが見つかりません' })
    return toGroup(group)
  })

  fastify.post('/', { schema: { body: createBodySchema } }, async (request, reply) => {
    const body = request.body as { name?: string; guestCount: number; seatIds: number[] }

    const session = await prisma.session.findFirst({ where: { status: 'open' } })
    if (!session) return reply.status(409).send({ error: '営業中のセッションがありません' })

    const conflictingSeat = await prisma.groupSeat.findFirst({
      where: {
        seatId: { in: body.seatIds },
        group: { status: { in: ['active', 'bill_requested'] } },
      },
    })
    if (conflictingSeat) return reply.status(409).send({ error: '選択した席はすでに使用中です' })

    let name = body.name
    if (!name) {
      const seatRecords = await prisma.seat.findMany({ where: { id: { in: body.seatIds } } })
      name = seatRecords.map(s => s.label).join('・') || `グループ`
    }

    const group = await prisma.group.create({
      data: {
        name,
        guestCount: body.guestCount,
        sessionId: session.id,
        seats: {
          create: body.seatIds.map(seatId => ({ seatId })),
        },
      },
      include: { seats: true },
    })

    const result = toGroup(group)
    fastify.io.emit('group:created', result)

    // ホール画面の席カードが占有状態をリアルタイムで反映できるよう通知する
    const seatRecords = await prisma.seat.findMany({ where: { id: { in: body.seatIds } } })
    for (const seat of seatRecords) {
      fastify.io.emit('seat:updated', seat)
    }

    return reply.status(201).send(result)
  })

  fastify.put('/:id', { schema: { body: updateBodySchema } }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      status?: string; courseId?: number | null; drinkPlanId?: number | null;
      name?: string; guestCount?: number; seatIds?: number[];
    }

    const updateData: Record<string, unknown> = {}
    if (body.status !== undefined) updateData.status = body.status
    if (body.courseId !== undefined) updateData.courseId = body.courseId
    if (body.drinkPlanId !== undefined) updateData.drinkPlanId = body.drinkPlanId
    if (body.name !== undefined) updateData.name = body.name
    if (body.guestCount !== undefined) updateData.guestCount = body.guestCount

    if (body.seatIds !== undefined) {
      // 差分更新ではなく全置換（deleteMany → create）で席割り当てを更新する
      updateData.seats = {
        deleteMany: {},
        create: body.seatIds.map(seatId => ({ seatId })),
      }
    }

    try {
      const group = await prisma.group.update({
        where: { id: Number(id) },
        data: updateData,
        include: { seats: true },
      })

      const result = toGroup(group)
      fastify.io.emit('group:updated', result)

      const seatIds = body.seatIds ?? group.seats.map(s => s.seatId)
      const seatRecords = await prisma.seat.findMany({ where: { id: { in: seatIds } } })
      for (const seat of seatRecords) {
        fastify.io.emit('seat:updated', seat)
      }

      return result
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        return reply.status(404).send({ error: 'グループが見つかりません' })
      }
      throw e
    }
  })
}

export default groupsRoutes
