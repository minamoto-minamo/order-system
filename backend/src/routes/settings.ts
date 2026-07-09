import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { requireAdmin } from '../plugins/auth.js'

// 設定は店舗ごとに1レコードのシングルトン構成
const DEFAULT_SETTING = {
  storeName: '居酒屋',
  closingTime: '23:00',
  taxRateInHouse: 10,
  taxRateTakeout: 8,
  taxInclusive: false,
  refreshTokenAutoExtend: true,
  refreshTokenExpiresMinutes: 1440,
}

const updateBodySchema = {
  type: 'object',
  properties: {
    storeName: { type: 'string', minLength: 1 },
    closingTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
    taxRateInHouse: { type: 'number', minimum: 0, maximum: 100 },
    taxRateTakeout: { type: 'number', minimum: 0, maximum: 100 },
    taxInclusive: { type: 'boolean' },
    refreshTokenAutoExtend: { type: 'boolean' },
    refreshTokenExpiresMinutes: { type: 'integer', minimum: 5, maximum: 43200 },
  },
  additionalProperties: false,
} as const

const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request) => {
    const setting = await prisma.setting.findUnique({ where: { storeId: request.storeId } })
    return {
      storeName: setting?.storeName ?? DEFAULT_SETTING.storeName,
      closingTime: setting?.closingTime ?? DEFAULT_SETTING.closingTime,
      taxRateInHouse: setting ? setting.taxRateInHouse.toNumber() : DEFAULT_SETTING.taxRateInHouse,
      taxRateTakeout: setting ? setting.taxRateTakeout.toNumber() : DEFAULT_SETTING.taxRateTakeout,
      taxInclusive: setting?.taxInclusive ?? DEFAULT_SETTING.taxInclusive,
      refreshTokenAutoExtend: setting?.refreshTokenAutoExtend ?? DEFAULT_SETTING.refreshTokenAutoExtend,
      refreshTokenExpiresMinutes: setting?.refreshTokenExpiresMinutes ?? DEFAULT_SETTING.refreshTokenExpiresMinutes,
    }
  })

  fastify.put('/', { schema: { body: updateBodySchema }, preHandler: requireAdmin }, async (request) => {
    const body = request.body as Partial<{
      storeName: string; closingTime: string;
      taxRateInHouse: number; taxRateTakeout: number;
      taxInclusive: boolean;
      refreshTokenAutoExtend: boolean; refreshTokenExpiresMinutes: number;
    }>
    const setting = await prisma.setting.upsert({
      where: { storeId: request.storeId },
      update: body,
      create: { ...DEFAULT_SETTING, ...body, storeId: request.storeId },
    })
    const result = {
      storeName: setting.storeName,
      closingTime: setting.closingTime,
      taxRateInHouse: setting.taxRateInHouse.toNumber(),
      taxRateTakeout: setting.taxRateTakeout.toNumber(),
      taxInclusive: setting.taxInclusive,
      refreshTokenAutoExtend: setting.refreshTokenAutoExtend,
      refreshTokenExpiresMinutes: setting.refreshTokenExpiresMinutes,
    }
    fastify.io.to(`store:${request.storeId}`).emit('settings:updated', { storeName: result.storeName, closingTime: result.closingTime })
    return result
  })
}

export default settingsRoutes
