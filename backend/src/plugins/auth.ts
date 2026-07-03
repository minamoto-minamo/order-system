import fp from 'fastify-plugin'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { parseDurationSeconds } from '../lib/config.js'
import { rotateRefreshToken } from '../lib/refreshToken.js'

export type JwtPayload =
  | { type: 'staff'; userId: string; username: string; role: string; storeId: number }
  | { type: 'platform'; adminId: string; username: string }

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload
    user: JwtPayload
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user || request.user.type !== 'staff') return reply.status(401).send({ error: '認証が必要です' })
  if (request.user.role !== 'admin') {
    return reply.status(403).send({ error: '権限がありません' })
  }
}

export async function requirePlatformAdmin(request: FastifyRequest, reply: FastifyReply) {
  const token = request.cookies.platform_token
  if (!token) return reply.status(401).send({ error: '認証が必要です' })
  try {
    const payload = request.server.jwt.verify<JwtPayload>(token)
    if (payload.type !== 'platform') return reply.status(401).send({ error: '認証が必要です' })
    request.user = payload
  } catch {
    return reply.status(401).send({ error: '認証が必要です' })
  }
}

const COOKIE_OPTS = {
  httpOnly: true,
  path: '/',
  sameSite: 'lax' as const,
  // 開発環境は http のため secure を外す（本番は https 必須）
  secure: process.env.NODE_ENV === 'production',
}

export function setAccessCookie(reply: FastifyReply, accessToken: string) {
  const maxAge = parseDurationSeconds(process.env.ACCESS_TOKEN_EXPIRES_IN ?? '15m')
  reply.setCookie('token', accessToken, { ...COOKIE_OPTS, maxAge })
}

export function setRefreshCookie(reply: FastifyReply, refreshToken: string, expiresAt: Date) {
  const maxAge = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
  reply.setCookie('refresh_token', refreshToken, { ...COOKIE_OPTS, maxAge })
}

export function clearAuthCookies(reply: FastifyReply) {
  reply.clearCookie('token', { path: '/' })
  reply.clearCookie('refresh_token', { path: '/' })
}

export function setPlatformAccessCookie(reply: FastifyReply, token: string) {
  reply.setCookie('platform_token', token, { ...COOKIE_OPTS, maxAge: 8 * 60 * 60 })
}

export function clearPlatformAuthCookie(reply: FastifyReply) {
  reply.clearCookie('platform_token', { path: '/' })
}

function signAccessToken(fastify: FastifyInstance, payload: JwtPayload): string {
  return fastify.jwt.sign(payload, { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN ?? '15m' })
}

export default fp(async (fastify) => {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET が未設定です。.env を確認してください。')

  await fastify.register(cookie)
  await fastify.register(jwt, {
    secret,
    // JWT 自体が署名済みのため cookie 署名は二重になるだけで不要
    cookie: { cookieName: 'token', signed: false },
  })

  fastify.addHook('preHandler', async (request, reply) => {
    // login/logout はトークン取得・破棄エンドポイントなので認証前にアクセス可能にする
    // platform 系はプラットフォーム管理者専用の認証（requirePlatformAdmin）で個別に検証する
    if (
      !request.url.startsWith('/api/') ||
      request.url.startsWith('/api/platform/') ||
      request.url === '/api/auth/login' ||
      request.url === '/api/auth/logout' ||
      request.url === '/api/health' ||
      request.url.startsWith('/api/customer/')
    ) return

    try {
      await request.jwtVerify()
      // staff 以外（platform管理者トークン等）でのアクセス、または Host 由来の storeId と
      // JWT 内の storeId が一致しない場合はトークン再生・誤用とみなす
      if (request.user.type !== 'staff' || request.user.storeId !== request.storeId) {
        clearAuthCookies(reply)
        return reply.status(401).send({ error: '認証が必要です' })
      }
      return
    } catch {
      // アクセストークン失効時、refresh_token cookie があれば透過的にリフレッシュを試みる
    }

    const rawRefreshToken = request.cookies.refresh_token
    if (!rawRefreshToken) {
      clearAuthCookies(reply)
      return reply.status(401).send({ error: '認証が必要です' })
    }

    const outcome = await rotateRefreshToken(request.storeId, rawRefreshToken, {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    })

    if (outcome.status !== 'rotated' && outcome.status !== 'reused') {
      clearAuthCookies(reply)
      return reply.status(401).send({ error: '認証が必要です' })
    }

    const staff = await prisma.staff.findFirst({ where: { id: outcome.staffId, storeId: request.storeId } })
    if (!staff) {
      clearAuthCookies(reply)
      return reply.status(401).send({ error: '認証が必要です' })
    }

    const payload: JwtPayload = { type: 'staff', userId: staff.id, username: staff.username, role: staff.role, storeId: staff.storeId }
    const accessToken = signAccessToken(fastify, payload)
    request.user = payload
    setAccessCookie(reply, accessToken)
    if (outcome.status === 'rotated') {
      setRefreshCookie(reply, outcome.token.raw, outcome.token.expiresAt)
    }
  })
})
