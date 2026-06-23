import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { Server } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from '@order-system/shared'
import { prisma } from '../lib/prisma.js'
import { toOrderItem } from '../lib/mappers.js'
import { parseCorsOrigins } from '../lib/config.js'

declare module 'fastify' {
  interface FastifyInstance {
    io: Server<ClientToServerEvents, ServerToClientEvents>
  }
}

const socketPlugin: FastifyPluginAsync = async (fastify) => {
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(fastify.server, {
    cors: { origin: parseCorsOrigins() },
  })
  fastify.decorate('io', io)

  // Socket.io は Fastify の preHandler フックとは独立して動くため個別に JWT 検証が必要
  io.use((socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie ?? ''
      // @fastify/jwt のヘルパーは HTTP リクエストオブジェクト前提なので生ヘッダーから手動パース
      const tokenCookie = cookieHeader
        .split(';')
        .map(c => c.trim())
        .find(c => c.startsWith('token='))
      if (!tokenCookie) return next(new Error('Unauthorized'))
      const token = tokenCookie.slice('token='.length)
      fastify.jwt.verify(token)
      next()
    } catch {
      next(new Error('Unauthorized'))
    }
  })

  io.on('connection', (socket) => {
    fastify.log.info(`client connected: ${socket.id}`)

    socket.on('order:complete', async (itemId) => {
      try {
        const order = await prisma.orderItem.findUnique({ where: { id: itemId } })
        // ready/served になった注文を誤って戻さないよう pending のみ受け付ける
        if (!order || order.status !== 'pending') return
        const updated = await prisma.orderItem.update({
          where: { id: itemId },
          data: { status: 'ready' },
        })
        io.emit('order:updated', toOrderItem(updated))
      } catch (e) {
        fastify.log.error(e, 'order:complete error')
      }
    })

    socket.on('order:serve', async (itemId) => {
      try {
        const order = await prisma.orderItem.findUnique({ where: { id: itemId } })
        // pending や served 状態への誤操作を防ぐため ready のみ受け付ける
        if (!order || order.status !== 'ready') return
        const updated = await prisma.orderItem.update({
          where: { id: itemId },
          data: { status: 'served' },
        })
        io.emit('order:updated', toOrderItem(updated))
      } catch (e) {
        fastify.log.error(e, 'order:serve error')
      }
    })

    socket.on('disconnect', () => {
      fastify.log.info(`client disconnected: ${socket.id}`)
    })
  })
}

export default fp(socketPlugin)
