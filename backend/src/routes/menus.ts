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
    sort: { type: 'integer', minimum: 0 },
  },
  additionalProperties: false,
} as const

const sortBodySchema = {
  type: 'object',
  required: ['ids'],
  properties: {
    ids: { type: 'array', items: { type: 'integer' } },
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
    // クエリパラメータは常に文字列なので boolean に変換する
    if (soldOut !== undefined) where.soldOut = soldOut === 'true'
    return prisma.menuItem.findMany({ where, orderBy: [{ sort: 'asc' }, { id: 'asc' }] })
  })

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const item = await prisma.menuItem.findUnique({ where: { id: Number(id) } })
    if (!item) return reply.status(404).send({ error: 'メニューが見つかりません' })
    return item
  })

  fastify.patch('/sort', { schema: { body: sortBodySchema }, preHandler: requireAdmin }, async (request, reply) => {
    const { ids } = request.body as { ids: number[] }
    await prisma.$transaction(ids.map((id, index) =>
      prisma.menuItem.update({ where: { id }, data: { sort: index } })
    ))
    const updated = await prisma.menuItem.findMany({ where: { id: { in: ids } } })
    for (const item of updated) {
      fastify.io.to('staff').emit('menu:updated', item)
    }
    return reply.status(204).send()
  })

  fastify.post('/', { schema: { body: createBodySchema }, preHandler: requireAdmin }, async (request, reply) => {
    const body = request.body as {
      name: string; price: number; categoryId: number; subCategoryId: number;
      soldOut?: boolean; takeout?: string; sort?: number;
    }
    const subCat = await prisma.subCategory.findUnique({ where: { id: body.subCategoryId } })
    if (!subCat) return reply.status(422).send({ error: 'サブカテゴリが見つかりません' })
    if (subCat.categoryId !== body.categoryId) {
      return reply.status(422).send({ error: 'サブカテゴリがカテゴリと一致しません' })
    }
    const item = await prisma.menuItem.create({
      data: {
        name: body.name,
        price: body.price,
        categoryId: body.categoryId,
        subCategoryId: body.subCategoryId,
        soldOut: body.soldOut ?? false,
        takeout: (body.takeout as 'dine_in' | 'both' | 'takeout') ?? 'dine_in',
        sort: body.sort ?? 0,
      },
    })
    fastify.io.to('staff').emit('menu:created', item)
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
      if (!current) return reply.status(404).send({ error: 'メニューが見つかりません' })

      const targetCategoryId = body.categoryId ?? current.categoryId
      if (body.subCategoryId !== undefined) {
        const subCat = await prisma.subCategory.findUnique({ where: { id: body.subCategoryId } })
        if (!subCat) return reply.status(422).send({ error: 'サブカテゴリが見つかりません' })
        if (subCat.categoryId !== targetCategoryId) {
          return reply.status(422).send({ error: 'サブカテゴリがカテゴリと一致しません' })
        }
      }

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
        fastify.io.to('staff').emit('menu:soldout', item.id, item.soldOut)
      }
      fastify.io.to('staff').emit('menu:updated', item)

      return item
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        return reply.status(404).send({ error: 'メニューが見つかりません' })
      }
      throw e
    }
  })

  fastify.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const menuItemId = Number(id)

    try {
      const deleted = await prisma.$transaction(async (tx) => {
        const activeOrderCount = await tx.orderItem.count({
          where: { menuItemId, status: { in: ['pending', 'ready'] } },
        })
        if (activeOrderCount > 0) return null
        return tx.menuItem.delete({ where: { id: menuItemId } })
      })
      if (deleted === null) return reply.status(409).send({ error: '処理中の注文があるため削除できません' })
      fastify.io.to('staff').emit('menu:deleted', menuItemId)
      return reply.status(204).send()
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        return reply.status(404).send({ error: 'メニューが見つかりません' })
      }
      throw e
    }
  })
}

export default menusRoutes
