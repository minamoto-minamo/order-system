import { getSeatLabels, isGroupActive, isAdmin, formatDate } from '../lib/utils'
import type { Seat, Group, AuthUser } from '@order-system/shared'

const seats: Seat[] = [
  { id: 1, label: 'A1', type: 'counter', x: 0, y: 0, tableId: null },
  { id: 2, label: 'A2', type: 'counter', x: 1, y: 0, tableId: null },
  { id: 3, label: 'B1', type: 'table',   x: 0, y: 1, tableId: 1 },
]

describe('getSeatLabels', () => {
  it('指定IDの席ラベルを「・」区切りで返す', () => {
    expect(getSeatLabels(seats, [1, 2])).toBe('A1・A2')
  })

  it('マッチしないIDはスキップする', () => {
    expect(getSeatLabels(seats, [1, 99])).toBe('A1')
  })

  it('IDが空のとき空文字を返す', () => {
    expect(getSeatLabels(seats, [])).toBe('')
  })
})

describe('isGroupActive', () => {
  const base: Group = {
    id: 'uuid-group-1', name: 'G1', guestCount: 2, seatIds: [], sessionId: 1,
    courseId: null, drinkPlanId: null, createdAt: '2024-01-01T00:00:00.000Z',
    status: 'active',
  }

  it('active → true', () => {
    expect(isGroupActive({ ...base, status: 'active' })).toBe(true)
  })

  it('bill_requested → true', () => {
    expect(isGroupActive({ ...base, status: 'bill_requested' })).toBe(true)
  })

  it('closed → false', () => {
    expect(isGroupActive({ ...base, status: 'closed' })).toBe(false)
  })
})

describe('isAdmin', () => {
  it('admin ロールのユーザーは true', () => {
    const user: AuthUser = { id: 'uuid-staff-1', username: 'admin', role: 'admin' }
    expect(isAdmin(user)).toBe(true)
  })

  it('staff ロールのユーザーは false', () => {
    const user: AuthUser = { id: 'uuid-staff-2', username: 'staff', role: 'staff' }
    expect(isAdmin(user)).toBe(false)
  })

  it('null は false', () => {
    expect(isAdmin(null)).toBe(false)
  })

  it('undefined は false', () => {
    expect(isAdmin(undefined)).toBe(false)
  })
})

describe('formatDate', () => {
  it('ISO文字列を YYYY/MM/DD 形式にする', () => {
    expect(formatDate('2026-07-04T12:34:56.000Z')).toBe('2026/07/04')
  })

  it('月日を2桁にゼロ埋めする', () => {
    expect(formatDate('2026-01-05T00:00:00')).toBe('2026/01/05')
  })
})
