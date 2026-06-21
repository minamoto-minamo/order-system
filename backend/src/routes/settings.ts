import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { requireAdmin } from '../plugins/auth.js'

const DEFAULT_SETTING = {
  id: 1,
  storeName: '居酒屋',
  closingTime: '23:00',
  taxRateInHouse: 10,
  taxRateTakeout: 8,
}

const updateBodySchema = {
  type: 'object',
  properties: {
    storeName: { type: 'string', minLength: 1 },
    closingTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
    taxRateInHouse: { type: 'integer', minimum: 0, maximum: 100 },
    taxRateTakeout: { type: 'integer', minimum: 0, maximum: 100 },
  },
  additionalProperties: false,
} as const

const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => {
    const setting = await prisma.setting.findUnique({ where: { id: 1 } }) ?? DEFAULT_SETTING
    return {
      storeName: setting.storeName,
      closingTime: setting.closingTime,
      taxRateInHouse: setting.taxRateInHouse,
      taxRateTakeout: setting.taxRateTakeout,
    }
  })

  fastify.put('/', { schema: { body: updateBodySchema }, preHandler: requireAdmin }, async (request) => {
    const body = request.body as Partial<{
      storeName: string; closingTime: string;
      taxRateInHouse: number; taxRateTakeout: number;
    }>
    const setting = await prisma.setting.upsert({
      where: { id: 1 },
      update: body,
      create: { ...DEFAULT_SETTING, ...body },
    })
    const result = {
      storeName: setting.storeName,
      closingTime: setting.closingTime,
      taxRateInHouse: setting.taxRateInHouse,
      taxRateTakeout: setting.taxRateTakeout,
    }
    fastify.io.emit('settings:updated', result)
    return result
  })
}

export default settingsRoutes
