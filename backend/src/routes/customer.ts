import rateLimit from '@fastify/rate-limit'
import { Prisma } from '@prisma/client'
import type { FastifyPluginAsync } from 'fastify'
import { ErrorCodes, sendError } from '../lib/errors.js'
import { toGroup, toOrderItem } from '../lib/mappers.js'
import { prisma } from '../lib/prisma.js'
import { getTaxSettingOrThrow, SettingNotFoundError } from '../lib/taxSetting.js'

type TaxSetting = Awaited<ReturnType<typeof getTaxSettingOrThrow>>

class BillRequestNotAllowedError extends Error {}
class UnservedItemsExistError extends Error {
  constructor(public count: number) {
    super()
  }
}

const createOrderBodySchema = {
  type: 'object',
  required: ['groupId', 'items'],
  properties: {
    groupId: { type: 'string', minLength: 1 },
    items: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['menuItemId', 'qty'],
        properties: {
          menuItemId: { type: 'integer', minimum: 1 },
          qty: { type: 'integer', minimum: 1, maximum: 99 },
          selectedChoiceIds: { type: 'array', items: { type: 'integer', minimum: 1 } },
          selectedFrameChoiceIds: { type: 'array', items: { type: 'integer', minimum: 1 } },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
} as const

const customerRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(rateLimit, { max: 60, timeWindow: '1 minute' })

  fastify.get('/groups/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const group = await prisma.group.findFirst({
      where: { id, storeId: request.storeId },
      include: { seats: true },
    })
    if (!group)
      return sendError(reply, 404, ErrorCodes.Customer.GroupNotFound, 'テーブルが見つかりません')
    try {
      const setting = await getTaxSettingOrThrow(request.storeId)
      return toGroup(group, setting)
    } catch (e) {
      if (e instanceof SettingNotFoundError)
        return sendError(reply, 500, ErrorCodes.Common.SettingNotFound, '店舗設定が見つかりません')
      throw e
    }
  })

  fastify.get('/groups/:id/menus', async (request, reply) => {
    const { id } = request.params as { id: string }
    const group = await prisma.group.findFirst({ where: { id, storeId: request.storeId } })
    if (!group)
      return sendError(reply, 404, ErrorCodes.Customer.GroupNotFound, 'テーブルが見つかりません')

    const [menus, categories, subCategories, drinkPlanItems] = await Promise.all([
      prisma.menuItem.findMany({
        where: { soldOut: false, storeId: request.storeId },
        orderBy: { id: 'asc' },
        include: {
          optionGroups: {
            orderBy: [{ sort: 'asc' }, { id: 'asc' }],
            include: { choices: { orderBy: [{ sort: 'asc' }, { id: 'asc' }] } },
          },
          setFrames: {
            orderBy: [{ sort: 'asc' }, { id: 'asc' }],
            include: {
              choices: {
                orderBy: [{ sort: 'asc' }, { id: 'asc' }],
                include: { menuItem: { select: { name: true, price: true, soldOut: true } } },
              },
            },
          },
        },
      }),
      prisma.category.findMany({ where: { storeId: request.storeId }, orderBy: { sort: 'asc' } }),
      prisma.subCategory.findMany({
        where: { storeId: request.storeId },
        orderBy: { sort: 'asc' },
      }),
      group.drinkPlanId
        ? prisma.drinkPlanItem.findMany({
            where: { drinkPlanId: group.drinkPlanId },
            select: { menuItemId: true },
          })
        : Promise.resolve([]),
    ])

    return {
      menus: menus.map((m) => ({
        id: m.id,
        name: m.name,
        price: m.price,
        categoryId: m.categoryId,
        subCategoryId: m.subCategoryId,
        takeout: m.takeout,
        soldOut: m.soldOut,
        sort: m.sort,
        isSet: m.isSet,
        optionGroups: (m.optionGroups ?? []).map((group) => ({
          id: group.id,
          name: group.name,
          required: group.required,
          sort: group.sort,
          choices: group.choices.map((choice) => ({
            id: choice.id,
            name: choice.name,
            extraPrice: choice.extraPrice,
            sort: choice.sort,
          })),
        })),
        setFrames: (m.setFrames ?? []).map((frame) => ({
          id: frame.id,
          name: frame.name,
          sort: frame.sort,
          choices: frame.choices.map((choice) => ({
            id: choice.id,
            menuItemId: choice.menuItemId,
            name: choice.menuItem.name,
            price: choice.menuItem.price,
            soldOut: choice.menuItem.soldOut,
            sort: choice.sort,
          })),
        })),
      })),
      categories: categories.map((c) => ({ id: c.id, name: c.name, sort: c.sort })),
      subCategories: subCategories.map((s) => ({
        id: s.id,
        name: s.name,
        sort: s.sort,
        categoryId: s.categoryId,
      })),
      drinkPlanMenuItemIds: drinkPlanItems.map((item) => item.menuItemId),
    }
  })

  fastify.get('/groups/:id/orders', async (request, reply) => {
    const { id } = request.params as { id: string }
    const group = await prisma.group.findFirst({ where: { id, storeId: request.storeId } })
    if (!group)
      return sendError(reply, 404, ErrorCodes.Customer.GroupNotFound, 'テーブルが見つかりません')
    const orders = await prisma.orderItem.findMany({
      where: { groupId: id },
      orderBy: { orderedAt: 'asc' },
      include: { options: true },
    })
    return orders.map(toOrderItem)
  })

  fastify.post('/groups/:id/bill', async (request, reply) => {
    const { id } = request.params as { id: string }
    const group = await prisma.group.findFirst({ where: { id, storeId: request.storeId } })
    if (!group)
      return sendError(reply, 404, ErrorCodes.Customer.GroupNotFound, 'テーブルが見つかりません')
    let setting: TaxSetting
    try {
      setting = await getTaxSettingOrThrow(request.storeId)
    } catch (e) {
      if (e instanceof SettingNotFoundError)
        return sendError(reply, 500, ErrorCodes.Common.SettingNotFound, '店舗設定が見つかりません')
      throw e
    }
    try {
      await prisma.$transaction(
        async (tx) => {
          const current = await tx.group.findFirst({
            where: { id, storeId: request.storeId, status: 'active' },
          })
          if (!current) throw new BillRequestNotAllowedError()
          const unservedCount = await tx.orderItem.count({
            where: { groupId: id, status: { in: ['pending', 'ready'] } },
          })
          if (unservedCount > 0) throw new UnservedItemsExistError(unservedCount)
          await tx.group.update({ where: { id }, data: { status: 'bill_requested' } })
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
    } catch (e) {
      if (e instanceof BillRequestNotAllowedError)
        return sendError(
          reply,
          400,
          ErrorCodes.Customer.BillRequestNotAllowed,
          '会計を依頼できない状態です',
        )
      if (e instanceof UnservedItemsExistError)
        return sendError(
          reply,
          409,
          ErrorCodes.Customer.UnservedItemsExist,
          '未提供の注文が残っているため会計を依頼できません',
          { count: e.count },
        )
      throw e
    }
    const updated = await prisma.group.findUniqueOrThrow({
      where: { id },
      include: { seats: true },
    })
    fastify.io
      .to(`store:${request.storeId}`)
      .to(`group:${id}`)
      .emit('group:updated', toGroup(updated, setting))
    return reply.status(204).send()
  })

  fastify.get('/settings', async (request) => {
    const s = await prisma.setting.findUnique({ where: { storeId: request.storeId } })
    return { taxRateInHouse: s?.taxRateInHouse ?? 10, taxRateTakeout: s?.taxRateTakeout ?? 8 }
  })

  fastify.post('/groups/:id/call-staff', async (request, reply) => {
    const { id } = request.params as { id: string }
    const group = await prisma.group.findFirst({ where: { id, storeId: request.storeId } })
    if (!group)
      return sendError(reply, 404, ErrorCodes.Customer.GroupNotFound, 'テーブルが見つかりません')
    fastify.io.to(`store:${request.storeId}`).emit('staff:called', group.id, group.name)
    return reply.status(204).send()
  })

  fastify.post('/orders', { schema: { body: createOrderBodySchema } }, async (request, reply) => {
    const body = request.body as {
      groupId: string
      items: {
        menuItemId: number
        qty: number
        selectedChoiceIds?: number[]
        selectedFrameChoiceIds?: number[]
      }[]
    }

    const group = await prisma.group.findFirst({
      where: { id: body.groupId, storeId: request.storeId },
    })
    if (!group)
      return sendError(reply, 404, ErrorCodes.Customer.GroupNotFound, 'テーブルが見つかりません')
    if (group.status !== 'active')
      return sendError(
        reply,
        400,
        ErrorCodes.Customer.OrderingClosed,
        '現在注文を受け付けていません',
      )

    const menuItemIds = body.items.map((i) => i.menuItemId)
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds }, storeId: request.storeId },
      include: {
        optionGroups: { include: { choices: true } },
        setFrames: { include: { choices: { include: { menuItem: true } } } },
      },
    })
    const menuItemMap = new Map(menuItems.map((m) => [m.id, m]))

    const missing = menuItemIds.filter((id) => !menuItemMap.has(id))
    if (missing.length > 0) {
      return sendError(
        reply,
        422,
        ErrorCodes.Customer.MenuItemsNotFound,
        `menuItem ${missing.join(',')} が見つかりません`,
        { menuItemIds: missing },
      )
    }

    const soldOut = body.items.filter((i) => menuItemMap.get(i.menuItemId)?.soldOut)
    if (soldOut.length > 0) {
      return sendError(
        reply,
        409,
        ErrorCodes.Customer.SoldOut,
        '品切れの商品が注文リストに入っています',
        {
          menuItemIds: soldOut.map((i) => i.menuItemId),
          menuItemNames: soldOut.map((i) => menuItemMap.get(i.menuItemId)?.name ?? ''),
        },
      )
    }

    const takeoutOnly = body.items.filter(
      (i) => menuItemMap.get(i.menuItemId)?.takeout === 'takeout',
    )
    if (takeoutOnly.length > 0) {
      return sendError(
        reply,
        422,
        ErrorCodes.Customer.TakeoutOnly,
        'テイクアウト専用の商品は店内でご注文いただけません',
      )
    }

    const choicesByItem = new Map<
      number,
      Map<
        number,
        { choiceId: number; groupId: number; groupName: string; name: string; extraPrice: number }
      >
    >()
    for (const menuItem of menuItems) {
      choicesByItem.set(
        menuItem.id,
        new Map(
          (menuItem.optionGroups ?? []).flatMap((group) =>
            group.choices.map((choice) => [
              choice.id,
              {
                choiceId: choice.id,
                groupId: group.id,
                groupName: group.name,
                name: choice.name,
                extraPrice: choice.extraPrice,
              },
            ]),
          ),
        ),
      )
    }
    for (const item of body.items) {
      const selectedChoiceIds = item.selectedChoiceIds ?? []
      const choices = choicesByItem.get(item.menuItemId) ?? new Map()
      if (selectedChoiceIds.some((choiceId) => !choices.has(choiceId)))
        return sendError(
          reply,
          400,
          ErrorCodes.Customer.InvalidOptionChoice,
          '無効なオプション選択です',
        )

      const selectedGroupIds = selectedChoiceIds.flatMap((choiceId) => {
        const choice = choices.get(choiceId)
        return choice ? [choice.groupId] : []
      })
      if (new Set(selectedGroupIds).size !== selectedGroupIds.length)
        return sendError(
          reply,
          400,
          ErrorCodes.Customer.DuplicateOptionGroupSelection,
          '同じオプション分類から複数選択できません',
        )

      const requiredGroupIds = (menuItemMap.get(item.menuItemId)?.optionGroups ?? [])
        .filter((group) => group.required)
        .map((group) => group.id)
      if (requiredGroupIds.some((groupId) => !selectedGroupIds.includes(groupId)))
        return sendError(
          reply,
          400,
          ErrorCodes.Customer.MissingRequiredOption,
          '必須オプションを選択してください',
        )
    }

    for (const item of body.items) {
      const menuItem = menuItemMap.get(item.menuItemId)
      const selectedFrameChoiceIds = item.selectedFrameChoiceIds ?? []
      if (!menuItem?.isSet) {
        if (item.selectedFrameChoiceIds !== undefined)
          return sendError(
            reply,
            400,
            ErrorCodes.Customer.SetFrameSelectionNotApplicable,
            'セットではない商品にセット枠の選択は指定できません',
          )
        continue
      }

      const frameChoices = new Map(
        menuItem.setFrames.flatMap((frame) =>
          frame.choices.map((choice) => [
            choice.id,
            { frameId: frame.id, menuItem: choice.menuItem },
          ]),
        ),
      )
      if (selectedFrameChoiceIds.some((choiceId) => !frameChoices.has(choiceId)))
        return sendError(
          reply,
          400,
          ErrorCodes.Customer.InvalidSetFrameChoice,
          '無効なセット枠の選択です',
        )

      const selectedFrameIds = selectedFrameChoiceIds.map(
        (choiceId) => frameChoices.get(choiceId)?.frameId,
      )
      if (
        selectedFrameIds.length !== menuItem.setFrames.length ||
        new Set(selectedFrameIds).size !== selectedFrameIds.length ||
        menuItem.setFrames.some((frame) => !selectedFrameIds.includes(frame.id))
      )
        return sendError(
          reply,
          400,
          ErrorCodes.Customer.MissingSetFrameSelection,
          'すべてのセット枠を1つずつ選択してください',
        )

      if (selectedFrameChoiceIds.some((choiceId) => frameChoices.get(choiceId)?.menuItem.soldOut))
        return sendError(
          reply,
          409,
          ErrorCodes.Customer.SetFrameChoiceSoldOut,
          '選択されたセット商品の一部が品切れです',
        )
    }

    let planMenuItemIds: Set<number> | null = null
    if (group.drinkPlanId) {
      const planItems = await prisma.drinkPlanItem.findMany({
        where: { drinkPlanId: group.drinkPlanId },
        select: { menuItemId: true },
      })
      planMenuItemIds = new Set(planItems.map((p) => p.menuItemId))
    }

    let txResult: Awaited<ReturnType<typeof prisma.orderItem.create>>[] | null
    try {
      txResult = await prisma.$transaction(
        async (tx) => {
          const current = await tx.group.findUnique({
            where: { id: body.groupId },
            select: { status: true },
          })
          if (current?.status !== 'active') return null
          const createdByItem = await Promise.all(
            body.items.map(async (item) => {
              const isPlanItem = planMenuItemIds?.has(item.menuItemId) ?? false
              // 注文時点の MenuItem 単価を保持し、飲み放題解除時の復元にも使う
              const menuItem = menuItemMap.get(item.menuItemId)
              const originalPrice = menuItem?.price ?? 0
              const selectedOptions = (item.selectedChoiceIds ?? []).flatMap((choiceId) => {
                const option = choicesByItem.get(item.menuItemId)?.get(choiceId)
                return option ? [option] : []
              })
              if (menuItem?.isSet) {
                const parent = await tx.orderItem.create({
                  data: {
                    groupId: body.groupId,
                    menuItemId: item.menuItemId,
                    menuItemName: menuItem.name,
                    price: originalPrice,
                    originalPrice,
                    qty: item.qty,
                    isTakeout: false,
                    isSetCharge: true,
                    status: 'served',
                    storeId: request.storeId,
                  },
                  include: { options: true },
                })
                const children = await Promise.all(
                  (item.selectedFrameChoiceIds ?? []).map((choiceId) => {
                    const choice = menuItem.setFrames
                      .flatMap((frame) => frame.choices)
                      .find((candidate) => candidate.id === choiceId)
                    return tx.orderItem.create({
                      data: {
                        groupId: body.groupId,
                        menuItemId: choice?.menuItemId,
                        menuItemName: choice?.menuItem.name ?? '',
                        price: 0,
                        originalPrice: choice?.menuItem.price,
                        qty: item.qty,
                        isTakeout: false,
                        setOrderItemId: parent.id,
                        storeId: request.storeId,
                      },
                      include: { options: true },
                    })
                  }),
                )
                return [parent, ...children]
              }
              const createdOrder = await tx.orderItem.create({
                data: {
                  groupId: body.groupId,
                  menuItemId: item.menuItemId,
                  menuItemName: menuItem?.name ?? '',
                  price: isPlanItem
                    ? 0
                    : Math.max(
                        0,
                        originalPrice + selectedOptions.reduce((sum, o) => sum + o.extraPrice, 0),
                      ),
                  originalPrice,
                  qty: item.qty,
                  isTakeout: false,
                  courseId: null,
                  storeId: request.storeId,
                  options: {
                    create: selectedOptions.map((option) => ({
                      choiceId: option.choiceId,
                      groupName: option.groupName,
                      choiceName: option.name,
                      extraPrice: option.extraPrice,
                    })),
                  },
                },
                include: { options: true },
              })
              return [createdOrder]
            }),
          )
          return createdByItem.flat()
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003')
        return sendError(
          reply,
          409,
          ErrorCodes.Customer.MenuItemDeleted,
          '注文対象のメニューが削除されたため、注文を作成できません',
        )
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034')
        return sendError(
          reply,
          409,
          ErrorCodes.Customer.Conflict,
          '他の操作と競合しました。もう一度お試しください',
        )
      throw e
    }

    if (!txResult)
      return sendError(
        reply,
        400,
        ErrorCodes.Customer.OrderingClosed,
        '現在注文を受け付けていません',
      )

    const results = txResult.map(toOrderItem)
    for (const result of results) {
      fastify.io
        .to(`store:${request.storeId}`)
        .to(`group:${result.groupId}`)
        .emit('order:created', result)
    }

    return reply.status(201).send(results)
  })
}

export default customerRoutes
