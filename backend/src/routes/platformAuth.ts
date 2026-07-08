import type { FastifyPluginAsync } from 'fastify'
import rateLimit from '@fastify/rate-limit'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'
import { setPlatformAccessCookie, clearPlatformAuthCookie, requirePlatformAdmin } from '../plugins/auth.js'
import { ErrorCodes, errorBody, sendError } from '../lib/errors.js'

const DUMMY_PASSWORD_HASH = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8O.MSTGeVWmSVmDsBiAGXH6XHJXxYm'

const loginBodySchema = {
  type: 'object',
  required: ['username', 'password'],
  properties: {
    username: { type: 'string', minLength: 1 },
    password: { type: 'string', minLength: 1 },
  },
  additionalProperties: false,
} as const

const platformAuthRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(rateLimit, { global: false })

  fastify.post('/login', {
    schema: { body: loginBodySchema },
    config: {
      rateLimit: {
        max: process.env.NODE_ENV === 'production' ? 5 : 1000,
        timeWindow: '1 minute',
        keyGenerator: (req) => req.ip,
        errorResponseBuilder: () => errorBody(ErrorCodes.Auth.RateLimited, 'ログイン試行回数が多すぎます。1分後に再試行してください。'),
      },
    },
  }, async (request, reply) => {
    const { username, password } = request.body as { username: string; password: string }
    const admin = await prisma.platformAdmin.findUnique({ where: { username } })
    const passwordValid = admin
      ? await bcrypt.compare(password, admin.passwordHash)
      : await bcrypt.compare(password, DUMMY_PASSWORD_HASH)
    if (!admin || !passwordValid) {
      return sendError(reply, 401, ErrorCodes.Auth.InvalidCredentials, '認証情報が正しくありません')
    }
    const token = fastify.jwt.sign(
      { type: 'platform', adminId: admin.id, username: admin.username },
      { expiresIn: '8h' }
    )
    setPlatformAccessCookie(reply, token)
    return { id: admin.id, username: admin.username }
  })

  fastify.post('/logout', async (_request, reply) => {
    clearPlatformAuthCookie(reply)
    return { ok: true }
  })

  fastify.get('/me', { preHandler: requirePlatformAdmin }, async (request, reply) => {
    if (request.user.type !== 'platform') return sendError(reply, 401, ErrorCodes.Auth.Required, '認証が必要です')
    return { id: request.user.adminId, username: request.user.username }
  })
}

export default platformAuthRoutes
