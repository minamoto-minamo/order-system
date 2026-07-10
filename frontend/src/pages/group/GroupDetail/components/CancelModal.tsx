import type { OrderItem } from '@order-system/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheetModal } from '@/components/composite'
import { QuantityPicker } from '@/components/primitives'

export function CancelModal({
  item,
  disabled,
  onConfirm,
  onClose,
}: {
  item: OrderItem
  disabled?: boolean
  onConfirm: (id: string, cancelQty: number) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [qty, setQty] = useState(1)
  const isMulti = item.qty >= 2

  return (
    <BottomSheetModal
      show={true}
      onClose={onClose}
      secondaryAction={{ label: t('common.back'), onClick: onClose }}
      primaryAction={{
        label: isMulti ? t('group.cancelQty', { qty }) : t('group.cancelConfirm'),
        variant: 'danger',
        disabled,
        onClick: () => onConfirm(item.id, isMulti ? qty : 1),
      }}
    >
      <div className="text-sub font-medium text-ink mb-1">{item.menuItemName}</div>
      <div className="text-xs text-muted mb-5">
        {isMulti ? t('group.cancelSelectQty') : t('group.cancelQuestion')}
      </div>
      {isMulti && (
        <div className="mb-6">
          <div className="text-label text-muted mb-4">
            {t('group.currentQty', { qty: item.qty })}
          </div>
          <QuantityPicker value={qty} onChange={setQty} min={1} max={item.qty} />
          {qty === item.qty && (
            <div className="text-label text-bill mt-3">{t('group.cancelAll')}</div>
          )}
        </div>
      )}
    </BottomSheetModal>
  )
}
