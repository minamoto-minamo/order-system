import fp from 'fastify-plugin'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import type { FastifyRequest, FastifyReply } from 'fastify'

export interface JwtPayload {
  userId: number
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
    return reply.status(403).send({ error: 'Forbidden' })
  }
}

export default fp(async (fastify) => {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET が未設定です。.env を確認してください。')

  await fastify.register(cookie)
  await fastify.register(jwt, {
    secret,
    cookie: { cookieName: 'token', signed: false },
  })

  fastify.addHook('preHandler', async (request, reply) => {
    if (request.url === '/api/auth/login' || request.url === '/api/auth/logout') return
    try {
      await request.jwtVerify()
    } catch {
      reply.status(401).send({ error: 'Unauthorized' })
    }
  })
})
