import type { GroupStatus, OrderItemStatus } from '@order-system/shared'

export function toGroup(g: {
  id: number; name: string; guestCount: number; status: string; sessionId: number;
  courseId: number | null; drinkPlanId: number | null; createdAt: Date;
  seats: { seatId: number }[];
}) {
  return {
    id: g.id,
    name: g.name,
    guestCount: g.guestCount,
    seatIds: g.seats.map(s => s.seatId),
    // Prisma は string 型で返すが shared 型は union literal なのでキャストする
    status: g.status as GroupStatus,
    sessionId: g.sessionId,
    courseId: g.courseId,
    drinkPlanId: g.drinkPlanId,
    createdAt: g.createdAt.toISOString(),
  }
}

export function toCourse(c: {
  id: number; name: string; price: number; drinkPlanId: number | null;
  foodItems: { menuItemId: number; qty: number }[];
}) {
  return {
    id: c.id,
    name: c.name,
    price: c.price,
    drinkPlanId: c.drinkPlanId,
    foodItems: c.foodItems.map(f => ({ menuItemId: f.menuItemId, qty: f.qty })),
  }
}

export function toDrinkPlan(p: { id: number; name: string; items: { menuItemId: number }[] }) {
  return { id: p.id, name: p.name, menuItemIds: p.items.map(i => i.menuItemId) }
}

export function toOrderItem(o: {
  id: number; groupId: number; menuItemId: number; menuItemName: string; price: number;
  qty: number; status: string; isTakeout: boolean; courseId: number | null; orderedAt: Date;
}) {
  return {
    id: o.id,
    groupId: o.groupId,
    menuItemId: o.menuItemId,
    menuItemName: o.menuItemName,
    price: o.price,
    qty: o.qty,
    status: o.status as OrderItemStatus,
    isTakeout: o.isTakeout,
    courseId: o.courseId,
    orderedAt: o.orderedAt.toISOString(),
  }
}
