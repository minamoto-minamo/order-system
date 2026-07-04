import { snap, hitTest } from '../pages/admin/SeatLayout/components/utils'
import type { TableData } from '../pages/admin/SeatLayout/components/types'

describe('snap', () => {
  it('グリッド幅の倍数に丸める', () => {
    expect(snap(50, 48)).toBe(48)
    expect(snap(70, 48)).toBe(48)
    expect(snap(73, 48)).toBe(96)
  })

  it('0 はそのまま 0', () => {
    expect(snap(0, 48)).toBe(0)
  })

  it('ちょうど中間は上に丸める', () => {
    expect(snap(24, 48)).toBe(48)
  })
})

describe('hitTest', () => {
  const table: TableData = { id: 1, label: 'T1', x: 48, y: 48, w: 96, h: 96 }

  it('テーブル内の座標は true', () => {
    expect(hitTest({ x: 48, y: 48 }, table)).toBe(true)
    expect(hitTest({ x: 96, y: 96 }, table)).toBe(true)
  })

  it('右端・下端（x+w, y+h）は含まない', () => {
    expect(hitTest({ x: 144, y: 48 }, table)).toBe(false)
    expect(hitTest({ x: 48, y: 144 }, table)).toBe(false)
  })

  it('テーブル外の座標は false', () => {
    expect(hitTest({ x: 0, y: 0 }, table)).toBe(false)
  })
})
