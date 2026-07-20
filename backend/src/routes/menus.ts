import { Prisma } from '@prisma/client'
import type { FastifyPluginAsync } from 'fastify'
import { ErrorCodes, sendError } from '../lib/errors.js'
import { toMenuItem } from '../lib/mappers.js'
import { prisma } from '../lib/prisma.js'
import { requireAdmin } from '../plugins/auth.js'

const menuItemInclude = {
  optionGroups: {
    orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    include: { choices: { orderBy: [{ sort: 'asc' }, { id: 'asc' }] } },
  },
} satisfies Prisma.MenuItemInclude

const optionChoiceSchema = {
  type: 'object',
  required: ['name', 'extraPrice', 'sort'],
  properties: {
    name: { type: 'string', minLength: 1 },
    extraPrice: { type: 'integer' },
    sort: { type: 'integer', minimum: 0 },
  },
  additionalProperties: false,
} as const

const optionGroupSchema = {
  type: 'object',
  required: ['name', 'required', 'sort', 'choices'],
  properties: {
    name: { type: 'string', minLength: 1 },
    required: { type: 'boolean' },
    sort: { type: 'integer', minimum: 0 },
    choices: { type: 'array', items: optionChoiceSchema },
  },
  additionalProperties: false,
} as const

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
    optionGroups: { type: 'array', items: optionGroupSchema },
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
    subCategoryId: { anyOf: [{ type: 'integer', minimum: 1 }, { type: 'null' }] },
    soldOut: { type: 'boolean' },
    takeout: { type: 'string', enum: ['dine_in', 'both', 'takeout'] },
    optionGroups: { type: 'array', items: optionGroupSchema },
  },
  additionalProperties: false,
} as const

const menusRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request) => {
    const { categoryId, subCategoryId, takeout, soldOut } = request.query as {
      categoryId?: string
      subCategoryId?: string
      takeout?: string
      soldOut?: string
    }
    const where: Record<string, unknown> = { storeId: request.storeId }
    if (categoryId) where.categoryId = Number(categoryId)
    if (subCategoryId) where.subCategoryId = Number(subCategoryId)
    if (takeout) where.takeout = takeout
    // クエリパラメータは常に文字列なので boolean に変換する
    if (soldOut !== undefined) where.soldOut = soldOut === 'true'
    const items = await prisma.menuItem.findMany({
      where,
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
      include: menuItemInclude,
    })
    return items.map(toMenuItem)
  })

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const item = await prisma.menuItem.findFirst({
      where: { id: Number(id), storeId: request.storeId },
      include: menuItemInclude,
    })
    if (!item) return sendError(reply, 404, ErrorCodes.Menus.NotFound, 'メニューが見つかりません')
    return toMenuItem(item)
  })

  fastify.patch(
    '/sort',
    { schema: { body: sortBodySchema }, preHandler: requireAdmin },
    async (request, reply) => {
      const { ids } = request.body as { ids: number[] }
      const owned = await prisma.menuItem.findMany({
        where: { id: { in: ids }, storeId: request.storeId },
        select: { id: true },
      })
      const ownedIds = new Set(owned.map((o) => o.id))
      const validIds = ids.filter((id) => ownedIds.has(id))
      await prisma.$transaction(
        validIds.map((id, index) =>
          prisma.menuItem.update({ where: { id }, data: { sort: index } }),
        ),
      )
      const updated = await prisma.menuItem.findMany({
        where: { id: { in: validIds } },
        include: menuItemInclude,
      })
      for (const item of updated) {
        fastify.io.to(`store:${request.storeId}`).emit('menu:updated', toMenuItem(item))
      }
      return reply.status(204).send()
    },
  )

  fastify.post(
    '/',
    { schema: { body: createBodySchema }, preHandler: requireAdmin },
    async (request, reply) => {
      const body = request.body as {
        name: string
        price: number
        categoryId: number
        subCategoryId: number
        soldOut?: boolean
        takeout?: string
        sort?: number
        optionGroups?: {
          name: string
          required: boolean
          sort: number
          choices: { name: string; extraPrice: number; sort: number }[]
        }[]
      }
      const subCat = await prisma.subCategory.findFirst({
        where: { id: body.subCategoryId, storeId: request.storeId },
      })
      if (!subCat)
        return sendError(
          reply,
          422,
          ErrorCodes.Menus.SubCategoryNotFound,
          'サブカテゴリが見つかりません',
        )
      if (subCat.categoryId !== body.categoryId) {
        return sendError(
          reply,
          422,
          ErrorCodes.Menus.SubCategoryMismatch,
          'サブカテゴリがカテゴリと一致しません',
        )
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
          storeId: request.storeId,
          optionGroups: body.optionGroups
            ? {
                create: body.optionGroups.map((group) => ({
                  name: group.name,
                  required: group.required,
                  sort: group.sort,
                  storeId: request.storeId,
                  choices: {
                    create: group.choices.map((choice) => ({
                      name: choice.name,
                      extraPrice: choice.extraPrice,
                      sort: choice.sort,
                    })),
                  },
                })),
              }
            : undefined,
        },
        include: menuItemInclude,
      })
      const result = toMenuItem(item)
      fastify.io.to(`store:${request.storeId}`).emit('menu:created', result)
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
        categoryId: number
        subCategoryId: number | null
        soldOut: boolean
        takeout: string
        optionGroups: {
          name: string
          required: boolean
          sort: number
          choices: { name: string; extraPrice: number; sort: number }[]
        }[]
      }>

      try {
        const current = await prisma.menuItem.findFirst({
          where: { id: Number(id), storeId: request.storeId },
        })
        if (!current)
          return sendError(reply, 404, ErrorCodes.Menus.NotFound, 'メニューが見つかりません')

        const targetCategoryId = body.categoryId ?? current.categoryId
        const targetSubCategoryId =
          body.subCategoryId !== undefined ? body.subCategoryId : current.subCategoryId
        if (
          (body.categoryId !== undefined || body.subCategoryId !== undefined) &&
          targetSubCategoryId !== null
        ) {
          const subCat = await prisma.subCategory.findFirst({
            where: { id: targetSubCategoryId, storeId: request.storeId },
          })
          if (!subCat)
            return sendError(
              reply,
              422,
              ErrorCodes.Menus.SubCategoryNotFound,
              'サブカテゴリが見つかりません',
            )
          if (subCat.categoryId !== targetCategoryId) {
            return sendError(
              reply,
              422,
              ErrorCodes.Menus.SubCategoryMismatch,
              'サブカテゴリがカテゴリと一致しません',
            )
          }
        }

        const item = await prisma.menuItem.update({
          where: { id: Number(id) },
          data: {
            name: body.name,
            price: body.price,
            categoryId: body.categoryId,
            subCategoryId: body.subCategoryId ?? undefined,
            soldOut: body.soldOut,
            takeout: body.takeout as 'dine_in' | 'both' | 'takeout' | undefined,
            optionGroups:
              body.optionGroups === undefined
                ? undefined
                : {
                    // 差分更新ではなく全置換。分類・選択肢の順序管理を簡略化するための設計
                    deleteMany: {},
                    create: body.optionGroups.map((group) => ({
                      name: group.name,
                      required: group.required,
                      sort: group.sort,
                      storeId: request.storeId,
                      choices: {
                        create: group.choices.map((choice) => ({
                          name: choice.name,
                          extraPrice: choice.extraPrice,
                          sort: choice.sort,
                        })),
                      },
                    })),
                  },
          },
          include: menuItemInclude,
        })

        const result = toMenuItem(item)

        if (body.soldOut !== undefined && body.soldOut !== current.soldOut) {
          fastify.io
            .to(`store:${request.storeId}`)
            .to(`customer-store:${request.storeId}`)
            .emit('menu:soldout', result.id, result.soldOut)
        }
        fastify.io.to(`store:${request.storeId}`).emit('menu:updated', result)

        return result
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
          return sendError(reply, 404, ErrorCodes.Menus.NotFound, 'メニューが見つかりません')
        }
        throw e
      }
    },
  )

  fastify.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const menuItemId = Number(id)

    const existing = await prisma.menuItem.findFirst({
      where: { id: menuItemId, storeId: request.storeId },
    })
    if (!existing)
      return sendError(reply, 404, ErrorCodes.Menus.NotFound, 'メニューが見つかりません')

    try {
      const deleted = await prisma.$transaction(async (tx) => {
        const activeOrderCount = await tx.orderItem.count({
          where: { menuItemId, status: { in: ['pending', 'ready'] } },
        })
        if (activeOrderCount > 0) return 'active_order' as const

        const courseCount = await tx.courseFoodItem.count({ where: { menuItemId } })
        if (courseCount > 0) return 'referenced_course' as const
        const drinkPlanCount = await tx.drinkPlanItem.count({ where: { menuItemId } })
        if (drinkPlanCount > 0) return 'referenced_drink_plan' as const

        return tx.menuItem.delete({ where: { id: menuItemId } })
      })
      if (deleted === 'active_order')
        return sendError(
          reply,
          409,
          ErrorCodes.Menus.ActiveOrderExists,
          '処理中の注文があるため削除できません',
        )
      if (deleted === 'referenced_course')
        return sendError(
          reply,
          409,
          ErrorCodes.Menus.ReferencedCourse,
          'コースに含まれているメニューは削除できません',
        )
      if (deleted === 'referenced_drink_plan')
        return sendError(
          reply,
          409,
          ErrorCodes.Menus.ReferencedDrinkPlan,
          '飲み放題プランに含まれているメニューは削除できません',
        )
      fastify.io.to(`store:${request.storeId}`).emit('menu:deleted', menuItemId)
      return reply.status(204).send()
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        return sendError(reply, 404, ErrorCodes.Menus.NotFound, 'メニューが見つかりません')
      }
      // アプリ層チェックと書き込みが競合した場合の最終防衛線（FK制約 onDelete: Restrict）
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        return sendError(
          reply,
          409,
          ErrorCodes.Menus.ReferencedByPlanOrCourse,
          'コースまたは飲み放題プランで使用されているため削除できません',
        )
      }
      throw e
    }
  })
}

export default menusRoutes
