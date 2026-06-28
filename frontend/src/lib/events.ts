import type { ServerToClientEvents, ClientToServerEvents } from '@order-system/shared'

type S2C = keyof ServerToClientEvents
type C2S = keyof ClientToServerEvents

// 引数が実際のイベント名であることを型レベルで強制するヘルパー
const s = <K extends S2C>(k: K): K => k
const c = <K extends C2S>(k: K): K => k

export const SOCKET_EVENTS = {
  orderCreated:    s('order:created'),
  orderUpdated:    s('order:updated'),
  orderCancelled:  s('order:cancelled'),
  groupCreated:    s('group:created'),
  groupUpdated:    s('group:updated'),
  seatCreated:     s('seat:created'),
  seatUpdated:     s('seat:updated'),
  menuSoldout:     s('menu:soldout'),
  sessionUpdated:  s('session:updated'),
  settingsUpdated: s('settings:updated'),
  orderComplete:   c('order:complete'),
  orderServe:      c('order:serve'),
  staffCalled:     s('staff:called'),
} as const
