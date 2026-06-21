import { io, Socket } from 'socket.io-client'
import type { ServerToClientEvents, ClientToServerEvents } from '@order-system/shared'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? ''

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(BACKEND_URL)
