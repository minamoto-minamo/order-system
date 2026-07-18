import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BaseButton, Icon } from '@/components/primitives'
import { ACTION_ICONS } from '@/lib/icons'
import { BottomSheetModal } from '../BottomSheetModal'

export function InputModal({
  title,
  sub,
  placeholder,
  initialValue = '',
  onConfirm,
  onClose,
  onDelete,
}: {
  title: string
  sub?: string
  placeholder: string
  initialValue?: string
  onConfirm: (val: string) => void
  onClose: () => void
  onDelete?: () => void
}) {
  const { t } = useTranslation()
  const inputId = useId()
  const [val, setVal] = useState(initialValue)
  return (
    <BottomSheetModal
      show
      onClose={onClose}
      secondaryAction={
        onDelete ? { label: t('common.delete'), onClick: onDelete, variant: 'danger' } : undefined
      }
      primaryAction={{
        label: t('common.confirm'),
        disabled: !val.trim(),
        onClick: () => val.trim() && onConfirm(val.trim()),
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-medium text-ink">{title}</div>
          {sub && <div className="text-label text-muted mt-0.5">{sub}</div>}
        </div>
        <BaseButton
          className="w-6 h-6 flex items-center justify-center rounded text-muted text-note"
          onClick={onClose}
          aria-label={t('common.close')}
        >
          <Icon src={ACTION_ICONS.close} />
        </BaseButton>
      </div>
      <label htmlFor={inputId} className="sr-only">
        {title}
      </label>
      <input
        id={inputId}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && val.trim() && onConfirm(val.trim())}
        placeholder={placeholder}
        className="input-field w-full border border-line rounded-[7px] px-3 py-2.25 text-sm outline-none text-ink mb-3.5"
      />
    </BottomSheetModal>
  )
}
