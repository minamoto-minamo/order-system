import type { StaffRole } from '@prisma/client'
import bcrypt from 'bcryptjs'
import type { FastifyPluginAsync } from 'fastify'
import { ErrorCodes, sendError } from '../lib/errors.js'
import { toStaffSession } from '../lib/mappers.js'
import { prisma } from '../lib/prisma.js'
import { listActiveSessions, revokeTokenById } from '../lib/refreshToken.js'
import { requireAdmin } from '../plugins/auth.js'

const createBodySchema = {
  type: 'object',
  required: ['username', 'password', 'role'],
  properties: {
    username: { type: 'string', minLength: 1 },
    password: { type: 'string', minLength: 8, maxLength: 100 },
    role: { type: 'string', enum: ['admin', 'staff'] },
  },
  additionalProperties: false,
} as const

const updateBodySchema = {
  type: 'object',
  properties: {
    username: { type: 'string', minLength: 1 },
    password: { type: 'string', minLength: 8, maxLength: 100 },
    role: { type: 'string', enum: ['admin', 'staff'] },
  },
  additionalProperties: false,
} as const

// passwordHash をレスポンスに含めないための明示的な select
const select = { id: true, username: true, role: true, createdAt: true }

const staffRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: requireAdmin }, async (request) => {
    return prisma.staff.findMany({
      where: { storeId: request.storeId },
      select,
      orderBy: { createdAt: 'asc' },
    })
  })

  fastify.post(
    '/',
    { schema: { body: createBodySchema }, preHandler: requireAdmin },
    async (request, reply) => {
      const { username, password, role } = request.body as {
        username: string
        password: string
        role: StaffRole
      }
      const existing = await prisma.staff.findUnique({
        where: { storeId_username: { storeId: request.storeId, username } },
      })
      if (existing)
        return sendError(
          reply,
          409,
          ErrorCodes.Staff.DuplicateUsername,
          'そのユーザー名は既に使用されています',
        )
      const passwordHash = await bcrypt.hash(password, 12)
      const member = await prisma.staff.create({
        data: { username, passwordHash, role, storeId: request.storeId },
        select,
      })
      return reply.status(201).send(member)
    },
  )

  fastify.put(
    '/:id',
    { schema: { body: updateBodySchema }, preHandler: requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const body = request.body as { username?: string; password?: string; role?: StaffRole }
      const existing = await prisma.staff.findFirst({ where: { id, storeId: request.storeId } })
      if (!existing)
        return sendError(reply, 404, ErrorCodes.Staff.NotFound, 'スタッフが見つかりません')
      const data: Record<string, unknown> = {}
      if (body.username !== undefined) {
        const dup = await prisma.staff.findFirst({
          where: { username: body.username, storeId: request.storeId, NOT: { id } },
        })
        if (dup)
          return sendError(
            reply,
            409,
            ErrorCodes.Staff.DuplicateUsername,
            'そのユーザー名は既に使用されています',
          )
        data.username = body.username
      }
      if (body.password) data.passwordHash = await bcrypt.hash(body.password, 12)
      const roleChanged = body.role !== undefined && body.role !== existing.role
      if (body.role) data.role = body.role
      const updated = await prisma.staff.update({ where: { id }, data, select })
      // ロール変更は権限に直結するため、降格・昇格前の権限で操作が継続できないよう既存接続を切断する
      if (roleChanged) fastify.io.in(`user:${id}`).disconnectSockets(true)
      return updated
    },
  )

  fastify.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    if (request.user.type === 'staff' && id === request.user.userId) {
      return sendError(reply, 422, ErrorCodes.Staff.CannotDeleteSelf, '自分自身は削除できません')
    }
    const existing = await prisma.staff.findFirst({ where: { id, storeId: request.storeId } })
    if (!existing)
      return sendError(reply, 404, ErrorCodes.Staff.NotFound, 'スタッフが見つかりません')
    await prisma.staff.delete({ where: { id } })
    fastify.io.in(`user:${id}`).disconnectSockets(true)
    return reply.status(204).send()
  })

  fastify.get('/:id/sessions', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = await prisma.staff.findFirst({ where: { id, storeId: request.storeId } })
    if (!existing)
      return sendError(reply, 404, ErrorCodes.Staff.NotFound, 'スタッフが見つかりません')
    const sessions = await listActiveSessions(id)
    return sessions.map(toStaffSession)
  })

  fastify.delete(
    '/:id/sessions/:sessionId',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id, sessionId } = request.params as { id: string; sessionId: string }
      const existing = await prisma.staff.findFirst({ where: { id, storeId: request.storeId } })
      if (!existing)
        return sendError(reply, 404, ErrorCodes.Staff.NotFound, 'スタッフが見つかりません')
      const revoked = await revokeTokenById(id, sessionId)
      if (!revoked)
        return sendError(reply, 404, ErrorCodes.Staff.SessionNotFound, 'セッションが見つかりません')
      return reply.status(204).send()
    },
  )
}

export default staffRoutes
