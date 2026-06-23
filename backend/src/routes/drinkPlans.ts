import type { FastifyPluginAsync } from 'fastify'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { requireAdmin } from '../plugins/auth.js'
import { toDrinkPlan } from '../lib/mappers.js'

const createBodySchema = {
  type: 'object',
  required: ['name', 'menuItemIds'],
  properties: {
    name: { type: 'string', minLength: 1 },
    menuItemIds: { type: 'array', items: { type: 'integer', minimum: 1 } },
  },
  additionalProperties: false,
} as const

const updateBodySchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    menuItemIds: { type: 'array', items: { type: 'integer', minimum: 1 } },
  },
  additionalProperties: false,
} as const

const drinkPlansRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => {
    const plans = await prisma.drinkPlan.findMany({ include: { items: true } })
    return plans.map(toDrinkPlan)
  })

  fastify.post('/', { schema: { body: createBodySchema }, preHandler: requireAdmin }, async (request, reply) => {
    const body = request.body as { name: string; menuItemIds: number[] }
    const plan = await prisma.drinkPlan.create({
      data: {
        name: body.name,
        items: { create: body.menuItemIds.map(menuItemId => ({ menuItemId })) },
      },
      include: { items: true },
    })
    return reply.status(201).send(toDrinkPlan(plan))
  })

  fastify.put('/:id', { schema: { body: updateBodySchema }, preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as Partial<{ name: string; menuItemIds: number[] }>
    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = body.name
    if (body.menuItemIds !== undefined) {
      data.items = {
        deleteMany: {},
        create: body.menuItemIds.map(menuItemId => ({ menuItemId })),
      }
    }
    try {
      const plan = await prisma.drinkPlan.update({
        where: { id: Number(id) },
        data,
        include: { items: true },
      })
      return toDrinkPlan(plan)
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        return reply.status(404).send({ error: 'Not found' })
      }
      throw e
    }
  })

  fastify.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await prisma.drinkPlan.delete({ where: { id: Number(id) } })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2025') return reply.status(404).send({ error: 'Not found' })
        if (e.code === 'P2003') return reply.status(409).send({ error: '使用中の飲み放題プランは削除できません' })
      }
      throw e
    }
    return reply.status(204).send()
  })
}

export default drinkPlansRoutes
