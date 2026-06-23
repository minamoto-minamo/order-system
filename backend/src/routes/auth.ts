import type { FastifyPluginAsync } from 'fastify'
import rateLimit from '@fastify/rate-limit'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'

function parseDurationSeconds(d: string): number {
  const m = d.match(/^(\d+)([smhd])$/)
  if (!m) return 60 * 60 * 24 * 7
  const n = Number(m[1])
  return { s: 1, m: 60, h: 3600, d: 86400 }[m[2] as 's'|'m'|'h'|'d'] * n
}

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
    const user = await prisma.staff.findUnique({ where: { username } })
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return reply.status(401).send({ error: '認証情報が正しくありません' })
    }
    const expiresIn = process.env.JWT_EXPIRES_IN ?? '8h'
    const token = fastify.jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      { expiresIn }
    )
    const maxAge = parseDurationSeconds(expiresIn)
    reply.setCookie('token', token, {
      httpOnly: true,
      path: '/',
      maxAge,
      sameSite: 'lax',
      // 開発環境は http のため secure を外す（本番は https 必須）
      secure: process.env.NODE_ENV === 'production',
    })
    return { id: user.id, username: user.username, role: user.role }
  })

  fastify.post('/logout', async (_request, reply) => {
    reply.clearCookie('token', { path: '/' })
    return { ok: true }
  })

  fastify.get('/me', async (request) => {
    return { id: request.user.userId, username: request.user.username, role: request.user.role }
  })
}

export default authRoutes
