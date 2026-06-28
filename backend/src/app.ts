import Fastify from 'fastify'
import staticPlugin from '@fastify/static'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import corsPlugin from './plugins/cors.js'
import socketPlugin from './plugins/socket.js'
import authPlugin from './plugins/auth.js'
import authRoutes from './routes/auth.js'
import sessionsRoutes from './routes/sessions.js'
import seatsRoutes from './routes/seats.js'
import groupsRoutes from './routes/groups.js'
import ordersRoutes from './routes/orders.js'
import menusRoutes from './routes/menus.js'
import categoriesRoutes from './routes/categories.js'
import subcategoriesRoutes from './routes/subcategories.js'
import drinkPlansRoutes from './routes/drinkPlans.js'
import coursesRoutes from './routes/courses.js'
import settingsRoutes from './routes/settings.js'
import staffRoutes from './routes/staff.js'
import seatTablesRoutes from './routes/seatTables.js'
import seatLayoutRoutes from './routes/seatLayout.js'
import customerRoutes from './routes/customer.js'

// ESM では __dirname が存在しないため import.meta.url から生成
const __dirname = dirname(fileURLToPath(import.meta.url))

export async function buildApp() {
  const app = Fastify({ logger: true })

  // 登録順: cors → socket → auth の順を守る
  // socket は CORS 設定を参照するため cors より後、auth はルート登録前に必要
  await app.register(corsPlugin)
  await app.register(socketPlugin)
  await app.register(authPlugin)

  await app.register(authRoutes,        { prefix: '/api/auth' })
  await app.register(sessionsRoutes,    { prefix: '/api/sessions' })
  await app.register(seatsRoutes,       { prefix: '/api/seats' })
  await app.register(groupsRoutes,      { prefix: '/api/groups' })
  await app.register(ordersRoutes,      { prefix: '/api/orders' })
  await app.register(menusRoutes,       { prefix: '/api/menus' })
  await app.register(categoriesRoutes,  { prefix: '/api/categories' })
  await app.register(subcategoriesRoutes, { prefix: '/api/subcategories' })
  await app.register(drinkPlansRoutes,  { prefix: '/api/drink-plans' })
  await app.register(coursesRoutes,     { prefix: '/api/courses' })
  await app.register(settingsRoutes,    { prefix: '/api/settings' })
  await app.register(staffRoutes,        { prefix: '/api/staff' })
  await app.register(seatTablesRoutes,   { prefix: '/api/seat-tables' })
  await app.register(seatLayoutRoutes,   { prefix: '/api/seat-layout' })
  await app.register(customerRoutes,     { prefix: '/api/customer' })

  app.get('/api/health', async () => ({ status: 'ok' }))

  const frontendDist = resolve(__dirname, '../../frontend/dist')
  await app.register(staticPlugin, { root: frontendDist, prefix: '/' })
  // React Router のクライアントサイドルーティングに対応するため未知パスを index.html にフォールバック
  app.setNotFoundHandler((_request, reply) => {
    reply.sendFile('index.html')
  })

  return app
}
