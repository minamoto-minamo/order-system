import { useTranslation } from 'react-i18next'
import { elapsed, elapsedColor, timeStr } from './utils'
import './TicketCard.scss'
import type { DisplayOrder } from './types'

export function TicketCard({
  order,
  onComplete,
  onClick,
}: {
  order: DisplayOrder
  onComplete: (id: string) => void
  onClick: (groupId: string) => void
}) {
  const { t } = useTranslation()
  const openGroup = () => onClick(order.groupId)
  return (
    <div
      className="ticket-card bg-white border border-divider rounded-lg px-3 py-2.5 w-44 shrink-0 shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
      role="button"
      aria-label={t('kitchen.openGroupDetail')}
      tabIndex={0}
      onClick={openGroup}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openGroup()
        }
      }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-caption font-medium text-ink truncate">{order.groupName}</div>
          <div className="text-caption text-dim truncate">{order.seats}</div>
        </div>
        <div className="shrink-0 text-right">
          <div
            className="text-xs font-medium leading-tight"
            style={{ color: elapsedColor(order.orderedAt) }}
          >
            {elapsed(order.orderedAt)}
          </div>
          <div className="text-caption text-dim leading-tight">{timeStr(order.orderedAt)}</div>
        </div>
      </div>
      <div className="mb-2.5 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-caption font-medium text-ink">{order.item}</div>
          {order.options.map((option) => (
            <div key={option.groupName} className="truncate text-xs text-muted">
              {option.groupName}: {option.choiceName}
            </div>
          ))}
        </div>
        <div className="shrink-0 rounded-full bg-surface-deep px-2 py-0.5 text-caption text-secondary">
          ×{order.qty}
        </div>
      </div>
      <button
        type="button"
        className="complete-btn w-full bg-surface-deep border border-line rounded-md py-3 text-caption leading-4 text-secondary"
        onClick={(e) => {
          e.stopPropagation()
          onComplete(order.id)
        }}
      >
        {t('kitchen.complete')}
      </button>
    </div>
  )
}
