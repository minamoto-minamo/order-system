import type { FastifyPluginAsync } from 'fastify'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { requireAdmin } from '../plugins/auth.js'

const createBodySchema = {
  type: 'object',
  required: ['label', 'type', 'x', 'y'],
  properties: {
    label: { type: 'string', minLength: 1 },
    type: { type: 'string', enum: ['counter', 'table'] },
    x: { type: 'integer', minimum: 0 },
    y: { type: 'integer', minimum: 0 },
    tableId: { type: 'integer', minimum: 1 },
  },
  additionalProperties: false,
} as const

const updateBodySchema = {
  type: 'object',
  properties: {
    label: { type: 'string', minLength: 1 },
    type: { type: 'string', enum: ['counter', 'table'] },
    x: { type: 'integer', minimum: 0 },
    y: { type: 'integer', minimum: 0 },
    tableId: { type: ['integer', 'null'] },
  },
  additionalProperties: false,
} as const

const seatsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => {
    return prisma.seat.findMany()
  })

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const seat = await prisma.seat.findUnique({ where: { id: Number(id) } })
    if (!seat) return reply.status(404).send({ error: '席が見つかりません' })
    return seat
  })

  fastify.post('/', { schema: { body: createBodySchema }, preHandler: requireAdmin }, async (request, reply) => {
    const body = request.body as { label: string; type: 'counter' | 'table'; x: number; y: number; tableId?: number }
    const seat = await prisma.seat.create({
      data: {
        label: body.label,
        type: body.type,
        x: body.x,
        y: body.y,
        tableId: body.tableId ?? null,
      },
    })
    fastify.io.to('staff').emit('seat:created', seat)
    return reply.status(201).send(seat)
  })

  fastify.put('/:id', { schema: { body: updateBodySchema }, preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as Partial<{ label: string; type: 'counter' | 'table'; x: number; y: number; tableId: number | null }>
    try {
      const seat = await prisma.seat.update({
        where: { id: Number(id) },
        data: { label: body.label, type: body.type, x: body.x, y: body.y, tableId: body.tableId },
      })
      fastify.io.to('staff').emit('seat:updated', seat)
      return seat
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        return reply.status(404).send({ error: '席が見つかりません' })
      }
      throw e
    }
  })

  fastify.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    // bill_requested も会計完了前は席を占有しているため削除不可とする
    const inUse = await prisma.groupSeat.findFirst({
      where: {
        seatId: Number(id),
        group: { status: { in: ['active', 'bill_requested'] } },
      },
    })
    if (inUse) return reply.status(409).send({ error: '使用中の席は削除できません' })
    await prisma.seat.delete({ where: { id: Number(id) } })
    return reply.status(204).send()
  })
}

export default seatsRoutes
