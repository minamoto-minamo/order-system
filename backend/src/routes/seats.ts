import { Prisma } from '@prisma/client'
import type { FastifyPluginAsync } from 'fastify'
import { ErrorCodes, sendError } from '../lib/errors.js'
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

type DeleteSeatTxResult = { ok: true } | { err: 'not_found' | 'in_use' }

const seatsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request) => {
    return prisma.seat.findMany({ where: { storeId: request.storeId } })
  })

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const seat = await prisma.seat.findFirst({
      where: { id: Number(id), storeId: request.storeId },
    })
    if (!seat) return sendError(reply, 404, ErrorCodes.Seats.NotFound, '席が見つかりません')
    return seat
  })

  fastify.post(
    '/',
    { schema: { body: createBodySchema }, preHandler: requireAdmin },
    async (request, reply) => {
      const body = request.body as {
        label: string
        type: 'counter' | 'table'
        x: number
        y: number
        tableId?: number
      }
      if (body.tableId != null) {
        const table = await prisma.seatTable.findFirst({
          where: { id: body.tableId, storeId: request.storeId },
        })
        if (!table)
          return sendError(reply, 422, ErrorCodes.Seats.TableNotFound, 'テーブルが見つかりません')
      }
      const seat = await prisma.seat.create({
        data: {
          label: body.label,
          type: body.type,
          x: body.x,
          y: body.y,
          tableId: body.tableId ?? null,
          storeId: request.storeId,
        },
      })
      fastify.io.to(`store:${request.storeId}`).emit('seat:created', seat)
      return reply.status(201).send(seat)
    },
  )

  fastify.put(
    '/:id',
    { schema: { body: updateBodySchema }, preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const body = request.body as Partial<{
        label: string
        type: 'counter' | 'table'
        x: number
        y: number
        tableId: number | null
      }>
      const existing = await prisma.seat.findFirst({
        where: { id: Number(id), storeId: request.storeId },
      })
      if (!existing) return sendError(reply, 404, ErrorCodes.Seats.NotFound, '席が見つかりません')
      if (body.tableId != null) {
        const table = await prisma.seatTable.findFirst({
          where: { id: body.tableId, storeId: request.storeId },
        })
        if (!table)
          return sendError(reply, 422, ErrorCodes.Seats.TableNotFound, 'テーブルが見つかりません')
      }
      const seat = await prisma.seat.update({
        where: { id: Number(id) },
        data: { label: body.label, type: body.type, x: body.x, y: body.y, tableId: body.tableId },
      })
      fastify.io.to(`store:${request.storeId}`).emit('seat:updated', seat)
      return seat
    },
  )

  fastify.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }

    let txResult: DeleteSeatTxResult
    try {
      txResult = await prisma.$transaction(
        async (tx) => {
          const seat = await tx.seat.findFirst({
            where: { id: Number(id), storeId: request.storeId },
          })
          if (!seat) return { err: 'not_found' as const }

          // bill_requested も会計完了前は席を占有しているため削除不可とする
          const inUse = await tx.groupSeat.findFirst({
            where: {
              seatId: Number(id),
              group: { status: { in: ['active', 'bill_requested'] } },
            },
          })
          if (inUse) return { err: 'in_use' as const }

          await tx.seat.delete({ where: { id: Number(id) } })
          return { ok: true as const }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034') {
        return sendError(reply, 409, ErrorCodes.Seats.InUse, '使用中の席は削除できません')
      }
      throw e
    }

    if ('err' in txResult) {
      if (txResult.err === 'not_found') {
        return sendError(reply, 404, ErrorCodes.Seats.NotFound, '席が見つかりません')
      }
      return sendError(reply, 409, ErrorCodes.Seats.InUse, '使用中の席は削除できません')
    }

    fastify.io.to(`store:${request.storeId}`).emit('seat:deleted', Number(id))
    return reply.status(204).send()
  })
}

export default seatsRoutes
