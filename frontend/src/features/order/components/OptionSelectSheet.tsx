import type { MenuItem } from '@order-system/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheetModal } from '@/components/composite/BottomSheetModal'
import { ZeroStartStepper } from '@/components/primitives'

export type OptionedOrderLine = {
  clientId: string
  item: MenuItem
  qty: number
  selectedChoiceIds: number[]
  options: { groupName: string; choiceName: string; extraPrice: number }[]
}

export function OptionSelectSheet({
  item,
  open,
  onClose,
  onAdd,
}: {
  item: MenuItem | null
  open: boolean
  onClose: () => void
  onAdd: (line: OptionedOrderLine) => void
}) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<Record<number, number>>({})
  const [qty, setQty] = useState(1)

  if (!item) return null
  const requiredSelected = item.optionGroups
    .filter((group) => group.required)
    .every((group) => selected[group.id] != null)
  const selectedOptions = item.optionGroups.flatMap((group) => {
    const choice = group.choices.find((candidate) => candidate.id === selected[group.id])
    return choice
      ? [{ groupName: group.name, choiceName: choice.name, extraPrice: choice.extraPrice }]
      : []
  })

  return (
    <BottomSheetModal
      show={open}
      scrollable
      onClose={onClose}
      primaryAction={{
        label: t('common.add'),
        disabled: !requiredSelected || qty === 0,
        onClick: () =>
          onAdd({
            clientId: crypto.randomUUID(),
            item,
            qty,
            selectedChoiceIds: Object.values(selected),
            options: selectedOptions,
          }),
      }}
      secondaryAction={{ label: t('common.cancel'), onClick: onClose }}
    >
      <div className="sticky top-0 bg-white px-5 py-4 border-b border-divider">
        <div className="text-sub font-medium text-ink">{item.name}</div>
      </div>
      <div className="px-5 py-3">
        {item.optionGroups.map((group) => (
          <fieldset key={group.id} className="py-3 border-b border-surface">
            <legend className="text-note font-medium text-ink">
              {group.name}
              {group.required && (
                <span className="ml-1 text-danger text-xs">{t('orderOption.required')}</span>
              )}
            </legend>
            <div className="mt-2 space-y-2">
              {group.choices.map((choice) => (
                <label
                  key={choice.id}
                  className="flex items-center gap-2 text-note text-ink cursor-pointer"
                >
                  <input
                    type="radio"
                    name={`option-group-${group.id}`}
                    checked={selected[group.id] === choice.id}
                    onChange={() => setSelected((prev) => ({ ...prev, [group.id]: choice.id }))}
                  />
                  <span className="flex-1">{choice.name}</span>
                  <span className="text-muted">
                    {choice.extraPrice === 0
                      ? '¥0'
                      : `${choice.extraPrice > 0 ? '+' : ''}¥${choice.extraPrice.toLocaleString()}`}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <div className="flex items-center justify-between py-4">
          <span className="text-note text-ink">{t('orderOption.qty')}</span>
          <ZeroStartStepper qty={qty} onChange={setQty} />
        </div>
      </div>
    </BottomSheetModal>
  )
}
