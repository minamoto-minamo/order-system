import fp from 'fastify-plugin'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import type { FastifyRequest, FastifyReply } from 'fastify'

export interface JwtPayload {
  userId: string
  username: string
  role: string
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload
    user: JwtPayload
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (request.user?.role !== 'admin') {
    return reply.status(403).send({ error: '権限がありません' })
  }
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
    if (!request.url.startsWith('/api/') || request.url === '/api/auth/login' || request.url === '/api/auth/logout' || request.url === '/api/health') return
    try {
      await request.jwtVerify()
    } catch {
      reply.status(401).send({ error: '認証が必要です' })
    }
  })
})
