import type { FastifyPluginAsync } from 'fastify'
import rateLimit from '@fastify/rate-limit'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'
import { setAccessCookie, setRefreshCookie, clearAuthCookies, type JwtPayload } from '../plugins/auth.js'
import { issueRefreshToken, revokeTokenByRaw, verifyRefreshToken } from '../lib/refreshToken.js'
import { ErrorCodes, errorBody, sendError } from '../lib/errors.js'

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
        errorResponseBuilder: () => errorBody(ErrorCodes.Auth.RateLimited, 'ログイン試行回数が多すぎます。1分後に再試行してください。'),
      },
    },
  }, async (request, reply) => {
    const { username, password } = request.body as { username: string; password: string }
    const user = await prisma.staff.findUnique({ where: { storeId_username: { storeId: request.storeId, username } } })
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return sendError(reply, 401, ErrorCodes.Auth.InvalidCredentials, '認証情報が正しくありません')
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
    // 共有端末での操作継続を防ぐため、同一ユーザーの Socket.io 接続も強制切断する。
    // アクセストークンが失効していても切断できるよう、refresh_token → access token の順で userId を解決する
    let userId: string | undefined
    const rawRefreshToken = request.cookies.refresh_token
    if (rawRefreshToken) {
      const outcome = await verifyRefreshToken(rawRefreshToken)
      if (outcome.status === 'valid') userId = outcome.staffId
      await revokeTokenByRaw(rawRefreshToken)
    }
    if (!userId && request.cookies.token) {
      try {
        const payload = fastify.jwt.verify<JwtPayload>(request.cookies.token)
        if (payload.type === 'staff') userId = payload.userId
      } catch {
        // 期限切れ・改ざん等は無視（切断対象が特定できないだけで、cookie 削除自体は継続する）
      }
    }
    if (userId) fastify.io.in(`user:${userId}`).disconnectSockets(true)
    clearAuthCookies(reply)
    return { ok: true }
  })

  fastify.get('/me', async (request, reply) => {
    if (request.user.type !== 'staff') return sendError(reply, 401, ErrorCodes.Auth.Required, '認証が必要です')
    return { id: request.user.userId, username: request.user.username, role: request.user.role }
  })
}

export default authRoutes
