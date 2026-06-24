import { useTranslation } from "react-i18next";
import { elapsed, timeStr, elapsedColor } from "./utils";
import "./TicketCard.scss";
import type { DisplayOrder } from "./types";

export function TicketCard({ order, accentColor, onComplete, onClick }: {
  order: DisplayOrder;
  accentColor: string;
  onComplete: (id: number) => void;
  onClick: (groupId: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="ticket-card bg-white border border-divider rounded-b-lg px-3 py-2.5 w-37 shrink-0 shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
      onClick={() => onClick(order.groupId)}
      style={{ borderTop: `3px solid ${accentColor}` }}
    >
      <div className="mb-1.5">
        <div className="text-label font-medium text-secondary">{order.groupName}</div>
        <div className="text-caption text-dim">{order.seats}</div>
      </div>
      <div className="text-sm font-medium text-ink mb-px">{order.item}</div>
      <div className="text-xs text-muted mb-2">×{order.qty}</div>
      <div className="flex items-baseline gap-1.25 mb-2.25">
        <span className="text-xs font-medium" style={{ color: elapsedColor(order.orderedAt) }}>
          {elapsed(order.orderedAt)}
        </span>
        <span className="text-caption text-dim">{timeStr(order.orderedAt)}</span>
      </div>
      <button
        className="complete-btn w-full bg-surface-deep border border-line rounded-[5px] py-1.25 text-label text-secondary"
        onClick={(e) => { e.stopPropagation(); onComplete(order.id); }}
      >
        {t('kitchen.complete')}
      </button>
    </div>
  );
}
