import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { Server } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from '@order-system/shared'
import { prisma } from '../lib/prisma.js'
import { toOrderItem } from '../lib/mappers.js'
import { corsOriginValidator } from '../lib/config.js'
import { resolveStoreContext } from '../lib/store.js'
import type { JwtPayload } from './auth.js'

declare module 'fastify' {
  interface FastifyInstance {
    io: Server<ClientToServerEvents, ServerToClientEvents>
  }
}

declare module 'socket.io' {
  interface SocketData {
    authenticated: boolean
    storeId: number
  }
}

const socketPlugin: FastifyPluginAsync = async (fastify) => {
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(fastify.server, {
    cors: { origin: corsOriginValidator, credentials: true },
  })
  fastify.decorate('io', io)

  // Socket.io は Fastify の preHandler フックとは独立して動くため個別に Host 解決・JWT 検証が必要
  // 顧客向け画面はゲスト接続を許可し、socket.data.authenticated で権限を区別する
  io.use(async (socket, next) => {
    const context = await resolveStoreContext(socket.handshake.headers.host)
    if (context.kind !== 'store') {
      next(new Error('unknown store'))
      return
    }
    socket.data.storeId = context.storeId

    try {
      const cookieHeader = socket.handshake.headers.cookie ?? ''
      // @fastify/jwt のヘルパーは HTTP リクエストオブジェクト前提なので生ヘッダーから手動パース
      const tokenCookie = cookieHeader
        .split(';')
        .map(c => c.trim())
        .find(c => c.startsWith('token='))
      if (!tokenCookie) {
        socket.data.authenticated = false
        return next()
      }
      const token = tokenCookie.slice('token='.length)
      const payload = fastify.jwt.verify<JwtPayload>(token)
      // Host 由来の storeId と JWT 内の storeId が一致しない場合はトークン再生とみなし未認証扱いにする
      socket.data.authenticated = payload.type === 'staff' && payload.storeId === context.storeId
      next()
    } catch {
      socket.data.authenticated = false
      next()
    }
  })

  io.on('connection', (socket) => {
    fastify.log.info(`client connected: ${socket.id}`)
    if (socket.data.authenticated) {
      socket.join(`store:${socket.data.storeId}`)
    }

    socket.on('order:complete', async (itemId) => {
      if (!socket.data.authenticated) return
      try {
        const order = await prisma.orderItem.findFirst({ where: { id: itemId, storeId: socket.data.storeId } })
        // ready/served になった注文を誤って戻さないよう pending のみ受け付ける
        if (!order || order.status !== 'pending') return
        const updated = await prisma.orderItem.update({
          where: { id: itemId },
          data: { status: 'ready' },
        })
        io.to(`store:${socket.data.storeId}`).emit('order:updated', toOrderItem(updated))
      } catch (e) {
        fastify.log.error(e, 'order:complete error')
        socket.emit('error', { message: '注文完了の処理に失敗しました' })
      }
    })

    socket.on('order:serve', async (itemId) => {
      if (!socket.data.authenticated) return
      try {
        const order = await prisma.orderItem.findFirst({ where: { id: itemId, storeId: socket.data.storeId } })
        // pending や served 状態への誤操作を防ぐため ready のみ受け付ける
        if (!order || order.status !== 'ready') return
        const updated = await prisma.orderItem.update({
          where: { id: itemId },
          data: { status: 'served' },
        })
        io.to(`store:${socket.data.storeId}`).emit('order:updated', toOrderItem(updated))
      } catch (e) {
        fastify.log.error(e, 'order:serve error')
        socket.emit('error', { message: '提供完了の処理に失敗しました' })
      }
    })

    socket.on('disconnect', () => {
      fastify.log.info(`client disconnected: ${socket.id}`)
    })
  })
}

export default fp(socketPlugin)
