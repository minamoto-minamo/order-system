import { Prisma } from '@prisma/client'
import type { FastifyPluginAsync } from 'fastify'
import { ErrorCodes, sendError } from '../lib/errors.js'
import { toCourse } from '../lib/mappers.js'
import { prisma } from '../lib/prisma.js'
import { requireAdmin } from '../plugins/auth.js'

const foodItemSchema = {
  type: 'object',
  required: ['menuItemId', 'qty'],
  properties: {
    menuItemId: { type: 'integer', minimum: 1 },
    qty: { type: 'integer', minimum: 1 },
  },
  additionalProperties: false,
} as const

const createBodySchema = {
  type: 'object',
  required: ['name', 'price', 'foodItems'],
  properties: {
    name: { type: 'string', minLength: 1 },
    price: { type: 'integer', minimum: 0 },
    drinkPlanId: { type: ['integer', 'null'] },
    foodItems: { type: 'array', items: foodItemSchema },
  },
  additionalProperties: false,
} as const

const updateBodySchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    price: { type: 'integer', minimum: 0 },
    drinkPlanId: { type: ['integer', 'null'] },
    foodItems: { type: 'array', items: foodItemSchema },
  },
  additionalProperties: false,
} as const

type DeleteCourseTxResult = { ok: true } | { err: 'not_found' | 'in_use' }

async function ownsMenuItems(storeId: number, menuItemIds: number[]): Promise<boolean> {
  const ids = [...new Set(menuItemIds)]
  if (ids.length === 0) return true
  const owned = await prisma.menuItem.count({ where: { id: { in: ids }, storeId } })
  return owned === ids.length
}

async function ownsDrinkPlan(storeId: number, drinkPlanId: number): Promise<boolean> {
  const plan = await prisma.drinkPlan.findFirst({ where: { id: drinkPlanId, storeId } })
  return plan !== null
}

const coursesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request) => {
    const courses = await prisma.course.findMany({
      where: { storeId: request.storeId },
      include: { foodItems: true },
    })
    return courses.map(toCourse)
  })

  fastify.post(
    '/',
    { schema: { body: createBodySchema }, preHandler: requireAdmin },
    async (request, reply) => {
      const body = request.body as {
        name: string
        price: number
        foodItems: { menuItemId: number; qty: number }[]
        drinkPlanId?: number | null
      }
      if (
        !(await ownsMenuItems(
          request.storeId,
          body.foodItems.map((f) => f.menuItemId),
        ))
      ) {
        return sendError(reply, 422, ErrorCodes.Courses.MenuNotFound, 'メニューが見つかりません')
      }
      if (body.drinkPlanId != null && !(await ownsDrinkPlan(request.storeId, body.drinkPlanId))) {
        return sendError(
          reply,
          422,
          ErrorCodes.Courses.DrinkPlanNotFound,
          '飲み放題プランが見つかりません',
        )
      }
      const course = await prisma.course.create({
        data: {
          name: body.name,
          price: body.price,
          drinkPlanId: body.drinkPlanId ?? null,
          foodItems: {
            create: body.foodItems.map((f) => ({ menuItemId: f.menuItemId, qty: f.qty })),
          },
          storeId: request.storeId,
        },
        include: { foodItems: true },
      })
      const result = toCourse(course)
      fastify.io.to(`store:${request.storeId}`).emit('course:created', result)
      return reply.status(201).send(result)
    },
  )

  fastify.put(
    '/:id',
    { schema: { body: updateBodySchema }, preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const body = request.body as Partial<{
        name: string
        price: number
        foodItems: { menuItemId: number; qty: number }[]
        drinkPlanId: number | null
      }>
      const existing = await prisma.course.findFirst({
        where: { id: Number(id), storeId: request.storeId },
      })
      if (!existing)
        return sendError(reply, 404, ErrorCodes.Courses.NotFound, 'コースが見つかりません')
      if (body.drinkPlanId != null && !(await ownsDrinkPlan(request.storeId, body.drinkPlanId))) {
        return sendError(
          reply,
          422,
          ErrorCodes.Courses.DrinkPlanNotFound,
          '飲み放題プランが見つかりません',
        )
      }
      if (
        body.foodItems !== undefined &&
        !(await ownsMenuItems(
          request.storeId,
          body.foodItems.map((f) => f.menuItemId),
        ))
      ) {
        return sendError(reply, 422, ErrorCodes.Courses.MenuNotFound, 'メニューが見つかりません')
      }
      const data: Record<string, unknown> = {}
      if (body.name !== undefined) data.name = body.name
      if (body.price !== undefined) data.price = body.price
      if (body.drinkPlanId !== undefined) data.drinkPlanId = body.drinkPlanId
      if (body.foodItems !== undefined) {
        // 差分更新ではなく全置換。foodItems の順序管理を簡略化するための設計
        data.foodItems = {
          deleteMany: {},
          create: body.foodItems.map((f) => ({ menuItemId: f.menuItemId, qty: f.qty })),
        }
      }
      const course = await prisma.course.update({
        where: { id: Number(id) },
        data,
        include: { foodItems: true },
      })
      const result = toCourse(course)
      fastify.io.to(`store:${request.storeId}`).emit('course:updated', result)
      return result
    },
  )

  fastify.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const courseId = Number(id)
    let txResult: DeleteCourseTxResult
    try {
      txResult = await prisma.$transaction(
        async (tx) => {
          const existing = await tx.course.findFirst({
            where: { id: courseId, storeId: request.storeId },
          })
          if (!existing) return { err: 'not_found' as const }
          const activeGroup = await tx.group.findFirst({
            where: { courseId, status: { in: ['active', 'bill_requested'] } },
          })
          if (activeGroup) return { err: 'in_use' as const }
          const referencedOrderItemCount = await tx.orderItem.count({
            where: { storeId: request.storeId, courseId },
          })
          if (referencedOrderItemCount > 0) {
            fastify.log.warn(
              { courseId, storeId: request.storeId, referencedOrderItemCount },
              'コース削除により過去の OrderItem.courseId が null 化されます',
            )
          }
          await tx.course.delete({ where: { id: courseId } })
          return { ok: true as const }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034') {
        return sendError(reply, 409, ErrorCodes.Courses.InUse, '使用中のコースは削除できません')
      }
      throw e
    }
    if ('err' in txResult) {
      if (txResult.err === 'not_found')
        return sendError(reply, 404, ErrorCodes.Courses.NotFound, 'コースが見つかりません')
      return sendError(reply, 409, ErrorCodes.Courses.InUse, '使用中のコースは削除できません')
    }
    fastify.io.to(`store:${request.storeId}`).emit('course:deleted', courseId)
    return reply.status(204).send()
  })
}

export default coursesRoutes
