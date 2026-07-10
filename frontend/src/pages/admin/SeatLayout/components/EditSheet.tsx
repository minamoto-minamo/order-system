import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/composite'
import { BaseButton, Icon } from '@/components/primitives'
import { ACTION_ICONS } from '@/lib/icons'
import type { SeatData, SelectedItem, TableData } from './types'

interface Props {
  item: TableData | SeatData
  selected: SelectedItem
  onLabelChange: (val: string) => void
  onDelete: () => void
  onClose: () => void
  G: number
}

export function EditSheet({ item, selected, onLabelChange, onDelete, onClose, G }: Props) {
  const { t } = useTranslation()
  const labelInputId = useId()
  return (
    <div className="fixed bottom-0 left-0 right-0 z-modal flex justify-center pointer-events-none">
      <BottomSheet className="pointer-events-auto max-w-lg px-5 pt-4 pb-8 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-ink">
            {selected.kind === 'table' ? t('seatEditor.editTable') : t('seatEditor.editSeat')}
          </div>
          <BaseButton
            className="w-6 h-6 flex items-center justify-center rounded text-muted text-note"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <Icon src={ACTION_ICONS.close} />
          </BaseButton>
        </div>
        <label htmlFor={labelInputId} className="block text-label text-dim mb-1">
          {t('seatEditor.labelName')}
        </label>
        <input
          id={labelInputId}
          value={item.label}
          onChange={(e) => onLabelChange(e.target.value)}
          className="input-field w-full border border-line rounded-[7px] px-3 py-2.25 text-sm outline-none text-ink mb-3"
        />
        {selected.kind === 'table' && (
          <div className="text-caption text-dim mb-3 leading-[1.6]">
            {Math.round((item as TableData).w / G)} × {Math.round((item as TableData).h / G)}{' '}
            {t('seatEditor.cellUnit')}
            <span className="ml-1">{t('seatEditor.resizeHint')}</span>
          </div>
        )}
        {selected.kind === 'seat' && (
          <div className="text-caption text-dim mb-3 leading-[1.6]">
            {t('seatEditor.tableHint')}
          </div>
        )}
        <div className="flex gap-2">
          <BaseButton
            className="flex-1 py-2.25 border border-danger-border rounded-lg text-note text-danger bg-white"
            onClick={onDelete}
          >
            {t('common.delete')}
          </BaseButton>
          <BaseButton
            variant="primary"
            className="flex-1 py-2.25 rounded-lg text-note font-medium"
            onClick={onClose}
          >
            {t('common.confirm')}
          </BaseButton>
        </div>
      </BottomSheet>
    </div>
  )
}
