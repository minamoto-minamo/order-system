import { getSeatStatus, buildGroupName } from '../pages/hall/Hall/components/hallUtils'
import type { Seat, SeatTable, Group } from '@order-system/shared'

const seats: Seat[] = [
  { id: 1, label: 'S1', type: 'counter', x: 0, y: 0, tableId: null },
  { id: 2, label: 'S2', type: 'counter', x: 1, y: 0, tableId: null },
  { id: 3, label: 'T1-1', type: 'table', x: 0, y: 1, tableId: 10 },
  { id: 4, label: 'T1-2', type: 'table', x: 1, y: 1, tableId: 10 },
]

const tables: SeatTable[] = [
  { id: 10, label: '卓1', x: 0, y: 1, w: 2, h: 1 },
]

const baseGroup: Group = {
  id: 'uuid-group-1', name: 'G1', guestCount: 2, seatIds: [], sessionId: 1,
  courseId: null, drinkPlanId: null, createdAt: '2024-01-01T00:00:00.000Z',
  status: 'active',
}

describe('getSeatStatus', () => {
  it('どのグループにも属さない席は empty', () => {
    expect(getSeatStatus(seats[0], [])).toBe('empty')
  })

  it('active グループの席は occupied', () => {
    const groups = [{ ...baseGroup, seatIds: [1] }]
    expect(getSeatStatus(seats[0], groups)).toBe('occupied')
  })

  it('bill_requested グループの席は bill', () => {
    const groups: Group[] = [{ ...baseGroup, seatIds: [1], status: 'bill_requested' }]
    expect(getSeatStatus(seats[0], groups)).toBe('bill')
  })

  it('closed グループの席は empty', () => {
    const groups: Group[] = [{ ...baseGroup, seatIds: [1], status: 'closed' }]
    expect(getSeatStatus(seats[0], groups)).toBe('empty')
  })
})

describe('buildGroupName', () => {
  it('席IDが空なら空文字', () => {
    expect(buildGroupName([], seats, tables)).toBe('')
  })

  it('単独席はラベルを「・」区切りで並べる', () => {
    expect(buildGroupName([1, 2], seats, tables)).toBe('S1・S2')
  })

  it('同じテーブルの席はテーブルラベル1つにまとめる', () => {
    expect(buildGroupName([3, 4], seats, tables)).toBe('卓1')
  })

  it('テーブルラベルを先に、単独席を後ろに並べる', () => {
    expect(buildGroupName([1, 3, 4], seats, tables)).toBe('卓1・S1')
  })

  it('存在しない席IDはスキップする', () => {
    expect(buildGroupName([1, 99], seats, tables)).toBe('S1')
  })
})
