import bcrypt from 'bcryptjs'
import type { FastifyPluginAsync } from 'fastify'
import { ErrorCodes, sendError } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { requirePlatformAdmin } from '../plugins/auth.js'

const RESERVED_SUBDOMAINS = new Set(['admin'])

class ActiveDataExistsError extends Error {
  constructor(
    public openSessionCount: number,
    public activeGroupCount: number,
  ) {
    super('active data exists')
  }
}

const DEFAULT_SETTING = {
  storeName: '居酒屋',
  closingTime: '23:00',
  taxRateInHouse: 10,
  taxRateTakeout: 8,
  taxInclusive: false,
}

const createBodySchema = {
  type: 'object',
  required: ['subdomain', 'name', 'adminUsername', 'adminPassword'],
  properties: {
    subdomain: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$|^[a-z0-9]$' },
    name: { type: 'string', minLength: 1 },
    adminUsername: { type: 'string', minLength: 1 },
    adminPassword: { type: 'string', minLength: 8, maxLength: 100 },
  },
  additionalProperties: false,
} as const

const updateBodySchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    isActive: { type: 'boolean' },
  },
  additionalProperties: false,
} as const

// passwordHash 等の内部情報を含めないための明示的な select
const select = { id: true, subdomain: true, name: true, isActive: true, createdAt: true }

const platformStoresRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', requirePlatformAdmin)

  fastify.get('/', async () => {
    return prisma.store.findMany({ select, orderBy: { createdAt: 'asc' } })
  })

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const store = await prisma.store.findUnique({ where: { id: Number(id) }, select })
    if (!store)
      return sendError(reply, 404, ErrorCodes.PlatformStores.NotFound, '店舗が見つかりません')
    return store
  })

  fastify.post('/', { schema: { body: createBodySchema } }, async (request, reply) => {
    const { subdomain, name, adminUsername, adminPassword } = request.body as {
      subdomain: string
      name: string
      adminUsername: string
      adminPassword: string
    }

    if (RESERVED_SUBDOMAINS.has(subdomain)) {
      return sendError(
        reply,
        422,
        ErrorCodes.PlatformStores.ReservedSubdomain,
        'このサブドメインは予約されているため使用できません',
      )
    }

    const existing = await prisma.store.findUnique({ where: { subdomain } })
    if (existing)
      return sendError(
        reply,
        409,
        ErrorCodes.PlatformStores.DuplicateSubdomain,
        'そのサブドメインは既に使用されています',
      )

    const passwordHash = await bcrypt.hash(adminPassword, 12)

    const store = await prisma.$transaction(async (tx) => {
      const store = await tx.store.create({ data: { subdomain, name }, select })
      await tx.setting.create({ data: { ...DEFAULT_SETTING, storeId: store.id } })
      await tx.staff.create({
        data: { storeId: store.id, username: adminUsername, passwordHash, role: 'admin' },
      })
      return store
    })

    return reply.status(201).send(store)
  })

  fastify.put('/:id', { schema: { body: updateBodySchema } }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { name?: string; isActive?: boolean }
    const existing = await prisma.store.findUnique({ where: { id: Number(id) } })
    if (!existing)
      return sendError(reply, 404, ErrorCodes.PlatformStores.NotFound, '店舗が見つかりません')
    const store = await prisma.store.update({ where: { id: Number(id) }, data: body, select })
    return store
  })

  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const storeId = Number(id)
    const existing = await prisma.store.findUnique({ where: { id: storeId } })
    if (!existing)
      return sendError(reply, 404, ErrorCodes.PlatformStores.NotFound, '店舗が見つかりません')

    // 削除トランザクション中の同時書き込みを防ぐため、先に非アクティブ化する。
    // resolveStoreContext は isActive: false の店舗を unknown 扱いにするため、
    // 以降のリクエストは Host 解決の時点で 404 になる。
    await prisma.store.update({ where: { id: storeId }, data: { isActive: false } })

    try {
      // FK 依存の逆順で削除する（GroupSeat/CourseFoodItem/DrinkPlanItem/RefreshToken は onDelete: Cascade で自動削除される）
      await prisma.$transaction(
        async (tx) => {
          const openSessionCount = await tx.session.count({ where: { storeId, status: 'open' } })
          const activeGroupCount = await tx.group.count({
            where: { storeId, status: { in: ['active', 'bill_requested'] } },
          })
          if (openSessionCount > 0 || activeGroupCount > 0) {
            throw new ActiveDataExistsError(openSessionCount, activeGroupCount)
          }

          await tx.orderItem.deleteMany({ where: { storeId } })
          await tx.group.deleteMany({ where: { storeId } })
          await tx.session.deleteMany({ where: { storeId } })
          await tx.course.deleteMany({ where: { storeId } })
          await tx.drinkPlan.deleteMany({ where: { storeId } })
          await tx.menuItem.deleteMany({ where: { storeId } })
          await tx.subCategory.deleteMany({ where: { storeId } })
          await tx.category.deleteMany({ where: { storeId } })
          await tx.seat.deleteMany({ where: { storeId } })
          await tx.seatTable.deleteMany({ where: { storeId } })
          await tx.staff.deleteMany({ where: { storeId } })
          await tx.setting.deleteMany({ where: { storeId } })
          await tx.store.delete({ where: { id: storeId } })
        },
        { timeout: 30_000 },
      )
    } catch (err) {
      request.log.error(
        { err, storeId, subdomain: existing.subdomain },
        'Failed to delete store after deactivation',
      )
      try {
        await prisma.store.update({ where: { id: storeId }, data: { isActive: true } })
      } catch (restoreErr) {
        request.log.error(
          { err: restoreErr, storeId, subdomain: existing.subdomain },
          'Failed to restore store active state after delete failure',
        )
      }
      if (err instanceof ActiveDataExistsError) {
        return sendError(
          reply,
          409,
          ErrorCodes.PlatformStores.ActiveDataExists,
          '営業中のセッションまたはアクティブなグループが存在するため削除できません',
          { openSessionCount: err.openSessionCount, activeGroupCount: err.activeGroupCount },
        )
      }
      throw err
    }

    return reply.status(204).send()
  })
}

export default platformStoresRoutes
