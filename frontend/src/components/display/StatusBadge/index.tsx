import { useTranslation } from "react-i18next";
import type { OrderItemStatus } from "@order-system/shared";

const STATUS = {
  pending:   { cls: "text-order-pending bg-order-pending-bg border-order-pending/60",   labelKey: "kitchen.pending" },
  ready:     { cls: "text-order-ready   bg-order-ready-bg   border-order-ready/60",     labelKey: "common.readyToServe" },
  served:    { cls: "text-muted         bg-surface-deep     border-muted/60",            labelKey: "group.served" },
  cancelled: { cls: "text-muted         bg-surface-deep     border-muted/60",            labelKey: "group.cancelled" },
} as const satisfies Record<OrderItemStatus, { cls: string; labelKey: string }>;

export function StatusBadge({ status }: { status: OrderItemStatus }) {
  const { t } = useTranslation();
  const s = STATUS[status] ?? STATUS.pending;
  return (
    <span className={`text-caption font-medium px-1.75 py-0.5 rounded-full border whitespace-nowrap ${s.cls}`}>
      {t(s.labelKey)}
    </span>
  );
}
