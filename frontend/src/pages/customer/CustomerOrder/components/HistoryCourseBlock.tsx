import type { OrderItem } from '@order-system/shared'

export function HistoryCourseBlock({ charge, dishes }: { charge: OrderItem; dishes: OrderItem[] }) {
  return (
    <div className="px-5 py-2 border-b border-surface bg-white">
      <div className="text-note text-secondary">
        {charge.menuItemName}
        <span className="text-label text-muted ml-1.5">×{charge.qty}</span>
      </div>
      <div className="mt-0.5 flex items-center justify-between text-label text-muted">
        <span>¥{charge.price.toLocaleString()}</span>
        <span>¥{(charge.price * charge.qty).toLocaleString()}</span>
      </div>
      {dishes.map((d) => (
        <div key={d.id} className="mt-1 text-note text-secondary">
          {d.menuItemName}
        </div>
      ))}
    </div>
  )
}
