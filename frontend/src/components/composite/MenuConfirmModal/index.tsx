import type { MenuItem } from '@order-system/shared'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/primitives'
import { SYMBOL_ICONS } from '@/lib/icons'
import { BottomSheetModal } from '../BottomSheetModal'

export interface OrderItem {
  item: MenuItem
  qty: number
  clientId?: string
  selectedChoiceIds?: number[]
  options?: { groupName: string; choiceName: string; extraPrice: number }[]
}

export function MenuConfirmModal({
  open,
  items,
  orderType,
  submitting,
  onClose,
  onConfirm,
}: {
  open: boolean
  items: OrderItem[]
  orderType: 'dine_in' | 'takeout'
  submitting?: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  const linePrice = (item: OrderItem) =>
    Math.max(
      0,
      item.item.price + (item.options ?? []).reduce((sum, option) => sum + option.extraPrice, 0),
    )
  const total = items.reduce((sum, item) => sum + linePrice(item) * item.qty, 0)
  return (
    <BottomSheetModal
      show={open}
      scrollable
      onClose={onClose}
      primaryAction={{
        label:
          orderType === 'takeout' ? (
            <span className="inline-flex items-center justify-center gap-1.5">
              <Icon src={SYMBOL_ICONS.takeout} />
              {t('group.confirmOrderTakeout')}
            </span>
          ) : (
            t('group.confirmOrderDineIn')
          ),
        variant: orderType === 'takeout' ? 'takeout' : 'default',
        disabled: submitting,
        onClick: onConfirm,
      }}
    >
      <div className="sticky top-0 bg-white px-5 py-4 border-b border-divider">
        <div className="text-sub font-medium text-ink">{t('group.reviewTitle')}</div>
      </div>
      <div className="px-5">
        {items.map((orderItem) => (
          <div
            key={orderItem.clientId ?? orderItem.item.id}
            className="flex items-center py-3.5 border-b border-surface gap-3"
          >
            <div className="flex-1 text-note text-ink">
              <div>{orderItem.item.name}</div>
              {(orderItem.options ?? []).map((option) => (
                <div key={option.groupName} className="text-xs text-muted">
                  {option.groupName}: {option.choiceName}
                </div>
              ))}
            </div>
            <span className="text-note text-muted shrink-0">×{orderItem.qty}</span>
            <span className="text-note text-ink w-20 text-right shrink-0">
              ¥{(linePrice(orderItem) * orderItem.qty).toLocaleString()}
            </span>
          </div>
        ))}
        <div className="flex items-center py-3.5 gap-3">
          <span className="flex-1 text-note font-medium text-ink">{t('group.total')}</span>
          <span className="text-note font-medium text-ink">¥{total.toLocaleString()}</span>
        </div>
      </div>
    </BottomSheetModal>
  )
}
