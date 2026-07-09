import type { FastifyPluginAsync } from 'fastify'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { toGroup, toOrderItem } from '../lib/mappers.js'
import { ErrorCodes, sendError } from '../lib/errors.js'

class SeatConflictError extends Error {}
class SoldOutError extends Error {}
class GroupStatusError extends Error {}
class InvalidTransitionError extends Error {
  constructor(public from: string, public to: string) { super() }
}
class NotFoundError extends Error {}

const validTransitions: Record<string, string[]> = {
  active: ['bill_requested'],
  bill_requested: ['active', 'closed'],
  closed: [],
}

const applyCourseBodySchema = {
  type: 'object',
  required: ['courseId', 'qty'],
  properties: {
    courseId: { type: 'integer', minimum: 1 },
    qty: { type: 'integer', minimum: 1, maximum: 99 },
  },
  additionalProperties: false,
} as const

const updateCourseQtyBodySchema = {
  type: 'object',
  required: ['qty'],
  properties: {
    qty: { type: 'integer', minimum: 1, maximum: 99 },
  },
  additionalProperties: false,
} as const

const createBodySchema = {
  type: 'object',
  required: ['guestCount', 'seatIds'],
  properties: {
    name: { type: 'string' },
    guestCount: { type: 'integer', minimum: 1 },
    seatIds: { type: 'array', items: { type: 'integer', minimum: 1 }, minItems: 1 },
  },
  additionalProperties: false,
} as const

const updateBodySchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['active', 'bill_requested', 'closed'] },
    name: { type: 'string', minLength: 1 },
    guestCount: { type: 'integer', minimum: 1 },
    seatIds: { type: 'array', items: { type: 'integer', minimum: 1 } },
  },
  additionalProperties: false,
} as const

const VALID_GROUP_STATUSES = new Set(['active', 'bill_requested', 'closed'])

// コース/飲み放題の適用を取り消す。飲み放題対象商品の価格を元に戻し、コース・飲み放題の定額課金明細を取消済みにする。
// コース解除（DELETE /:id/course）とコース再適用時の旧コース取り消し（POST /:id/course）の両方から呼ばれる。
async function unapplyCourse(
  tx: Prisma.TransactionClient,
  params: { groupId: string; storeId: number; courseId: number | null; drinkPlanId: number | null },
) {
  const { groupId, storeId, courseId, drinkPlanId } = params

  const restoredItems = []
  if (drinkPlanId != null) {
    const planItems = await tx.drinkPlanItem.findMany({ where: { drinkPlanId }, select: { menuItemId: true } })
    const planMenuItemIds = planItems.map(p => p.menuItemId)
    if (planMenuItemIds.length > 0) {
      const targets = await tx.orderItem.findMany({
        where: {
          groupId,
          storeId,
          menuItemId: { in: planMenuItemIds },
          isTakeout: false,
          status: { not: 'cancelled' },
        },
      })
      for (const target of targets) {
        // originalPrice はゼロ化時点の注文価格スナップショット。現在のメニュー価格ではなくこちらで復元する
        const updated = await tx.orderItem.update({
          where: { id: target.id },
          data: { price: target.originalPrice ?? target.price, originalPrice: null },
        })
        restoredItems.push(updated)
      }
    }
  }

  const cancelledItems = []
  if (courseId != null) {
    // 定額課金明細（isCourseCharge:true）に加え、courseId 適用時に CourseFoodItem から自動生成された
    // 個別食事明細（isCourseCharge:false・price:0）も対象。courseId は他の注文経路では設定されないため、
    // courseId が一致する時点でコース由来の明細と確定できる
    const courseItems = await tx.orderItem.findMany({
      where: {
        groupId,
        storeId,
        courseId,
        status: { not: 'cancelled' },
      },
    })
    for (const courseItem of courseItems) {
      const updated = await tx.orderItem.update({ where: { id: courseItem.id }, data: { status: 'cancelled' } })
      cancelledItems.push(updated)
    }
  }

  return { restoredItems, cancelledItems }
}

const groupsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request, reply) => {
    const { sessionId, status } = request.query as { sessionId?: string; status?: string | string[] }
    const where: Record<string, unknown> = { storeId: request.storeId }
    if (sessionId) where.sessionId = Number(sessionId)
    if (status) {
      // ?status=active,bill_requested（カンマ区切り）と ?status=active&status=bill_requested（配列）を両方受け付ける
      const statuses = Array.isArray(status) ? status : status.split(',')
      if (!statuses.every(s => VALID_GROUP_STATUSES.has(s))) {
        return sendError(reply, 400, ErrorCodes.Groups.InvalidStatus, '無効なステータス値です')
      }
      where.status = statuses.length === 1 ? statuses[0] : { in: statuses }
    }
    const groups = await prisma.group.findMany({
      where,
      include: { seats: true },
      orderBy: { createdAt: 'asc' },
    })
    return groups.map(toGroup)
  })

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const group = await prisma.group.findFirst({
      where: { id, storeId: request.storeId },
      include: { seats: true },
    })
    if (!group) return sendError(reply, 404, ErrorCodes.Groups.NotFound, 'グループが見つかりません')
    return toGroup(group)
  })

  fastify.post('/', { schema: { body: createBodySchema } }, async (request, reply) => {
    const body = request.body as { name?: string; guestCount: number; seatIds: number[] }

    const ownedSeats = await prisma.seat.findMany({ where: { id: { in: body.seatIds }, storeId: request.storeId } })
    if (ownedSeats.length !== body.seatIds.length) {
      return sendError(reply, 422, ErrorCodes.Groups.InvalidSeats, '無効な席が含まれています')
    }

    let name = body.name
    if (!name) {
      name = ownedSeats.map(s => s.label).join('・') || `グループ`
    }

    let txResult
    try {
      txResult = await prisma.$transaction(async (tx) => {
        const currentSession = await tx.session.findFirst({ where: { status: 'open', storeId: request.storeId } })
        if (!currentSession) return { err: 'no_session' as const }

        const conflict = await tx.groupSeat.findFirst({
          where: {
            seatId: { in: body.seatIds },
            group: { status: { in: ['active', 'bill_requested'] } },
          },
        })
        if (conflict) return { err: 'seat_conflict' as const }

        const group = await tx.group.create({
          data: {
            name,
            guestCount: body.guestCount,
            sessionId: currentSession.id,
            storeId: request.storeId,
            seats: {
              create: body.seatIds.map(seatId => ({ seatId })),
            },
          },
          include: { seats: true },
        })
        return { group }
        // Serializable にしないと、同一席への同時作成リクエストが両方とも conflict チェックを素通りしてしまう
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034') {
        return sendError(reply, 409, ErrorCodes.Groups.SeatConflict, '選択した席はすでに使用中です')
      }
      throw e
    }
    if ('err' in txResult) {
      if (txResult.err === 'no_session') return sendError(reply, 409, ErrorCodes.Groups.NoOpenSession, '営業中のセッションがありません')
      return sendError(reply, 409, ErrorCodes.Groups.SeatConflict, '選択した席はすでに使用中です')
    }

    const { group } = txResult
    const result = toGroup(group)
    fastify.io.to(`store:${request.storeId}`).emit('group:created', result)

    // ホール画面の席カードが占有状態をリアルタイムで反映できるよう通知する
    for (const seat of ownedSeats) {
      fastify.io.to(`store:${request.storeId}`).emit('seat:updated', seat)
    }

    return reply.status(201).send(result)
  })

  fastify.put('/:id', { schema: { body: updateBodySchema } }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      status?: string; name?: string; guestCount?: number; seatIds?: number[];
    }

    const existingGroup = await prisma.group.findFirst({ where: { id, storeId: request.storeId } })
    if (!existingGroup) return sendError(reply, 404, ErrorCodes.Groups.NotFound, 'グループが見つかりません')

    // 店舗内に他の open セッションがあるかではなく、対象グループ自身のセッションが営業中かを見る
    const session = await prisma.session.findFirst({ where: { id: existingGroup.sessionId, storeId: request.storeId } })
    if (!session || session.status !== 'open') return sendError(reply, 409, ErrorCodes.Groups.NoOpenSession, '営業中のセッションがありません')

    if (body.seatIds !== undefined) {
      const ownedSeatCount = await prisma.seat.count({ where: { id: { in: body.seatIds }, storeId: request.storeId } })
      if (ownedSeatCount !== body.seatIds.length) {
        return sendError(reply, 422, ErrorCodes.Groups.InvalidSeats, '無効な席が含まれています')
      }
    }

    const updateData: Record<string, unknown> = {}
    if (body.status !== undefined) updateData.status = body.status
    if (body.name !== undefined) updateData.name = body.name
    if (body.guestCount !== undefined) updateData.guestCount = body.guestCount

    if (body.seatIds !== undefined) {
      // 差分更新ではなく全置換（deleteMany → create）で席割り当てを更新する
      updateData.seats = {
        deleteMany: {},
        create: body.seatIds.map(seatId => ({ seatId })),
      }
    }

    try {
      const group = await prisma.$transaction(async (tx) => {
        const currentGroup = await tx.group.findUnique({ where: { id } })
        if (!currentGroup) throw new NotFoundError()

        if (body.status !== undefined) {
          const from = currentGroup.status
          const to = body.status!
          if (!validTransitions[from]?.includes(to)) throw new InvalidTransitionError(from, to)
        } else if (currentGroup.status === 'closed' || currentGroup.status === 'bill_requested') {
          // 会計済み・会計待ちのグループは status 変更以外の更新（人数・名前・席）を許可しない
          throw new GroupStatusError()
        }
        if (body.seatIds !== undefined) {
          const conflict = await tx.groupSeat.findFirst({
            where: {
              seatId: { in: body.seatIds },
              group: { status: { in: ['active', 'bill_requested'] }, id: { not: id } },
            },
          })
          if (conflict) throw new SeatConflictError()
        }
        return tx.group.update({
          where: { id },
          data: updateData,
          include: { seats: true },
        })
        // Serializable にしないと、同一席への同時割当リクエストが両方とも conflict チェックを素通りしてしまう
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

      const result = toGroup(group)
      fastify.io.to(`store:${request.storeId}`).to(`group:${id}`).emit('group:updated', result)

      const seatIds = body.seatIds ?? group.seats.map(s => s.seatId)
      const seatRecords = await prisma.seat.findMany({ where: { id: { in: seatIds } } })
      for (const seat of seatRecords) {
        fastify.io.to(`store:${request.storeId}`).emit('seat:updated', seat)
      }

      return result
    } catch (e) {
      if (e instanceof NotFoundError) return sendError(reply, 404, ErrorCodes.Groups.NotFound, 'グループが見つかりません')
      if (e instanceof InvalidTransitionError) return sendError(reply, 409, ErrorCodes.Groups.InvalidTransition, `${e.from} から ${e.to} への遷移は許可されていません`, { from: e.from, to: e.to })
      if (e instanceof SeatConflictError) return sendError(reply, 409, ErrorCodes.Groups.SeatConflict, '選択した席はすでに使用中です')
      if (e instanceof GroupStatusError) return sendError(reply, 409, ErrorCodes.Groups.ClosedOrBillRequested, '会計済み・会計待ちのグループは変更できません')
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034') {
        return sendError(reply, 409, ErrorCodes.Groups.SeatConflict, '選択した席はすでに使用中です')
      }
      throw e
    }
  })

  fastify.post('/:id/course', { schema: { body: applyCourseBodySchema } }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { courseId, qty } = request.body as { courseId: number; qty: number }

    const group = await prisma.group.findFirst({ where: { id, storeId: request.storeId } })
    if (!group) return sendError(reply, 404, ErrorCodes.Groups.NotFound, 'グループが見つかりません')
    if (group.status !== 'active') return sendError(reply, 409, ErrorCodes.Groups.CourseNotApplicable, 'このグループにはコースを適用できません')

    const course = await prisma.course.findFirst({ where: { id: courseId, storeId: request.storeId }, include: { foodItems: true } })
    if (!course) return sendError(reply, 404, ErrorCodes.Groups.CourseNotFound, 'コースが見つかりません')

    const drinkPlan = course.drinkPlanId != null
      ? await prisma.drinkPlan.findFirst({ where: { id: course.drinkPlanId, storeId: request.storeId } })
      : null

    const setting = await prisma.setting.findUnique({ where: { storeId: request.storeId } })
    if (!setting) {
      fastify.log.error({ storeId: request.storeId }, 'setting not found, cannot determine tax rates')
      return sendError(reply, 500, ErrorCodes.Groups.SettingNotFound, '店舗設定が見つかりません')
    }
    const taxRateInHouse = setting.taxRateInHouse.toNumber()
    const taxInclusive = setting.taxInclusive ?? false

    let txResult
    try {
      txResult = await prisma.$transaction(async (tx) => {
        const currentGroup = await tx.group.findUnique({ where: { id } })
        if (currentGroup?.status !== 'active') throw new GroupStatusError()

        // 既にコースが適用されている場合は、二重課金にならないよう先に旧コースを取り消してから新コースを適用する
        const unapplied = currentGroup.courseId != null
          ? await unapplyCourse(tx, {
              groupId: id,
              storeId: request.storeId,
              courseId: currentGroup.courseId,
              drinkPlanId: currentGroup.drinkPlanId,
            })
          : { restoredItems: [], cancelledItems: [] }

        const createdItems = []
        if (course.price > 0) {
          const chargeItem = await tx.orderItem.create({
            data: {
              groupId: id,
              menuItemId: null,
              menuItemName: course.name,
              price: course.price,
              qty,
              status: 'served',
              isTakeout: false,
              taxRate: taxRateInHouse,
              taxInclusive,
              courseId: course.id,
              isCourseCharge: true,
              isDrinkPlanCharge: false,
              storeId: request.storeId,
            },
          })
          createdItems.push(chargeItem)
        }
        if (drinkPlan && drinkPlan.price > 0) {
          // 飲み放題は人数按分ではなくグループ単位の定額課金
          const drinkPlanChargeItem = await tx.orderItem.create({
            data: {
              groupId: id,
              menuItemId: null,
              menuItemName: drinkPlan.name,
              price: drinkPlan.price,
              qty: 1,
              status: 'served',
              isTakeout: false,
              taxRate: taxRateInHouse,
              taxInclusive,
              courseId: course.id,
              isCourseCharge: true,
              isDrinkPlanCharge: true,
              storeId: request.storeId,
            },
          })
          createdItems.push(drinkPlanChargeItem)
        }
        if (course.foodItems.length > 0) {
          const menuItemIds = course.foodItems.map(fi => fi.menuItemId)
          const menuItems = await tx.menuItem.findMany({ where: { id: { in: menuItemIds }, storeId: request.storeId } })
          const menuItemMap = new Map(menuItems.map(m => [m.id, m]))
          for (const fi of course.foodItems) {
            const menuItem = menuItemMap.get(fi.menuItemId)
            if (!menuItem) continue
            if (menuItem.soldOut) throw new SoldOutError()
            const item = await tx.orderItem.create({
              data: {
                groupId: id,
                menuItemId: fi.menuItemId,
                menuItemName: menuItem.name,
                // コース料金に含まれるため個別の料理は0円で登録する
                price: 0,
                qty: fi.qty * qty,
                isTakeout: false,
                taxRate: taxRateInHouse,
                taxInclusive,
                courseId: course.id,
                storeId: request.storeId,
              },
            })
            createdItems.push(item)
          }
        }

        // 飲み放題プラン対象商品は、コース適用前に既に注文済みの分も遡って0円にする（テイクアウトはプラン対象外）
        const updatedOrderItems = []
        if (drinkPlan) {
          const planItems = await tx.drinkPlanItem.findMany({ where: { drinkPlanId: drinkPlan.id }, select: { menuItemId: true } })
          const planMenuItemIds = planItems.map(p => p.menuItemId)
          if (planMenuItemIds.length > 0) {
            const targets = await tx.orderItem.findMany({
              where: {
                groupId: id,
                storeId: request.storeId,
                menuItemId: { in: planMenuItemIds },
                isTakeout: false,
                status: { not: 'cancelled' },
              },
            })
            // 解除時に注文時点の価格へ復元できるよう、ゼロ化前の price を originalPrice に退避する
            for (const target of targets) {
              const zeroed = await tx.orderItem.update({
                where: { id: target.id },
                data: { price: 0, originalPrice: target.price },
              })
              updatedOrderItems.push(zeroed)
            }
          }
        }

        const updatedGroup = await tx.group.update({
          where: { id },
          data: { courseId: course.id, drinkPlanId: course.drinkPlanId },
          include: { seats: true },
        })
        return { createdItems, updatedOrderItems, updatedGroup, unapplied }
      })
    } catch (e) {
      if (e instanceof GroupStatusError) return sendError(reply, 409, ErrorCodes.Groups.CourseNotApplicable, 'このグループにはコースを適用できません')
      if (e instanceof SoldOutError) return sendError(reply, 409, ErrorCodes.Groups.CourseSoldOut, 'コース内に品切れの商品が含まれています')
      throw e
    }

    const { createdItems, updatedOrderItems, updatedGroup, unapplied } = txResult
    const groupResult = toGroup(updatedGroup)
    fastify.io.to(`store:${request.storeId}`).to(`group:${id}`).emit('group:updated', groupResult)
    for (const item of createdItems) {
      fastify.io.to(`store:${request.storeId}`).to(`group:${id}`).emit('order:created', toOrderItem(item))
    }
    for (const item of [...unapplied.restoredItems, ...unapplied.cancelledItems, ...updatedOrderItems]) {
      fastify.io.to(`store:${request.storeId}`).to(`group:${id}`).emit('order:updated', toOrderItem(item))
    }
    return groupResult
  })

  fastify.put('/:id/course', { schema: { body: updateCourseQtyBodySchema } }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { qty } = request.body as { qty: number }

    const group = await prisma.group.findFirst({ where: { id, storeId: request.storeId }, include: { seats: true } })
    if (!group) return sendError(reply, 404, ErrorCodes.Groups.NotFound, 'グループが見つかりません')
    if (group.status !== 'active') return sendError(reply, 409, ErrorCodes.Groups.CourseQtyNotEditable, 'このグループのコース人数は変更できません')
    if (group.courseId == null) return sendError(reply, 409, ErrorCodes.Groups.CourseNotApplied, 'コースが適用されていません')

    const course = await prisma.course.findFirst({ where: { id: group.courseId, storeId: request.storeId }, include: { foodItems: true } })
    const foodItemQtyByMenuItemId = new Map((course?.foodItems ?? []).map(fi => [fi.menuItemId, fi.qty]))

    let txResult
    try {
      txResult = await prisma.$transaction(async (tx) => {
        const currentGroup = await tx.group.findUnique({ where: { id } })
        if (currentGroup?.status !== 'active' || currentGroup.courseId !== group.courseId) throw new GroupStatusError()

        const chargeItem = await tx.orderItem.findFirst({
          where: {
            groupId: id,
            storeId: request.storeId,
            isCourseCharge: true,
            isDrinkPlanCharge: false,
            courseId: group.courseId,
            status: { not: 'cancelled' },
          },
        })
        const chargeResult = chargeItem ? await tx.orderItem.update({ where: { id: chargeItem.id }, data: { qty } }) : null

        // コース料金明細だけでなく、コース適用時に自動生成された食事明細（1人あたり qty）も
        // 人数変更に応じて比例して再計算する。手動追加の明細（courseId が異なる／null）は対象外
        const updatedFoodItems = []
        if (foodItemQtyByMenuItemId.size > 0) {
          const foodItems = await tx.orderItem.findMany({
            where: {
              groupId: id,
              storeId: request.storeId,
              courseId: group.courseId,
              isCourseCharge: false,
              status: { not: 'cancelled' },
            },
          })
          for (const item of foodItems) {
            const perGuestQty = item.menuItemId != null ? foodItemQtyByMenuItemId.get(item.menuItemId) : undefined
            if (perGuestQty == null) continue
            const updatedFoodItem = await tx.orderItem.update({ where: { id: item.id }, data: { qty: perGuestQty * qty } })
            updatedFoodItems.push(updatedFoodItem)
          }
        }

        return { chargeResult, updatedFoodItems }
      })
    } catch (e) {
      if (e instanceof GroupStatusError) return sendError(reply, 409, ErrorCodes.Groups.CourseQtyNotEditable, 'このグループのコース人数は変更できません')
      throw e
    }

    const { chargeResult, updatedFoodItems } = txResult

    for (const item of updatedFoodItems) {
      fastify.io.to(`store:${request.storeId}`).to(`group:${id}`).emit('order:updated', toOrderItem(item))
    }

    if (!chargeResult) return reply.status(204).send()

    const result = toOrderItem(chargeResult)
    fastify.io.to(`store:${request.storeId}`).to(`group:${id}`).emit('order:updated', result)
    return result
  })

  fastify.delete('/:id/course', async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = await prisma.group.findFirst({ where: { id, storeId: request.storeId } })
    if (!existing) return sendError(reply, 404, ErrorCodes.Groups.NotFound, 'グループが見つかりません')
    if (existing.status !== 'active') return sendError(reply, 409, ErrorCodes.Groups.CourseRemovalNotAllowed, 'このグループのコースは解除できません')

    let txResult
    try {
      txResult = await prisma.$transaction(async (tx) => {
        const currentGroup = await tx.group.findUnique({ where: { id } })
        if (currentGroup?.status !== 'active') throw new GroupStatusError()

        const { restoredItems, cancelledItems } = await unapplyCourse(tx, {
          groupId: id,
          storeId: request.storeId,
          courseId: currentGroup.courseId,
          drinkPlanId: currentGroup.drinkPlanId,
        })

        const group = await tx.group.update({
          where: { id },
          data: { courseId: null, drinkPlanId: null },
          include: { seats: true },
        })
        return { group, restoredItems, cancelledItems }
      })
    } catch (e) {
      if (e instanceof GroupStatusError) return sendError(reply, 409, ErrorCodes.Groups.CourseRemovalNotAllowed, 'このグループのコースは解除できません')
      throw e
    }

    const { group, restoredItems, cancelledItems } = txResult
    const result = toGroup(group)
    fastify.io.to(`store:${request.storeId}`).to(`group:${id}`).emit('group:updated', result)
    for (const item of restoredItems) {
      fastify.io.to(`store:${request.storeId}`).to(`group:${id}`).emit('order:updated', toOrderItem(item))
    }
    for (const item of cancelledItems) {
      fastify.io.to(`store:${request.storeId}`).to(`group:${id}`).emit('order:updated', toOrderItem(item))
    }
    return result
  })
}

export default groupsRoutes
