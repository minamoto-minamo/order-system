import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { Server } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from '@order-system/shared'
import { prisma } from '../lib/prisma.js'
import { toOrderItem } from '../lib/mappers.js'
import { corsOriginValidator, parseDurationSeconds } from '../lib/config.js'
import { resolveStoreContext } from '../lib/store.js'
import { verifyRefreshToken } from '../lib/refreshToken.js'
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
    expiresAt?: number
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
    socket.data.authenticated = false

    // @fastify/jwt のヘルパーは HTTP リクエストオブジェクト前提なので生ヘッダーから手動パース
    const cookieHeader = socket.handshake.headers.cookie ?? ''
    const cookies = new Map(
      cookieHeader.split(';').map(c => c.trim()).filter(Boolean).map(c => {
        const i = c.indexOf('=')
        return [c.slice(0, i), c.slice(i + 1)] as const
      })
    )

    const applyAuth = (payload: JwtPayload, exp: number) => {
      // Host 由来の storeId と JWT 内の storeId が一致しない場合はトークン再生とみなし未認証扱いにする
      socket.data.authenticated = payload.type === 'staff' && payload.storeId === context.storeId
      if (socket.data.authenticated) {
        socket.data.expiresAt = exp * 1000
      }
    }

    const token = cookies.get('token')
    if (token) {
      try {
        const payload = fastify.jwt.verify<JwtPayload>(token) as JwtPayload & { exp: number }
        applyAuth(payload, payload.exp)
        return next()
      } catch {
        // 期限切れ等の可能性があるため refresh_token での再認証を試みる
      }
    }

    // 直前に切断→再接続した際、ブラウザの token cookie がまだ更新されていないケースがあるため
    // refresh_token による透過的な再認証を試みる。
    // ここでローテーションすると新しいraw値をSet-Cookieできず（WebSocketハンドシェイクの制約）
    // ブラウザ側cookieとDB状態がずれてしまうため、消費しない読み取り専用検証のみ行う。
    // 実際のトークンローテーションはHTTPの /api/auth 系フローに委譲する
    const rawRefreshToken = cookies.get('refresh_token')
    if (!rawRefreshToken) return next()

    try {
      const outcome = await verifyRefreshToken(rawRefreshToken)
      if (outcome.status !== 'valid') return next()

      const staff = await prisma.staff.findFirst({ where: { id: outcome.staffId, storeId: context.storeId } })
      if (!staff) return next()

      const expiresInSeconds = parseDurationSeconds(process.env.ACCESS_TOKEN_EXPIRES_IN ?? '15m')
      applyAuth(
        { type: 'staff', userId: staff.id, username: staff.username, role: staff.role, storeId: staff.storeId },
        Math.floor(Date.now() / 1000) + expiresInSeconds,
      )
      next()
    } catch (e) {
      fastify.log.error(e, 'socket refresh-token verification error')
      next()
    }
  })

  io.on('connection', (socket) => {
    fastify.log.info(`client connected: ${socket.id}`)
    // スタッフ（認証済み）は店舗全体の可視性が必要なため store ルームに自動 join する。
    // 客用ゲスト接続は未認証のため、group:join で検証済みの自グループルームにのみ join させる
    if (socket.data.authenticated) {
      socket.join(`store:${socket.data.storeId}`)
    }

    // アクセストークン失効後も接続を維持したまま認証済み扱いになり続けないよう、
    // 有効期限で切断してクライアントの自動再接続時に再認証させる
    if (socket.data.authenticated && socket.data.expiresAt) {
      const timer = setTimeout(() => {
        socket.disconnect(true)
      }, Math.max(socket.data.expiresAt - Date.now(), 0))
      socket.on('disconnect', () => clearTimeout(timer))
    }

    // 客用ゲスト接続が自グループの更新のみ受信できるよう、group が自分の storeId に属することを検証してから join する
    socket.on('group:join', async (groupId) => {
      try {
        const group = await prisma.group.findFirst({ where: { id: groupId, storeId: socket.data.storeId } })
        if (!group) return
        socket.join(`group:${groupId}`)
      } catch (e) {
        fastify.log.error(e, 'group:join error')
      }
    })

    socket.on('order:complete', async (itemId) => {
      if (!socket.data.authenticated) return
      try {
        const order = await prisma.orderItem.findFirst({
          where: { id: itemId, storeId: socket.data.storeId },
          include: { group: { include: { session: true } } },
        })
        // ready/served になった注文を誤って戻さないよう pending のみ受け付ける
        if (!order || order.status !== 'pending') return
        // 会計済み（closed）のグループ・セッションの注文は状態を変更させない
        if (order.group.status === 'closed' || order.group.session.status === 'closed') return
        const updated = await prisma.orderItem.update({
          where: { id: itemId },
          data: { status: 'ready' },
        })
        io.to(`store:${socket.data.storeId}`).to(`group:${updated.groupId}`).emit('order:updated', toOrderItem(updated))
      } catch (e) {
        fastify.log.error(e, 'order:complete error')
        socket.emit('error', { message: '注文完了の処理に失敗しました' })
      }
    })

    socket.on('order:serve', async (itemId) => {
      if (!socket.data.authenticated) return
      try {
        const order = await prisma.orderItem.findFirst({
          where: { id: itemId, storeId: socket.data.storeId },
          include: { group: { include: { session: true } } },
        })
        // pending や served 状態への誤操作を防ぐため ready のみ受け付ける
        if (!order || order.status !== 'ready') return
        // 会計済み（closed）のグループ・セッションの注文は状態を変更させない
        if (order.group.status === 'closed' || order.group.session.status === 'closed') return
        const updated = await prisma.orderItem.update({
          where: { id: itemId },
          data: { status: 'served' },
        })
        io.to(`store:${socket.data.storeId}`).to(`group:${updated.groupId}`).emit('order:updated', toOrderItem(updated))
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
