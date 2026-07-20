import { useTranslation } from 'react-i18next'
import { BaseButton } from '@/components/primitives'
import type { OptionGroupForm } from './types'

let nextClientId = 0
const createClientId = () => `option-${nextClientId++}`

export function OptionGroupEditor({
  optionGroups,
  onChange,
}: {
  optionGroups: OptionGroupForm[]
  onChange: (optionGroups: OptionGroupForm[]) => void
}) {
  const { t } = useTranslation()

  const updateGroup = (index: number, group: OptionGroupForm) =>
    onChange(
      optionGroups.map((current, currentIndex) => (currentIndex === index ? group : current)),
    )

  return (
    <div className="border-t border-divider pt-3 mt-3">
      <div className="text-caption text-muted mb-2">{t('productSettings.optionGroups')}</div>
      <div className="space-y-3">
        {optionGroups.map((group, groupIndex) => (
          <div key={group.clientId} className="rounded-lg border border-line p-2.5">
            <div className="flex gap-2">
              <input
                value={group.name}
                onChange={(event) =>
                  updateGroup(groupIndex, { ...group, name: event.target.value })
                }
                placeholder={t('productSettings.optionGroupNamePlaceholder')}
                className="input-field min-w-0 flex-1 border border-line rounded-[7px] px-2.5 py-1.75 text-xs outline-none text-ink"
              />
              <BaseButton
                className="shrink-0 text-caption text-danger"
                onClick={() => onChange(optionGroups.filter((_, index) => index !== groupIndex))}
              >
                {t('common.delete')}
              </BaseButton>
            </div>
            <label className="flex items-center gap-1.5 text-caption text-muted mt-2">
              <input
                type="checkbox"
                checked={group.required}
                onChange={(event) =>
                  updateGroup(groupIndex, { ...group, required: event.target.checked })
                }
              />
              {t('productSettings.optionRequired')}
            </label>

            <div className="mt-2 space-y-1.5">
              {group.choices.map((choice, choiceIndex) => (
                <div key={choice.clientId} className="flex gap-1.5">
                  <input
                    value={choice.name}
                    onChange={(event) => {
                      const choices = group.choices.map((current, currentIndex) =>
                        currentIndex === choiceIndex
                          ? { ...current, name: event.target.value }
                          : current,
                      )
                      updateGroup(groupIndex, { ...group, choices })
                    }}
                    placeholder={t('productSettings.optionChoiceNamePlaceholder')}
                    className="input-field min-w-0 flex-1 border border-line rounded-[7px] px-2 py-1.5 text-xs outline-none text-ink"
                  />
                  <input
                    type="number"
                    value={choice.extraPrice}
                    onChange={(event) => {
                      const choices = group.choices.map((current, currentIndex) =>
                        currentIndex === choiceIndex
                          ? { ...current, extraPrice: Number(event.target.value) }
                          : current,
                      )
                      updateGroup(groupIndex, { ...group, choices })
                    }}
                    aria-label={t('productSettings.optionExtraPrice')}
                    className="input-field w-20 border border-line rounded-[7px] px-2 py-1.5 text-xs outline-none text-ink"
                  />
                  <BaseButton
                    className="shrink-0 text-caption text-danger"
                    onClick={() =>
                      updateGroup(groupIndex, {
                        ...group,
                        choices: group.choices.filter((_, index) => index !== choiceIndex),
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
              onClick={() =>
                updateGroup(groupIndex, {
                  ...group,
                  choices: [
                    ...group.choices,
                    {
                      clientId: createClientId(),
                      name: '',
                      extraPrice: 0,
                      sort: group.choices.length,
                    },
                  ],
                })
              }
            >
              {t('productSettings.addOptionChoice')}
            </BaseButton>
          </div>
        ))}
      </div>
      <BaseButton
        className="mt-2 text-caption text-info"
        onClick={() =>
          onChange([
            ...optionGroups,
            {
              clientId: createClientId(),
              name: '',
              required: false,
              sort: optionGroups.length,
              choices: [],
            },
          ])
        }
      >
        {t('productSettings.addOptionGroup')}
      </BaseButton>
    </div>
  )
}
