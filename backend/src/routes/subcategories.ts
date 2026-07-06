import type { FastifyPluginAsync } from 'fastify'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { requireAdmin } from '../plugins/auth.js'
import { ErrorCodes, sendError } from '../lib/errors.js'

const createBodySchema = {
  type: 'object',
  required: ['name', 'categoryId'],
  properties: {
    name: { type: 'string', minLength: 1 },
    categoryId: { type: 'integer', minimum: 1 },
    sort: { type: 'integer', minimum: 0 },
  },
  additionalProperties: false,
} as const

const updateBodySchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    categoryId: { type: 'integer', minimum: 1 },
    sort: { type: 'integer', minimum: 0 },
  },
  additionalProperties: false,
} as const

const subcategoriesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request) => {
    const { categoryId } = request.query as { categoryId?: string }
    const where: Prisma.SubCategoryWhereInput = { storeId: request.storeId }
    if (categoryId) where.categoryId = Number(categoryId)
    return prisma.subCategory.findMany({ where, orderBy: { sort: 'asc' } })
  })

  fastify.post('/', { schema: { body: createBodySchema }, preHandler: requireAdmin }, async (request, reply) => {
    const body = request.body as { name: string; categoryId: number; sort?: number }
    const sub = await prisma.subCategory.create({
      data: { name: body.name, categoryId: body.categoryId, sort: body.sort ?? 0, storeId: request.storeId },
    })
    return reply.status(201).send(sub)
  })

  fastify.put('/:id', { schema: { body: updateBodySchema }, preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as Partial<{ name: string; categoryId: number; sort: number }>
    const existing = await prisma.subCategory.findFirst({ where: { id: Number(id), storeId: request.storeId } })
    if (!existing) return sendError(reply, 404, ErrorCodes.Subcategories.NotFound, 'サブカテゴリが見つかりません')
    return prisma.subCategory.update({
      where: { id: Number(id) },
      data: { name: body.name, categoryId: body.categoryId, sort: body.sort },
    })
  })

  fastify.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = await prisma.subCategory.findFirst({ where: { id: Number(id), storeId: request.storeId } })
    if (!existing) return sendError(reply, 404, ErrorCodes.Subcategories.NotFound, 'サブカテゴリが見つかりません')
    try {
      await prisma.subCategory.delete({ where: { id: Number(id) } })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        return sendError(reply, 409, ErrorCodes.Subcategories.InUse, '使用中のサブカテゴリは削除できません')
      }
      throw e
    }
    return reply.status(204).send()
  })
}

export default subcategoriesRoutes
