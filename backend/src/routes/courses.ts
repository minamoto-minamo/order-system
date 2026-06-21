import type { FastifyPluginAsync } from 'fastify'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { requireAdmin } from '../plugins/auth.js'

function toCourse(c: {
  id: number; name: string; price: number; drinkPlanId: number | null;
  foodItems: { menuItemId: number; qty: number }[];
}) {
  return {
    id: c.id,
    name: c.name,
    price: c.price,
    drinkPlanId: c.drinkPlanId,
    foodItems: c.foodItems.map(f => ({ menuItemId: f.menuItemId, qty: f.qty })),
  }
}

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

const coursesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => {
    const courses = await prisma.course.findMany({ include: { foodItems: true } })
    return courses.map(toCourse)
  })

  fastify.post('/', { schema: { body: createBodySchema }, preHandler: requireAdmin }, async (request, reply) => {
    const body = request.body as {
      name: string; price: number;
      foodItems: { menuItemId: number; qty: number }[];
      drinkPlanId?: number | null;
    }
    const course = await prisma.course.create({
      data: {
        name: body.name,
        price: body.price,
        drinkPlanId: body.drinkPlanId ?? null,
        foodItems: { create: body.foodItems.map(f => ({ menuItemId: f.menuItemId, qty: f.qty })) },
      },
      include: { foodItems: true },
    })
    return reply.status(201).send(toCourse(course))
  })

  fastify.put('/:id', { schema: { body: updateBodySchema }, preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as Partial<{
      name: string; price: number;
      foodItems: { menuItemId: number; qty: number }[];
      drinkPlanId: number | null;
    }>
    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = body.name
    if (body.price !== undefined) data.price = body.price
    if (body.drinkPlanId !== undefined) data.drinkPlanId = body.drinkPlanId
    if (body.foodItems !== undefined) {
      data.foodItems = {
        deleteMany: {},
        create: body.foodItems.map(f => ({ menuItemId: f.menuItemId, qty: f.qty })),
      }
    }
    try {
      const course = await prisma.course.update({
        where: { id: Number(id) },
        data,
        include: { foodItems: true },
      })
      return toCourse(course)
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
      await prisma.course.delete({ where: { id: Number(id) } })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2025') return reply.status(404).send({ error: 'Not found' })
        if (e.code === 'P2003') return reply.status(409).send({ error: '使用中のコースは削除できません' })
      }
      throw e
    }
    return reply.status(204).send()
  })
}

export default coursesRoutes
