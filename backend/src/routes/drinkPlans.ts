import type { FastifyPluginAsync } from 'fastify'
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
  fastify.get('/', async (request) => {
    const plans = await prisma.drinkPlan.findMany({ where: { storeId: request.storeId }, include: { items: true } })
    return plans.map(toDrinkPlan)
  })

  fastify.post('/', { schema: { body: createBodySchema }, preHandler: requireAdmin }, async (request, reply) => {
    const body = request.body as { name: string; menuItemIds: number[] }
    const plan = await prisma.drinkPlan.create({
      data: {
        name: body.name,
        items: { create: body.menuItemIds.map(menuItemId => ({ menuItemId })) },
        storeId: request.storeId,
      },
      include: { items: true },
    })
    return reply.status(201).send(toDrinkPlan(plan))
  })

  fastify.put('/:id', { schema: { body: updateBodySchema }, preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as Partial<{ name: string; menuItemIds: number[] }>
    const existing = await prisma.drinkPlan.findFirst({ where: { id: Number(id), storeId: request.storeId } })
    if (!existing) return reply.status(404).send({ error: '飲み放題プランが見つかりません' })
    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = body.name
    if (body.menuItemIds !== undefined) {
      // 差分更新ではなく全置換。courses.ts の foodItems と同じ戦略
      data.items = {
        deleteMany: {},
        create: body.menuItemIds.map(menuItemId => ({ menuItemId })),
      }
    }
    const plan = await prisma.drinkPlan.update({
      where: { id: Number(id) },
      data,
      include: { items: true },
    })
    return toDrinkPlan(plan)
  })

  fastify.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const drinkPlanId = Number(id)
    const existing = await prisma.drinkPlan.findFirst({ where: { id: drinkPlanId, storeId: request.storeId } })
    if (!existing) return reply.status(404).send({ error: '飲み放題プランが見つかりません' })
    const referencedCourse = await prisma.course.findFirst({ where: { drinkPlanId } })
    if (referencedCourse) return reply.status(409).send({ error: 'コースから参照されているため削除できません' })
    const activeGroup = await prisma.group.findFirst({
      where: { drinkPlanId, status: { in: ['active', 'bill_requested'] } },
    })
    if (activeGroup) return reply.status(409).send({ error: '使用中の飲み放題プランは削除できません' })
    await prisma.drinkPlan.delete({ where: { id: drinkPlanId } })
    return reply.status(204).send()
  })
}

export default drinkPlansRoutes
