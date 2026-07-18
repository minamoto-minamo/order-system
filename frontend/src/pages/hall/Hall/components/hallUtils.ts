import type { Group, Seat, SeatTable } from '@order-system/shared'
import { isGroupActive } from '@/lib/utils'
import type { SeatStatus } from './FloorSeat'

export function getSeatStatus(seat: Seat, groups: Group[]): SeatStatus {
  const g = groups.find((gr) => gr.seatIds.includes(seat.id) && isGroupActive(gr))
  if (!g) return 'empty'
  if (g.status === 'bill_requested') return 'bill'
  return 'occupied'
}

// グループ名を席ラベルから自動生成。テーブル単位のラベルを先にまとめ、単独席を後ろに並べる
export function buildGroupName(seatIds: number[], seats: Seat[], tables: SeatTable[]): string {
  if (seatIds.length === 0) return ''
  const seenTableIds = new Set<number>()
  const tableParts: string[] = []
  const standaloneParts: string[] = []
  for (const id of seatIds) {
    const seat = seats.find((s) => s.id === id)
    if (!seat) continue
    if (seat.tableId !== null) {
      if (!seenTableIds.has(seat.tableId)) {
        seenTableIds.add(seat.tableId)
        const table = tables.find((t) => t.id === seat.tableId)
        if (table) tableParts.push(table.label)
      }
    } else {
      standaloneParts.push(seat.label)
    }
  }
  return [...tableParts, ...standaloneParts].join('・')
}
