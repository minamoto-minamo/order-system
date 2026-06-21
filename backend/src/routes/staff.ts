import type { FastifyPluginAsync } from 'fastify'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'
import { requireAdmin } from '../plugins/auth.js'

const createBodySchema = {
  type: 'object',
  required: ['username', 'password', 'role'],
  properties: {
    username: { type: 'string', minLength: 1 },
    password: { type: 'string', minLength: 1 },
    role:     { type: 'string', enum: ['admin', 'staff'] },
  },
  additionalProperties: false,
} as const

const updateBodySchema = {
  type: 'object',
  properties: {
    username: { type: 'string', minLength: 1 },
    password: { type: 'string', minLength: 1 },
    role:     { type: 'string', enum: ['admin', 'staff'] },
  },
  additionalProperties: false,
} as const

const select = { id: true, username: true, role: true, createdAt: true }

const staffRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: requireAdmin }, async () => {
    return prisma.staff.findMany({ select, orderBy: { createdAt: 'asc' } })
  })

  fastify.post('/', { schema: { body: createBodySchema }, preHandler: requireAdmin }, async (request, reply) => {
    const { username, password, role } = request.body as { username: string; password: string; role: string }
    const existing = await prisma.staff.findUnique({ where: { username } })
    if (existing) return reply.status(409).send({ error: 'そのユーザー名は既に使用されています' })
    const passwordHash = await bcrypt.hash(password, 12)
    const member = await prisma.staff.create({ data: { username, passwordHash, role }, select })
    return reply.status(201).send(member)
  })

  fastify.put('/:id', { schema: { body: updateBodySchema }, preHandler: requireAdmin }, async (request, reply) => {
    const id = Number((request.params as { id: string }).id)
    const body = request.body as { username?: string; password?: string; role?: string }
    const existing = await prisma.staff.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'スタッフが見つかりません' })
    const data: Record<string, unknown> = {}
    if (body.username !== undefined) {
      const dup = await prisma.staff.findFirst({ where: { username: body.username, NOT: { id } } })
      if (dup) return reply.status(409).send({ error: 'そのユーザー名は既に使用されています' })
      data.username = body.username
    }
    if (body.password) data.passwordHash = await bcrypt.hash(body.password, 12)
    if (body.role) data.role = body.role
    return prisma.staff.update({ where: { id }, data, select })
  })

  fastify.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const id = Number((request.params as { id: string }).id)
    if (id === request.user.userId) {
      return reply.status(400).send({ error: '自分自身は削除できません' })
    }
    const existing = await prisma.staff.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'スタッフが見つかりません' })
    await prisma.staff.delete({ where: { id } })
    return reply.status(204).send()
  })
}

export default staffRoutes
