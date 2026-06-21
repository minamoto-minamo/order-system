import type { FastifyPluginAsync } from 'fastify'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { requireAdmin } from '../plugins/auth.js'

const createBodySchema = {
  type: 'object',
  required: ['name', 'price', 'categoryId', 'subCategoryId'],
  properties: {
    name: { type: 'string', minLength: 1 },
    price: { type: 'integer', minimum: 0 },
    categoryId: { type: 'integer', minimum: 1 },
    subCategoryId: { type: 'integer', minimum: 1 },
    soldOut: { type: 'boolean' },
    takeout: { type: 'string', enum: ['dine_in', 'both', 'takeout'] },
  },
  additionalProperties: false,
} as const

const updateBodySchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    price: { type: 'integer', minimum: 0 },
    categoryId: { type: 'integer', minimum: 1 },
    subCategoryId: { type: 'integer', minimum: 1 },
    soldOut: { type: 'boolean' },
    takeout: { type: 'string', enum: ['dine_in', 'both', 'takeout'] },
  },
  additionalProperties: false,
} as const

const menusRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request) => {
    const { categoryId, subCategoryId, takeout, soldOut } = request.query as {
      categoryId?: string; subCategoryId?: string; takeout?: string; soldOut?: string;
    }
    const where: Record<string, unknown> = {}
    if (categoryId) where.categoryId = Number(categoryId)
    if (subCategoryId) where.subCategoryId = Number(subCategoryId)
    if (takeout) where.takeout = takeout
    if (soldOut !== undefined) where.soldOut = soldOut === 'true'
    return prisma.menuItem.findMany({ where })
  })

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const item = await prisma.menuItem.findUnique({ where: { id: Number(id) } })
    if (!item) return reply.status(404).send({ error: 'Not found' })
    return item
  })

  fastify.post('/', { schema: { body: createBodySchema }, preHandler: requireAdmin }, async (request, reply) => {
    const body = request.body as {
      name: string; price: number; categoryId: number; subCategoryId: number;
      soldOut?: boolean; takeout?: string;
    }
    const item = await prisma.menuItem.create({
      data: {
        name: body.name,
        price: body.price,
        categoryId: body.categoryId,
        subCategoryId: body.subCategoryId,
        soldOut: body.soldOut ?? false,
        takeout: (body.takeout as 'dine_in' | 'both' | 'takeout') ?? 'dine_in',
      },
    })
    return reply.status(201).send(item)
  })

  fastify.put('/:id', { schema: { body: updateBodySchema }, preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as Partial<{
      name: string; price: number; categoryId: number; subCategoryId: number;
      soldOut: boolean; takeout: string;
    }>

    try {
      const current = await prisma.menuItem.findUnique({ where: { id: Number(id) } })
      if (!current) return reply.status(404).send({ error: 'Not found' })

      const item = await prisma.menuItem.update({
        where: { id: Number(id) },
        data: {
          name: body.name,
          price: body.price,
          categoryId: body.categoryId,
          subCategoryId: body.subCategoryId,
          soldOut: body.soldOut,
          takeout: body.takeout as 'dine_in' | 'both' | 'takeout' | undefined,
        },
      })

      if (body.soldOut !== undefined && body.soldOut !== current.soldOut) {
        fastify.io.emit('menu:soldout', item.id, item.soldOut)
      }

      return item
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
      await prisma.menuItem.delete({ where: { id: Number(id) } })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2025') return reply.status(404).send({ error: 'Not found' })
        if (e.code === 'P2003') return reply.status(409).send({ error: '注文済みのメニューは削除できません' })
      }
      throw e
    }
    return reply.status(204).send()
  })
}

export default menusRoutes
