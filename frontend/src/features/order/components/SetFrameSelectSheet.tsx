import type { MenuItem } from '@order-system/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheetModal } from '@/components/composite/BottomSheetModal'
import { ZeroStartStepper } from '@/components/primitives'
import type { OptionedOrderLine } from './OptionSelectSheet'

export function SetFrameSelectSheet({
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
  const allFramesSelected = item.setFrames.every((frame) => selected[frame.id] != null)
  const selectedChoices = item.setFrames.flatMap((frame) => {
    const choice = frame.choices.find((candidate) => candidate.id === selected[frame.id])
    return choice ? [{ groupName: frame.name, choiceName: choice.name, extraPrice: 0 }] : []
  })

  return (
    <BottomSheetModal
      show={open}
      scrollable
      onClose={onClose}
      primaryAction={{
        label: t('common.add'),
        disabled: !allFramesSelected || qty === 0,
        onClick: () =>
          onAdd({
            clientId: crypto.randomUUID(),
            item,
            qty,
            selectedChoiceIds: [],
            selectedFrameChoiceIds: Object.values(selected),
            options: selectedChoices,
          }),
      }}
      secondaryAction={{ label: t('common.cancel'), onClick: onClose }}
    >
      <div className="sticky top-0 bg-white px-5 py-4 border-b border-divider">
        <div className="text-sub font-medium text-ink">{item.name}</div>
      </div>
      <div className="px-5 py-3">
        {item.setFrames.map((frame) => (
          <fieldset key={frame.id} className="py-3 border-b border-surface">
            <legend className="text-note font-medium text-ink">{frame.name}</legend>
            <div className="mt-2 space-y-2">
              {frame.choices.map((choice) => (
                <label
                  key={choice.id}
                  className={`flex items-center gap-2 text-note text-ink ${choice.soldOut ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <input
                    type="radio"
                    name={`set-frame-${frame.id}`}
                    checked={selected[frame.id] === choice.id}
                    disabled={choice.soldOut}
                    onChange={() => setSelected((prev) => ({ ...prev, [frame.id]: choice.id }))}
                  />
                  <span className="flex-1">{choice.name}</span>
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
