import cors from '@fastify/cors'
import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { corsOriginValidator } from '../lib/config.js'

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  // delegator でリクエストごとの Host ヘッダーを origin 判定に渡す（Origin と Host のテナント一致を検証するため）
  // credentials: true は httpOnly cookie を cross-origin で送受信するために必要
  await fastify.register(cors, {
    delegator: (request, callback) => {
      callback(null, {
        origin: (origin, originCallback) =>
          corsOriginValidator(origin, request.headers.host, originCallback),
        credentials: true,
      })
    },
  })
}

export default fp(corsPlugin)
