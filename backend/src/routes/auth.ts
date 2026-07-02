import type { FastifyPluginAsync } from 'fastify'
import rateLimit from '@fastify/rate-limit'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'
import { setAccessCookie, setRefreshCookie, clearAuthCookies } from '../plugins/auth.js'
import { issueRefreshToken, revokeTokenByRaw } from '../lib/refreshToken.js'

const loginBodySchema = {
  type: 'object',
  required: ['username', 'password'],
  properties: {
    username: { type: 'string', minLength: 1 },
    password: { type: 'string', minLength: 1 },
  },
  additionalProperties: false,
} as const

const authRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(rateLimit, { global: false })

  fastify.post('/login', {
    schema: { body: loginBodySchema },
    config: {
      rateLimit: {
        max: process.env.NODE_ENV === 'production' ? 5 : 1000,
        timeWindow: '1 minute',
        keyGenerator: (req) => req.ip,
        errorResponseBuilder: () => ({ error: 'ログイン試行回数が多すぎます。1分後に再試行してください。' }),
      },
    },
  }, async (request, reply) => {
    const { username, password } = request.body as { username: string; password: string }
    const user = await prisma.staff.findUnique({ where: { storeId_username: { storeId: request.storeId, username } } })
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return reply.status(401).send({ error: '認証情報が正しくありません' })
    }
    const token = fastify.jwt.sign(
      { type: 'staff', userId: user.id, username: user.username, role: user.role, storeId: user.storeId },
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN ?? '15m' }
    )
    const refreshToken = await issueRefreshToken(user.storeId, user.id, {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    })
    setAccessCookie(reply, token)
    setRefreshCookie(reply, refreshToken.raw, refreshToken.expiresAt)
    return { id: user.id, username: user.username, role: user.role }
  })

  fastify.post('/logout', async (request, reply) => {
    const rawRefreshToken = request.cookies.refresh_token
    if (rawRefreshToken) await revokeTokenByRaw(rawRefreshToken)
    clearAuthCookies(reply)
    return { ok: true }
  })

  fastify.get('/me', async (request, reply) => {
    if (request.user.type !== 'staff') return reply.status(401).send({ error: '認証が必要です' })
    return { id: request.user.userId, username: request.user.username, role: request.user.role }
  })
}

export default authRoutes
