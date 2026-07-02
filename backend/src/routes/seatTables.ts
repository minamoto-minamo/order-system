import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { requireAdmin } from '../plugins/auth.js'

const createBodySchema = {
  type: 'object',
  required: ['label', 'x', 'y', 'w', 'h'],
  properties: {
    label: { type: 'string', minLength: 1 },
    x: { type: 'number', minimum: 0 },
    y: { type: 'number', minimum: 0 },
    w: { type: 'number', minimum: 1 },
    h: { type: 'number', minimum: 1 },
  },
  additionalProperties: false,
} as const

const updateBodySchema = {
  type: 'object',
  properties: {
    label: { type: 'string', minLength: 1 },
    x: { type: 'number', minimum: 0 },
    y: { type: 'number', minimum: 0 },
    w: { type: 'number', minimum: 1 },
    h: { type: 'number', minimum: 1 },
  },
  additionalProperties: false,
} as const

const seatTablesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request) => {
    return prisma.seatTable.findMany({ where: { storeId: request.storeId } })
  })

  fastify.post('/', { schema: { body: createBodySchema }, preHandler: requireAdmin }, async (request, reply) => {
    const body = request.body as { label: string; x: number; y: number; w: number; h: number }
    const table = await prisma.seatTable.create({ data: { ...body, storeId: request.storeId } })
    return reply.status(201).send(table)
  })

  fastify.put('/:id', { schema: { body: updateBodySchema }, preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as Partial<{ label: string; x: number; y: number; w: number; h: number }>
    const existing = await prisma.seatTable.findFirst({ where: { id: Number(id), storeId: request.storeId } })
    if (!existing) return reply.status(404).send({ error: 'テーブルが見つかりません' })
    return prisma.seatTable.update({ where: { id: Number(id) }, data: body })
  })

  fastify.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = await prisma.seatTable.findFirst({ where: { id: Number(id), storeId: request.storeId } })
    if (!existing) return reply.status(404).send({ error: 'テーブルが見つかりません' })
    await prisma.seatTable.delete({ where: { id: Number(id) } })
    return reply.status(204).send()
  })
}

export default seatTablesRoutes
