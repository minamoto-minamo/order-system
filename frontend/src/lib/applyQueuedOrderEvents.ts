import type { OrderItem } from '@order-system/shared'

export type QueuedOrderEvent =
  | { type: 'created'; item: OrderItem }
  | { type: 'updated'; item: OrderItem }
  | { type: 'cancelled'; id: string }

// fetchAll 実行中に受信した注文関連Socketイベントを、RESTスナップショット取得後に
// 受信順で再適用する。合成規則は GroupDetail.tsx の3ハンドラ（created/updated/cancelled）と同一。
export function applyQueuedOrderEvents(base: OrderItem[], events: QueuedOrderEvent[]): OrderItem[] {
  return events.reduce((items, event) => {
    switch (event.type) {
      case 'created':
        return items.some((i) => i.id === event.item.id) ? items : items.concat(event.item)
      case 'updated':
        return items.map((i) => (i.id === event.item.id ? event.item : i))
      case 'cancelled':
        return items.map((i) => (i.id === event.id ? { ...i, status: 'cancelled' as const } : i))
    }
  }, base)
}
