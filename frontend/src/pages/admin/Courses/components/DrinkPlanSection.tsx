import type { DrinkPlan, MenuItem } from '@order-system/shared'
import { useTranslation } from 'react-i18next'

export function DrinkPlanSection({
  drinkPlans,
  menus,
  onAdd,
  onEdit,
}: {
  drinkPlans: DrinkPlan[]
  menus: MenuItem[]
  onAdd: () => void
  onEdit: (plan: DrinkPlan) => void
}) {
  const { t } = useTranslation()

  return (
    <section className="px-5 pt-5 pb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-note font-medium text-ink">{t('courses.drinkPlanSection')}</h2>
        <button type="button" className="text-note text-info" onClick={onAdd}>
          {t('courses.addDrinkPlan')}
        </button>
      </div>
      {drinkPlans.length === 0 ? (
        <p className="text-xs text-muted py-2">{t('courses.noDrinkPlans')}</p>
      ) : (
        drinkPlans.map((plan) => (
          <div key={plan.id} className="py-3 border-b border-surface flex items-start gap-3">
            <div className="flex-1">
              <div className="flex items-baseline gap-2 mb-1.5">
                <span className="text-note text-ink">{plan.name}</span>
                <span className="text-xs text-muted">¥{plan.price.toLocaleString()}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {plan.menuItemIds.map((mid) => {
                  const name =
                    menus.find((m) => m.id === mid)?.name ?? t('common.unknownItem', { id: mid })
                  return (
                    <span
                      key={mid}
                      className="text-caption text-dim bg-surface border border-divider px-1.75 py-0.5 rounded-full"
                    >
                      {name}
                    </span>
                  )
                })}
              </div>
            </div>
            <button
              type="button"
              className="text-xs text-info shrink-0 pt-0.5"
              onClick={() => onEdit(plan)}
            >
              {t('common.edit')}
            </button>
          </div>
        ))
      )}
    </section>
  )
}
