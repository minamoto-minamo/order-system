import type { FastifyPluginAsync } from 'fastify'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { requireAdmin } from '../plugins/auth.js'

const createBodySchema = {
  type: 'object',
  required: ['name'],
  properties: {
    name: { type: 'string', minLength: 1 },
    sort: { type: 'integer', minimum: 0 },
  },
  additionalProperties: false,
} as const

const updateBodySchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    sort: { type: 'integer', minimum: 0 },
  },
  additionalProperties: false,
} as const

const categoriesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => {
    return prisma.category.findMany({ orderBy: { sort: 'asc' } })
  })

  fastify.post('/', { schema: { body: createBodySchema }, preHandler: requireAdmin }, async (request, reply) => {
    const body = request.body as { name: string; sort?: number }
    const category = await prisma.category.create({
      data: { name: body.name, sort: body.sort ?? 0 },
    })
    return reply.status(201).send(category)
  })

  fastify.put('/:id', { schema: { body: updateBodySchema }, preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as Partial<{ name: string; sort: number }>
    try {
      const category = await prisma.category.update({
        where: { id: Number(id) },
        data: { name: body.name, sort: body.sort },
      })
      return category
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
      await prisma.category.delete({ where: { id: Number(id) } })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2025') return reply.status(404).send({ error: 'Not found' })
        if (e.code === 'P2003') return reply.status(409).send({ error: '使用中のカテゴリは削除できません' })
      }
      throw e
    }
    return reply.status(204).send()
  })
}

export default categoriesRoutes
