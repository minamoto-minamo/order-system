import { useTranslation } from 'react-i18next'
import { BaseButton } from '@/components/primitives'
import type { Product, SetFrameForm } from './types'

let nextClientId = 0
const createClientId = () => `set-frame-${nextClientId++}`

export function SetFrameEditor({
  setFrames,
  products,
  onChange,
}: {
  setFrames: SetFrameForm[]
  products: Product[]
  onChange: (setFrames: SetFrameForm[]) => void
}) {
  const { t } = useTranslation()
  const selectableProducts = products.filter((product) => !product.isSet)
  const updateFrame = (index: number, frame: SetFrameForm) =>
    onChange(setFrames.map((current, currentIndex) => (currentIndex === index ? frame : current)))

  return (
    <div className="border-t border-divider pt-3 mt-3">
      <div className="text-caption text-muted mb-2">{t('productSettings.setFrames')}</div>
      <div className="space-y-3">
        {setFrames.map((frame, frameIndex) => (
          <div key={frame.clientId} className="rounded-lg border border-line p-2.5">
            <div className="flex gap-2">
              <input
                value={frame.name}
                onChange={(event) =>
                  updateFrame(frameIndex, { ...frame, name: event.target.value })
                }
                placeholder={t('productSettings.setFrameNamePlaceholder')}
                className="input-field min-w-0 flex-1 border border-line rounded-[7px] px-2.5 py-1.75 text-xs outline-none text-ink"
              />
              <BaseButton
                className="shrink-0 text-caption text-danger"
                onClick={() => onChange(setFrames.filter((_, index) => index !== frameIndex))}
              >
                {t('common.delete')}
              </BaseButton>
            </div>
            <div className="mt-2 space-y-1.5">
              {frame.choices.map((choice, choiceIndex) => (
                <div key={choice.clientId} className="flex gap-1.5">
                  <select
                    value={choice.menuItemId}
                    onChange={(event) => {
                      const choices = frame.choices.map((current, currentIndex) =>
                        currentIndex === choiceIndex
                          ? { ...current, menuItemId: Number(event.target.value) }
                          : current,
                      )
                      updateFrame(frameIndex, { ...frame, choices })
                    }}
                    className="input-field min-w-0 flex-1 border border-line rounded-[7px] px-2 py-1.5 text-xs outline-none text-ink bg-white"
                  >
                    {selectableProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                  <BaseButton
                    className="shrink-0 text-caption text-danger"
                    onClick={() =>
                      updateFrame(frameIndex, {
                        ...frame,
                        choices: frame.choices.filter((_, index) => index !== choiceIndex),
                      })
                    }
                  >
                    {t('common.delete')}
                  </BaseButton>
                </div>
              ))}
            </div>
            <BaseButton
              className="mt-2 text-caption text-info"
              disabled={selectableProducts.length === 0}
              onClick={() =>
                updateFrame(frameIndex, {
                  ...frame,
                  choices: [
                    ...frame.choices,
                    {
                      clientId: createClientId(),
                      menuItemId: selectableProducts[0]?.id ?? 0,
                      sort: frame.choices.length,
                    },
                  ],
                })
              }
            >
              {t('productSettings.addSetFrameChoice')}
            </BaseButton>
          </div>
        ))}
      </div>
      <BaseButton
        className="mt-2 text-caption text-info"
        onClick={() =>
          onChange([
            ...setFrames,
            { clientId: createClientId(), name: '', sort: setFrames.length, choices: [] },
          ])
        }
      >
        {t('productSettings.addSetFrame')}
      </BaseButton>
    </div>
  )
}
