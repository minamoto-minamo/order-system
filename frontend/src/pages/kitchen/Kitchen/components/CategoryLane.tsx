import { useTranslation } from 'react-i18next'
import { TicketCard } from './TicketCard'
import './CategoryLane.scss'
import type { DisplayCat, DisplayOrder } from './types'

function SubLane({
  sub,
  orders,
  onComplete,
  onTicketClick,
}: {
  sub: { id: number; label: string }
  orders: DisplayOrder[]
  onComplete: (id: string) => void
  onTicketClick: (groupId: string) => void
}) {
  if (orders.length === 0) return null
  return (
    <div>
      <div className="text-caption text-muted tracking-widest pb-1.5 pl-0.5 flex items-center gap-1.5">
        <span>{sub.label}</span>
        <span className="bg-surface-deep text-muted text-micro px-1.5 py-px rounded-full">
          {orders.length}
        </span>
      </div>
      <div className="lane-scroll flex gap-2 overflow-x-auto pb-1.5">
        {orders.map((o) => (
          <TicketCard key={o.id} order={o} onComplete={onComplete} onClick={onTicketClick} />
        ))}
      </div>
    </div>
  )
}

export function CategoryLane({
  cat,
  orders,
  onComplete,
  onTicketClick,
}: {
  cat: DisplayCat
  orders: DisplayOrder[]
  onComplete: (id: string) => void
  onTicketClick: (groupId: string) => void
}) {
  const { t } = useTranslation()
  const catOrders = orders.filter((o) => o.catId === cat.id)
  if (catOrders.length === 0) return null
  return (
    <div className="bg-white border border-brand-border rounded-[10px] overflow-hidden animate-[fadeIn_0.3s_ease_both]">
      <div className="px-4 py-2.5 flex items-center gap-2 bg-brand">
        <span className="text-note font-medium text-white">{cat.label}</span>
        <span className="text-label px-2 py-px rounded-full bg-white/15 text-white">
          {t('kitchen.pendingCount', { count: catOrders.length })}
        </span>
      </div>
      <div className="px-4 py-3 flex flex-col gap-3.5">
        {cat.subs.map((sub) => (
          <SubLane
            key={sub.id}
            sub={sub}
            orders={catOrders.filter((o) => o.subId === sub.id)}
            onComplete={onComplete}
            onTicketClick={onTicketClick}
          />
        ))}
        {/* サブカテゴリ未設定またはDBから削除済みのサブカテゴリに属する注文を末尾にまとめる */}
        {catOrders.filter((o) => !cat.subs.find((s) => s.id === o.subId)).length > 0 && (
          <SubLane
            sub={{ id: 0, label: t('kitchen.otherCategory') }}
            orders={catOrders.filter((o) => !cat.subs.find((s) => s.id === o.subId))}
            onComplete={onComplete}
            onTicketClick={onTicketClick}
          />
        )}
      </div>
    </div>
  )
}
