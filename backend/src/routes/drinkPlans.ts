import type { FastifyPluginAsync } from 'fastify'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { requireAdmin } from '../plugins/auth.js'
import { ErrorCodes, sendError } from '../lib/errors.js'
import { toDrinkPlan } from '../lib/mappers.js'

const createBodySchema = {
  type: 'object',
  required: ['name', 'price', 'menuItemIds'],
  properties: {
    name: { type: 'string', minLength: 1 },
    price: { type: 'integer', minimum: 0 },
    menuItemIds: { type: 'array', items: { type: 'integer', minimum: 1 } },
  },
  additionalProperties: false,
} as const

const updateBodySchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    price: { type: 'integer', minimum: 0 },
    menuItemIds: { type: 'array', items: { type: 'integer', minimum: 1 } },
  },
  additionalProperties: false,
} as const

async function ownsMenuItems(storeId: number, menuItemIds: number[]): Promise<boolean> {
  const ids = [...new Set(menuItemIds)]
  if (ids.length === 0) return true
  const owned = await prisma.menuItem.count({ where: { id: { in: ids }, storeId } })
  return owned === ids.length
}

const drinkPlansRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request) => {
    const plans = await prisma.drinkPlan.findMany({ where: { storeId: request.storeId }, include: { items: true } })
    return plans.map(toDrinkPlan)
  })

  fastify.post('/', { schema: { body: createBodySchema }, preHandler: requireAdmin }, async (request, reply) => {
    const body = request.body as { name: string; price: number; menuItemIds: number[] }
    if (!(await ownsMenuItems(request.storeId, body.menuItemIds))) {
      return sendError(reply, 422, ErrorCodes.DrinkPlans.MenuNotFound, 'メニューが見つかりません')
    }
    const plan = await prisma.drinkPlan.create({
      data: {
        name: body.name,
        price: body.price,
        items: { create: body.menuItemIds.map(menuItemId => ({ menuItemId })) },
        storeId: request.storeId,
      },
      include: { items: true },
    })
    const result = toDrinkPlan(plan)
    fastify.io.to(`store:${request.storeId}`).emit('drinkPlan:created', result)
    return reply.status(201).send(result)
  })

  fastify.put('/:id', { schema: { body: updateBodySchema }, preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as Partial<{ name: string; price: number; menuItemIds: number[] }>
    const existing = await prisma.drinkPlan.findFirst({ where: { id: Number(id), storeId: request.storeId } })
    if (!existing) return sendError(reply, 404, ErrorCodes.DrinkPlans.NotFound, '飲み放題プランが見つかりません')
    if (body.menuItemIds !== undefined && !(await ownsMenuItems(request.storeId, body.menuItemIds))) {
      return sendError(reply, 422, ErrorCodes.DrinkPlans.MenuNotFound, 'メニューが見つかりません')
    }
    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = body.name
    if (body.price !== undefined) data.price = body.price
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
    const result = toDrinkPlan(plan)
    fastify.io.to(`store:${request.storeId}`).emit('drinkPlan:updated', result)
    return result
  })

  fastify.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const drinkPlanId = Number(id)
    let txResult
    try {
      txResult = await prisma.$transaction(async (tx) => {
        const existing = await tx.drinkPlan.findFirst({ where: { id: drinkPlanId, storeId: request.storeId } })
        if (!existing) return { err: 'not_found' as const }
        const referencedCourse = await tx.course.findFirst({ where: { drinkPlanId } })
        if (referencedCourse) return { err: 'referenced_course' as const }
        const activeGroup = await tx.group.findFirst({
          where: { drinkPlanId, status: { in: ['active', 'bill_requested'] } },
        })
        if (activeGroup) return { err: 'in_use' as const }
        await tx.drinkPlan.delete({ where: { id: drinkPlanId } })
        return { ok: true as const }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034') {
        return sendError(reply, 409, ErrorCodes.DrinkPlans.InUse, '使用中の飲み放題プランは削除できません')
      }
      throw e
    }
    if ('err' in txResult) {
      if (txResult.err === 'not_found') return sendError(reply, 404, ErrorCodes.DrinkPlans.NotFound, '飲み放題プランが見つかりません')
      if (txResult.err === 'referenced_course') return sendError(reply, 409, ErrorCodes.DrinkPlans.ReferencedCourse, 'コースから参照されているため削除できません')
      return sendError(reply, 409, ErrorCodes.DrinkPlans.InUse, '使用中の飲み放題プランは削除できません')
    }
    fastify.io.to(`store:${request.storeId}`).emit('drinkPlan:deleted', drinkPlanId)
    return reply.status(204).send()
  })
}

export default drinkPlansRoutes
