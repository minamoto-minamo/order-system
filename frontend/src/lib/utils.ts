import type { AuthUser, Group, Seat } from '@order-system/shared'

export function getSeatLabels(seats: Seat[], seatIds: number[]): string {
  return seats
    .filter((s) => seatIds.includes(s.id))
    .map((s) => s.label)
    .join('・')
}

export function isGroupActive(group: Group): boolean {
  return group.status !== 'closed'
}

export function isAdmin(user: AuthUser | null | undefined): boolean {
  return user?.role === 'admin'
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}
