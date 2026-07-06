import fp from 'fastify-plugin'
import { resolveStoreContext } from '../lib/store.js'
import { ErrorCodes, sendError } from '../lib/errors.js'

declare module 'fastify' {
  interface FastifyRequest {
    storeId: number
    isPlatformAdmin: boolean
  }
}

export default fp(async (fastify) => {
  fastify.decorateRequest('storeId', 0)
  fastify.decorateRequest('isPlatformAdmin', false)

  fastify.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/api/')) return

    const context = await resolveStoreContext(request.headers.host)

    if (context.kind === 'apex') {
      if (request.url === '/api/health') return
      return sendError(reply, 404, ErrorCodes.Common.UnknownStore, 'Not Found')
    }

    if (context.kind === 'platform') {
      if (!request.url.startsWith('/api/platform/')) {
        return sendError(reply, 404, ErrorCodes.Common.UnknownStore, 'Not Found')
      }
      request.isPlatformAdmin = true
      return
    }

    if (context.kind === 'store') {
      if (request.url.startsWith('/api/platform/')) {
        return sendError(reply, 404, ErrorCodes.Common.UnknownStore, 'Not Found')
      }
      request.storeId = context.storeId
      return
    }

    return sendError(reply, 404, ErrorCodes.Common.UnknownStore, 'Not Found')
  })
})
