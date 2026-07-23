import { type OrderItem, Prisma } from '@prisma/client'
import type { FastifyPluginAsync } from 'fastify'
import { ErrorCodes, sendError } from '../lib/errors.js'
import { toOrderItem } from '../lib/mappers.js'
import { prisma } from '../lib/prisma.js'

class GroupStatusError extends Error {}
class CourseMismatchError extends Error {}

const createBodySchema = {
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
          isTakeout: { type: 'boolean' },
          selectedChoiceIds: { type: 'array', items: { type: 'integer', minimum: 1 } },
        },
        additionalProperties: false,
      },
    },
    courseId: { type: ['integer', 'null'] },
  },
  additionalProperties: false,
} as const

const cancelBodySchema = {
  type: 'object',
  required: ['qty'],
  properties: {
    qty: { type: 'integer', minimum: 1 },
  },
  additionalProperties: false,
} as const

const VALID_ORDER_STATUSES = new Set(['pending', 'ready', 'served', 'cancelled'])

type CreateOrderResult = OrderItem[]
type CancelOrderTxResult = OrderItem | null | { conflict: true; courseCharge?: true }

const ordersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request, reply) => {
    const { groupId, status, sessionId } = request.query as {
      groupId?: string
      status?: string | string[]
      sessionId?: string
    }
    const where: Record<string, unknown> = { storeId: request.storeId }
    if (groupId) where.groupId = groupId
    if (status) {
      const statuses = Array.isArray(status) ? status : status.split(',')
      if (!statuses.every((s) => VALID_ORDER_STATUSES.has(s))) {
        return sendError(reply, 400, ErrorCodes.Orders.InvalidStatus, '無効なステータス値です')
      }
      where.status = statuses.length === 1 ? statuses[0] : { in: statuses }
    }
    if (sessionId) {
      where.group = { sessionId: Number(sessionId) }
    }
    const items = await prisma.orderItem.findMany({
      where,
      orderBy: { orderedAt: 'asc' },
      include: { options: true },
    })
    return items.map(toOrderItem)
  })

  fastify.post('/', { schema: { body: createBodySchema } }, async (request, reply) => {
    const body = request.body as {
      groupId: string
      items: {
        menuItemId: number
        qty: number
        isTakeout?: boolean
        selectedChoiceIds?: number[]
      }[]
      courseId?: number | null
    }

    const group = await prisma.group.findFirst({
      where: { id: body.groupId, storeId: request.storeId },
    })
    if (!group)
      return sendError(reply, 404, ErrorCodes.Orders.GroupNotFound, 'グループが見つかりません')
    if (group.status !== 'active')
      return sendError(
        reply,
        409,
        ErrorCodes.Orders.GroupNotAccepting,
        'このグループには注文を追加できません',
      )

    const menuItemIds = body.items.map((i) => i.menuItemId)
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds }, storeId: request.storeId },
      include: { optionGroups: { include: { choices: true } } },
    })
    const menuItemMap = new Map(menuItems.map((m) => [m.id, m]))

    const missing = menuItemIds.filter((id) => !menuItemMap.has(id))
    if (missing.length > 0) {
      return sendError(
        reply,
        422,
        ErrorCodes.Orders.MenuItemsNotFound,
        `menuItem ${missing.join(',')} が見つかりません`,
        { menuItemIds: missing },
      )
    }

    const soldOut = body.items.filter((i) => menuItemMap.get(i.menuItemId)?.soldOut)
    if (soldOut.length > 0) {
      return sendError(reply, 409, ErrorCodes.Orders.SoldOut, '品切れの商品が含まれています')
    }

    const invalidTakeout = body.items.filter((i) => {
      const takeoutType = menuItemMap.get(i.menuItemId)?.takeout
      const isTakeout = i.isTakeout === true
      return (isTakeout && takeoutType === 'dine_in') || (!isTakeout && takeoutType === 'takeout')
    })
    if (invalidTakeout.length > 0) {
      return sendError(
        reply,
        422,
        ErrorCodes.Orders.TakeoutMismatch,
        'テイクアウト設定に合わない商品が含まれています',
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
          ErrorCodes.Orders.InvalidOptionChoice,
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
          ErrorCodes.Orders.DuplicateOptionGroupSelection,
          '同じオプション分類から複数選択できません',
        )

      const requiredGroupIds = (menuItemMap.get(item.menuItemId)?.optionGroups ?? [])
        .filter((group) => group.required)
        .map((group) => group.id)
      if (requiredGroupIds.some((groupId) => !selectedGroupIds.includes(groupId)))
        return sendError(
          reply,
          400,
          ErrorCodes.Orders.MissingRequiredOption,
          '必須オプションを選択してください',
        )
    }

    if (body.courseId != null) {
      const course = await prisma.course.findFirst({
        where: { id: body.courseId, storeId: request.storeId },
        include: { foodItems: true },
      })
      if (!course)
        return sendError(
          reply,
          422,
          ErrorCodes.Orders.CourseNotFound,
          `course ${body.courseId} が見つかりません`,
          { courseId: body.courseId },
        )

      // コース由来の自動生成明細と衝突する追加注文を禁止する。PUT /:id/course の人数変更再計算が
      // courseId 一致 + menuItemId 一致で明細を拾うため、ここを通すと手動明細が誤って巻き込まれる
      const courseFoodItemMenuItemIds = new Set(course.foodItems.map((fi) => fi.menuItemId))
      const conflictingMenuItemIds = [
        ...new Set(
          body.items
            .filter((i) => courseFoodItemMenuItemIds.has(i.menuItemId))
            .map((i) => i.menuItemId),
        ),
      ]
      if (conflictingMenuItemIds.length > 0) {
        return sendError(
          reply,
          422,
          ErrorCodes.Orders.CourseFoodItemConflict,
          'コース内商品と同じメニューは courseId 付きで追加注文できません',
          { courseId: body.courseId, conflictingMenuItemIds },
        )
      }
    }

    let created: CreateOrderResult
    try {
      created = await prisma.$transaction(
        async (tx) => {
          const currentGroup = await tx.group.findUnique({
            where: { id: body.groupId },
            select: { status: true, courseId: true, drinkPlanId: true },
          })
          if (currentGroup?.status !== 'active') throw new GroupStatusError()
          if (body.courseId != null && currentGroup.courseId !== body.courseId)
            throw new CourseMismatchError()

          let planMenuItemIds: Set<number> | null = null
          if (currentGroup.drinkPlanId) {
            const planItems = await tx.drinkPlanItem.findMany({
              where: { drinkPlanId: currentGroup.drinkPlanId },
              select: { menuItemId: true },
            })
            planMenuItemIds = new Set(planItems.map((p) => p.menuItemId))
          }

          return Promise.all(
            body.items.map((item) => {
              const isTakeout = item.isTakeout ?? false
              // 飲み放題プラン対象商品は店内注文に限り0円（テイクアウトはプラン対象外）
              const isPlanItem = !isTakeout && (planMenuItemIds?.has(item.menuItemId) ?? false)
              // 注文時点の MenuItem 単価を保持し、飲み放題解除時の復元にも使う
              const menuItem = menuItemMap.get(item.menuItemId)
              const originalPrice = menuItem?.price ?? 0
              const selectedOptions = (item.selectedChoiceIds ?? []).flatMap((choiceId) => {
                const option = choicesByItem.get(item.menuItemId)?.get(choiceId)
                return option ? [option] : []
              })
              return tx.orderItem.create({
                data: {
                  groupId: body.groupId,
                  menuItemId: item.menuItemId,
                  // 注文時点の名称・価格をスナップショット保存（後から変更しても履歴が壊れない）
                  menuItemName: menuItem?.name ?? '',
                  price: isPlanItem
                    ? 0
                    : Math.max(
                        0,
                        originalPrice + selectedOptions.reduce((sum, o) => sum + o.extraPrice, 0),
                      ),
                  originalPrice,
                  qty: item.qty,
                  isTakeout,
                  courseId: body.courseId ?? null,
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
            }),
          )
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
    } catch (e) {
      if (e instanceof GroupStatusError)
        return sendError(
          reply,
          409,
          ErrorCodes.Orders.GroupNotAccepting,
          'このグループには注文を追加できません',
        )
      if (e instanceof CourseMismatchError)
        return sendError(
          reply,
          422,
          ErrorCodes.Orders.CourseMismatch,
          '適用中のコースと一致しません',
          { courseId: body.courseId },
        )
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003')
        return sendError(
          reply,
          409,
          ErrorCodes.Orders.MenuItemDeleted,
          '注文対象のメニューが削除されたため、注文を作成できません',
        )
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034')
        return sendError(
          reply,
          409,
          ErrorCodes.Orders.Conflict,
          '他の操作と競合しました。もう一度お試しください',
        )
      throw e
    }

    const results = created.map(toOrderItem)
    for (const result of results) {
      fastify.io
        .to(`store:${request.storeId}`)
        .to(`group:${result.groupId}`)
        .emit('order:created', result)
    }

    return reply.status(201).send(results)
  })

  fastify.put('/:id/cancel', { schema: { body: cancelBodySchema } }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { qty } = request.body as { qty: number }

    // トランザクション内で throw するとロールバックが走るため、特殊値（null / {conflict}）で返す
    let result: CancelOrderTxResult
    try {
      result = await prisma.$transaction(
        async (tx) => {
          const order = await tx.orderItem.findFirst({
            where: { id, storeId: request.storeId },
            include: { group: { include: { session: true } } },
          })
          if (!order) return null
          if (order.status === 'cancelled') {
            return { conflict: true }
          }
          // 会計済み（closed）のグループ・セッションの注文はキャンセルさせない
          if (order.group.status === 'closed' || order.group.session.status === 'closed') {
            return { conflict: true }
          }
          // コース/飲み放題の定額課金明細はこのAPIでは取消不可（Group.courseId等との整合が崩れるため POST/DELETE /groups/:id/course を使う）
          if (order.isCourseCharge) {
            return { conflict: true, courseCharge: true as const }
          }

          if (qty >= order.qty) {
            return tx.orderItem.update({
              where: { id },
              data: { status: 'cancelled' },
            })
          } else {
            return tx.orderItem.update({
              where: { id },
              data: { qty: order.qty - qty },
            })
          }
          // Serializable にしないと、同一注文への同時キャンセルリクエストが両方とも
          // 古い qty を読んだまま更新し合い、片方の減算が失われる（lost update）
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034') {
        return sendError(
          reply,
          409,
          ErrorCodes.Orders.Conflict,
          '他の操作と競合しました。もう一度お試しください',
        )
      }
      throw e
    }

    if (result === null)
      return sendError(reply, 404, ErrorCodes.Orders.NotFound, '注文が見つかりません')
    if ('conflict' in result) {
      if ('courseCharge' in result)
        return sendError(
          reply,
          409,
          ErrorCodes.Orders.CourseChargeNotCancellable,
          'コース・飲み放題料金はこの操作では取消できません',
        )
      return sendError(
        reply,
        409,
        ErrorCodes.Orders.InvalidCancelStatus,
        'キャンセルできないステータスです',
      )
    }

    const mapped = toOrderItem(result)
    // 完全キャンセル（IDのみ）と数量変更（全フィールド）はクライアントの処理が異なるためイベントを分ける
    if (result.status === 'cancelled') {
      fastify.io
        .to(`store:${request.storeId}`)
        .to(`group:${mapped.groupId}`)
        .emit('order:cancelled', mapped.id)
    } else {
      fastify.io
        .to(`store:${request.storeId}`)
        .to(`group:${mapped.groupId}`)
        .emit('order:updated', mapped)
    }
    return mapped
  })
}

export default ordersRoutes
