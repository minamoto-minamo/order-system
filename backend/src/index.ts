import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '../env/backend.env') })

import { buildApp } from './app.js'

const app = await buildApp()

try {
  const port = Number(process.env.PORT ?? 3000)
  await app.listen({ port, host: '0.0.0.0' })
  console.log(`🍺 Server running on http://localhost:${port}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
