import type { OrderItemStatus } from "@order-system/shared";

const STATUS: Record<OrderItemStatus, { cls: string; label: string }> = {
  pending:   { cls: "text-order-pending bg-order-pending-bg border-order-pending/60",   label: "未調理" },
  ready:     { cls: "text-order-ready   bg-order-ready-bg   border-order-ready/60",     label: "提供待ち" },
  served:    { cls: "text-muted         bg-surface-deep     border-muted/60",            label: "提供済み" },
  cancelled: { cls: "text-muted         bg-surface-deep     border-muted/60",            label: "キャンセル" },
};

export function StatusBadge({ status }: { status: OrderItemStatus }) {
  const s = STATUS[status] ?? STATUS.pending;
  return (
    <span className={`text-caption font-medium px-1.75 py-0.5 rounded-full border whitespace-nowrap ${s.cls}`}>
      {s.label}
    </span>
  );
}
