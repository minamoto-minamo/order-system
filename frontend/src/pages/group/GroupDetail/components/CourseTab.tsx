import { BaseButton, Icon, QuantityPicker } from '@/components/primitives'
import { SYMBOL_ICONS } from '@/lib/icons'
import type { Category, Course, DrinkPlan, MenuItem } from '@order-system/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface CourseTabProps {
  courses: Course[]
  drinkPlans: DrinkPlan[]
  menus: MenuItem[]
  categories: Category[]
  appliedCourse: Course | null
  appliedCourseQty: number | null
  activeDrinkPlan: DrinkPlan | null
  groupGuestCount: number
  onApply: (course: Course) => void
  onRemove: () => void
  onChangeQty: (qty: number) => void
}

export function CourseTab({
  courses,
  drinkPlans,
  menus,
  categories,
  appliedCourse,
  appliedCourseQty,
  activeDrinkPlan,
  groupGuestCount,
  onApply,
  onRemove,
  onChangeQty,
}: CourseTabProps) {
  const { t } = useTranslation()
  const [editingQty, setEditingQty] = useState<number | null>(null)
  const displayQty = appliedCourseQty ?? groupGuestCount
  const menuMap = new Map(menus.map((menu) => [menu.id, menu]))
  const categoryMap = new Map(categories.map((category) => [category.id, category.name]))
  const appliedCourseItems = appliedCourse
    ? appliedCourse.foodItems.reduce<Array<{ categoryName: string; items: string[] }>>((acc, foodItem) => {
      const menu = menuMap.get(foodItem.menuItemId)
      const categoryName = menu
        ? categoryMap.get(menu.categoryId) ?? t('common.unknownCategory', { id: menu.categoryId })
        : t('common.unknownCategory', { id: foodItem.menuItemId })
      const itemName = menu?.name ?? t('common.unknownItem', { id: foodItem.menuItemId })
      const summary = `${itemName} x${foodItem.qty}`
      const currentCategory = acc.find((entry) => entry.categoryName === categoryName)
      if (currentCategory) currentCategory.items.push(summary)
      else acc.push({ categoryName, items: [summary] })
      return acc
    }, [])
    : []
  const drinkPlanItemNames = activeDrinkPlan
    ? activeDrinkPlan.menuItemIds.map(
      (menuItemId) => menuMap.get(menuItemId)?.name ?? t('common.unknownItem', { id: menuItemId }),
    )
    : []

  return (
    <div className="flex-1 overflow-y-auto">
      {appliedCourse && (
        <div className="mx-5 my-3 rounded-[10px] border border-line bg-white px-4 py-4 shadow-[0_1px_3px_theme(colors.surface-deep)]">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-success-bg px-2 py-0.5 text-caption font-medium text-success-fg">
                  {t('group.courseApplyDone')}
                </span>
                <span className="min-w-0 truncate text-note font-medium text-ink">
                  {appliedCourse.name}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-caption text-secondary">
                <span>
                  ¥{appliedCourse.price.toLocaleString()}
                  {t('common.perPerson')}
                </span>
                {displayQty != null && (
                  <span>{t('group.courseQtyLabel', { qty: displayQty })}</span>
                )}
              </div>
              {activeDrinkPlan && (
                <div className="mt-2 inline-flex max-w-full items-center rounded-full border border-divider bg-surface px-2 py-0.5 text-caption text-secondary">
                  <Icon src={SYMBOL_ICONS.beer} className="mr-1 shrink-0" />
                  <span className="truncate">
                    {activeDrinkPlan.name} {t('group.drinkPlanActive')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {appliedCourseItems.length > 0 && (
            <div className="mt-4 border-t border-divider pt-3">
              <div className="text-caption font-medium text-secondary">
                {t('group.courseItemsByCategory')}
              </div>
              <div className="mt-2 space-y-2">
                {appliedCourseItems.map((group) => (
                  <div key={group.categoryName} className="text-note text-dim">
                    <span className="font-medium text-secondary">{group.categoryName}:</span>{' '}
                    {group.items.join(' / ')}
                  </div>
                ))}
              </div>
            </div>
          )}

          {drinkPlanItemNames.length > 0 && (
            <div className="mt-4 border-t border-divider pt-3">
              <div className="text-caption font-medium text-secondary">
                {t('group.drinkPlanItems')}
              </div>
              <div className="mt-2 text-note text-dim">{drinkPlanItemNames.join(' / ')}</div>
            </div>
          )}

          {editingQty != null ? (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-caption text-muted mb-1">{t('group.courseQtyChange')}</div>
                <QuantityPicker value={editingQty} onChange={setEditingQty} min={1} unit="名" />
              </div>
              <div className="flex gap-2">
                <BaseButton
                  variant="primary"
                  className="rounded-lg px-3.5 py-2 text-caption font-medium"
                  onClick={() => {
                    onChangeQty(editingQty)
                    setEditingQty(null)
                  }}
                >
                  {t('group.courseQtyConfirm')}
                </BaseButton>
                <BaseButton
                  variant="secondary"
                  className="rounded-lg px-3.5 py-2 text-caption font-medium"
                  onClick={() => setEditingQty(null)}
                >
                  {t('common.cancel')}
                </BaseButton>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex items-center justify-end gap-2">
              <BaseButton
                variant="secondary"
                className="rounded-lg px-3.5 py-2 text-caption font-medium"
                onClick={() => setEditingQty(displayQty)}
              >
                {t('group.courseQtyChange')}
              </BaseButton>
              <BaseButton
                variant="secondary"
                className="rounded-lg px-3.5 py-2 text-caption font-medium text-danger border-danger-border"
                onClick={onRemove}
              >
                {t('group.courseRemove')}
              </BaseButton>
            </div>
          )}
        </div>
      )}

      {!appliedCourse &&
        courses.map((course) => {
          const plan = course.drinkPlanId ? drinkPlans.find((p) => p.id === course.drinkPlanId) : null
          return (
            <div key={course.id} className="border-b border-surface bg-white px-5 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="text-sm font-medium text-ink mb-1">{course.name}</div>
                  <div className="text-xs text-muted mb-2">
                    ¥{course.price.toLocaleString()} {t('common.perPerson')}
                  </div>
                  {plan && (
                    <div className="mb-1.5">
                      <span className="text-caption text-info bg-info-bg border border-info-border px-1.75 py-0.5 rounded-full">
                        <Icon src={SYMBOL_ICONS.beer} className="mr-1 align-[-0.1em]" />
                        {plan.name}
                      </span>
                    </div>
                  )}
                  {course.foodItems.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {course.foodItems.map((fi) => {
                        const name =
                          menuMap.get(fi.menuItemId)?.name ??
                          t('common.unknownItem', { id: fi.menuItemId })
                        return (
                          <span
                            key={fi.menuItemId}
                            className="text-caption text-dim bg-surface border border-divider px-1.75 py-0.5 rounded-full"
                          >
                            {name}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
                <BaseButton
                  className="shrink-0 whitespace-nowrap rounded-lg border-none bg-brand px-4 py-2 text-xs text-white"
                  onClick={() => onApply(course)}
                >
                  {t('group.courseApply')}
                </BaseButton>
              </div>
            </div>
          )
        })}
    </div>
  )
}
