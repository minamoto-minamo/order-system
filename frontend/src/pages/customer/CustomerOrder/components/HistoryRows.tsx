import { useTranslation } from 'react-i18next'

export type ItemGroup = { key: string; menuItemName: string; price: number; totalQty: number }

export function ActiveItemRow({ group }: { group: ItemGroup }) {
  const { t } = useTranslation()
  return (
    <div className="px-5 py-2 border-b border-surface flex items-center gap-2.5 bg-white">
      <div className="flex-1">
        <div className="text-note text-ink mb-0.5">
          {group.menuItemName}
          <span className="text-label text-muted ml-1.5">×{group.totalQty}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-caption text-muted">{t('customerOrder.notServed')}</span>
          <span className="text-label text-muted">¥{group.price.toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}

export function ServedItemRow({ group }: { group: ItemGroup }) {
  return (
    <div className="px-5 py-2 border-b border-surface flex items-center gap-2 bg-white">
      <div className="flex-1">
        <div className="text-note text-secondary">
          {group.menuItemName}
          <span className="text-label text-muted ml-1.5">×{group.totalQty}</span>
        </div>
        <div className="text-label text-muted mt-0.5">
          ¥{group.price.toLocaleString()} · ¥{(group.price * group.totalQty).toLocaleString()}
        </div>
      </div>
    </div>
  )
}
