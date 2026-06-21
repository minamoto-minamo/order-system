import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import cors from '@fastify/cors'
import { parseCorsOrigins } from '../lib/config.js'

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(cors, { origin: parseCorsOrigins(), credentials: true })
}

export default fp(corsPlugin)
