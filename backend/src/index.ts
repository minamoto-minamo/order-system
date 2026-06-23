import { config } from 'dotenv'
import { resolve } from 'path'

// app.ts のインポート前に dotenv を実行して env 変数を確保する（import 時点で参照されるため）
config({ path: resolve(process.cwd(), '../env/backend.env') })

import { buildApp } from './app.js'

const app = await buildApp()

try {
  const port = Number(process.env.PORT ?? 3000)
  // 0.0.0.0 でバインドしないとコンテナ外からアクセスできない
  await app.listen({ port, host: '0.0.0.0' })
  console.log(`🍺 Server running on http://localhost:${port}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
