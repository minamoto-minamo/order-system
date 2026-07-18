import type { ClientToServerEvents, ServerToClientEvents } from '@order-system/shared'

type S2C = keyof ServerToClientEvents
type C2S = keyof ClientToServerEvents

// 引数が実際のイベント名であることを型レベルで強制するヘルパー
const s = <K extends S2C>(k: K): K => k
const c = <K extends C2S>(k: K): K => k

export const SOCKET_EVENTS = {
  orderCreated: s('order:created'),
  orderUpdated: s('order:updated'),
  orderCancelled: s('order:cancelled'),
  groupCreated: s('group:created'),
  groupUpdated: s('group:updated'),
  seatCreated: s('seat:created'),
  seatUpdated: s('seat:updated'),
  menuSoldout: s('menu:soldout'),
  menuCreated: s('menu:created'),
  menuUpdated: s('menu:updated'),
  menuDeleted: s('menu:deleted'),
  courseCreated: s('course:created'),
  courseUpdated: s('course:updated'),
  courseDeleted: s('course:deleted'),
  drinkPlanCreated: s('drinkPlan:created'),
  drinkPlanUpdated: s('drinkPlan:updated'),
  drinkPlanDeleted: s('drinkPlan:deleted'),
  seatLayoutUpdated: s('seatLayout:updated'),
  sessionUpdated: s('session:updated'),
  settingsUpdated: s('settings:updated'),
  orderComplete: c('order:complete'),
  orderServe: c('order:serve'),
  groupJoin: c('group:join'),
  staffCalled: s('staff:called'),
  error: s('error'),
} as const
