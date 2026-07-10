import type { TableData } from './types'

export const snap = (v: number, g: number) => Math.round(v / g) * g

export function hitTest(seat: { x: number; y: number }, table: TableData) {
  return (
    seat.x >= table.x &&
    seat.x < table.x + table.w &&
    seat.y >= table.y &&
    seat.y < table.y + table.h
  )
}
