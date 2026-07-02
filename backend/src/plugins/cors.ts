import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import cors from '@fastify/cors'
import { corsOriginValidator } from '../lib/config.js'

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  // credentials: true は httpOnly cookie を cross-origin で送受信するために必要
  await fastify.register(cors, { origin: corsOriginValidator, credentials: true })
}

export default fp(corsPlugin)
