import type { ClientToServerEvents, ServerToClientEvents } from '@order-system/shared'
import { io, type Socket } from 'socket.io-client'

// 開発時は Vite が /socket.io を localhost:3000 にプロキシするため空文字列で動作する
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? ''

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(BACKEND_URL)
