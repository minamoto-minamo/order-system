import type { FastifyPluginAsync } from 'fastify'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { requireAdmin } from '../plugins/auth.js'

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
    const where = categoryId ? { categoryId: Number(categoryId) } : {}
    return prisma.subCategory.findMany({ where, orderBy: { sort: 'asc' } })
  })

  fastify.post('/', { schema: { body: createBodySchema }, preHandler: requireAdmin }, async (request, reply) => {
    const body = request.body as { name: string; categoryId: number; sort?: number }
    const sub = await prisma.subCategory.create({
      data: { name: body.name, categoryId: body.categoryId, sort: body.sort ?? 0 },
    })
    return reply.status(201).send(sub)
  })

  fastify.put('/:id', { schema: { body: updateBodySchema }, preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as Partial<{ name: string; categoryId: number; sort: number }>
    try {
      const sub = await prisma.subCategory.update({
        where: { id: Number(id) },
        data: { name: body.name, categoryId: body.categoryId, sort: body.sort },
      })
      return sub
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        return reply.status(404).send({ error: 'サブカテゴリが見つかりません' })
      }
      throw e
    }
  })

  fastify.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await prisma.subCategory.delete({ where: { id: Number(id) } })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2025') return reply.status(404).send({ error: 'サブカテゴリが見つかりません' })
        if (e.code === 'P2003') return reply.status(409).send({ error: '使用中のサブカテゴリは削除できません' })
      }
      throw e
    }
    return reply.status(204).send()
  })
}

export default subcategoriesRoutes
