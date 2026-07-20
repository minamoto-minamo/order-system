import { describe, expect, it } from '@jest/globals'
import Fastify from 'fastify'

process.env.BASE_DOMAIN = 'example.com'

const { default: corsPlugin } = await import('../plugins/cors.js')

async function buildTestApp() {
  const app = Fastify({ logger: false })
  await app.register(corsPlugin)
  app.get('/api/health', async () => ({ status: 'ok' }))
  await app.ready()
  return app
}

describe('corsPlugin (統合)', () => {
  it('Origin storeA / Host storeB のリクエストには access-control-allow-origin を付与しない', async () => {
    const app = await buildTestApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { origin: 'https://storeA.example.com', host: 'storeB.example.com' },
    })
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
    await app.close()
  })

  it('Origin storeA / Host storeA のリクエストには access-control-allow-origin が付与される', async () => {
    const app = await buildTestApp()
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { origin: 'https://storeA.example.com', host: 'storeA.example.com' },
    })
    expect(res.headers['access-control-allow-origin']).toBe('https://storeA.example.com')
    await app.close()
  })
})
