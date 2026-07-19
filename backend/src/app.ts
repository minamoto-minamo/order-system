import staticPlugin from '@fastify/static'
import type { FastifyError } from 'fastify'
import Fastify from 'fastify'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { ErrorCodes, errorBody, sendError } from './lib/errors.js'
import { prisma } from './lib/prisma.js'
import authPlugin from './plugins/auth.js'
import corsPlugin from './plugins/cors.js'
import socketPlugin from './plugins/socket.js'
import storePlugin from './plugins/store.js'
import authRoutes from './routes/auth.js'
import categoriesRoutes from './routes/categories.js'
import coursesRoutes from './routes/courses.js'
import customerRoutes from './routes/customer.js'
import drinkPlansRoutes from './routes/drinkPlans.js'
import groupsRoutes from './routes/groups.js'
import menusRoutes from './routes/menus.js'
import ordersRoutes from './routes/orders.js'
import platformAuthRoutes from './routes/platformAuth.js'
import platformStoresRoutes from './routes/platformStores.js'
import seatLayoutRoutes from './routes/seatLayout.js'
import seatsRoutes from './routes/seats.js'
import sessionsRoutes from './routes/sessions.js'
import settingsRoutes from './routes/settings.js'
import staffRoutes from './routes/staff.js'
import subcategoriesRoutes from './routes/subcategories.js'

// ESM では __dirname が存在しないため import.meta.url から生成
const __dirname = dirname(fileURLToPath(import.meta.url))

export async function buildApp() {
  const app = Fastify({ logger: true, trustProxy: true })

  // 登録順: cors → store → socket → auth の順を守る
  // store は Host から storeId を解決し以降のフックに供給するため socket/auth より前、
  // socket は CORS 設定を参照するため cors より後、auth はルート登録前に必要
  await app.register(corsPlugin)
  await app.register(storePlugin)
  await app.register(socketPlugin)
  await app.register(authPlugin)

  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error(error)
    if (error.validation) {
      return sendError(
        reply,
        400,
        ErrorCodes.Common.ValidationFailed,
        'リクエストの形式が正しくありません',
        { validation: error.validation },
      )
    }
    return sendError(
      reply,
      500,
      ErrorCodes.Common.InternalServerError,
      'サーバーエラーが発生しました',
    )
  })

  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.register(platformAuthRoutes, { prefix: '/api/platform/auth' })
  await app.register(platformStoresRoutes, { prefix: '/api/platform/stores' })
  await app.register(sessionsRoutes, { prefix: '/api/sessions' })
  await app.register(seatsRoutes, { prefix: '/api/seats' })
  await app.register(groupsRoutes, { prefix: '/api/groups' })
  await app.register(ordersRoutes, { prefix: '/api/orders' })
  await app.register(menusRoutes, { prefix: '/api/menus' })
  await app.register(categoriesRoutes, { prefix: '/api/categories' })
  await app.register(subcategoriesRoutes, { prefix: '/api/subcategories' })
  await app.register(drinkPlansRoutes, { prefix: '/api/drink-plans' })
  await app.register(coursesRoutes, { prefix: '/api/courses' })
  await app.register(settingsRoutes, { prefix: '/api/settings' })
  await app.register(staffRoutes, { prefix: '/api/staff' })
  await app.register(seatLayoutRoutes, { prefix: '/api/seat-layout' })
  await app.register(customerRoutes, { prefix: '/api/customer' })

  app.get('/api/health', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      return { status: 'ok' }
    } catch {
      return sendError(reply, 503, ErrorCodes.Common.DatabaseUnavailable, 'database unavailable')
    }
  })

  const frontendDist = resolve(__dirname, '../../frontend/dist')
  await app.register(staticPlugin, { root: frontendDist, prefix: '/' })
  // React Router のクライアントサイドルーティングに対応するため未知パスを index.html にフォールバック
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.status(404).send(errorBody(ErrorCodes.Common.NotFound, 'Not Found'))
    }
    reply.sendFile('index.html')
  })

  return app
}
