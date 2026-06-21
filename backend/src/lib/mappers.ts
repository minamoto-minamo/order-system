import type { OrderItemStatus } from '@order-system/shared'

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
