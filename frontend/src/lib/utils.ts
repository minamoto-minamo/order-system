import type { Seat, Group, AuthUser } from "@order-system/shared";

export function getSeatLabels(seats: Seat[], seatIds: number[]): string {
  return seats.filter(s => seatIds.includes(s.id)).map(s => s.label).join('・');
}

export function isGroupActive(group: Group): boolean {
  return group.status !== 'closed';
}

export function isAdmin(user: AuthUser | null | undefined): boolean {
  return user?.role === 'admin';
}
