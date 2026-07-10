import type { Course, DrinkPlan, MenuItem } from '@order-system/shared'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/primitives'
import { SYMBOL_ICONS } from '@/lib/icons'

export function CourseSection({
  courses,
  drinkPlans,
  menus,
  onAdd,
  onEdit,
}: {
  courses: Course[]
  drinkPlans: DrinkPlan[]
  menus: MenuItem[]
  onAdd: () => void
  onEdit: (course: Course) => void
}) {
  const { t } = useTranslation()

  return (
    <section className="px-5 pt-5 pb-4 border-t border-divider">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-note font-medium text-ink">{t('courses.courseSection')}</h2>
        <button type="button" className="text-note text-info" onClick={onAdd}>
          {t('courses.addCourse')}
        </button>
      </div>
      {courses.length === 0 ? (
        <p className="text-xs text-muted py-2">{t('courses.noCourses')}</p>
      ) : (
        courses.map((course) => {
          const plan = course.drinkPlanId
            ? drinkPlans.find((p) => p.id === course.drinkPlanId)
            : null
          return (
            <div key={course.id} className="py-3 border-b border-surface flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-note text-ink font-medium">{course.name}</span>
                  <span className="text-xs text-muted">
                    ¥{course.price.toLocaleString()} {t('common.perPerson')}
                  </span>
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
                        menus.find((m) => m.id === fi.menuItemId)?.name ??
                        t('common.unknownItem', { id: fi.menuItemId })
                      return (
                        <span
                          key={fi.menuItemId}
                          className="text-caption text-dim bg-surface border border-divider px-1.75 py-0.5 rounded-full"
                        >
                          {name} ×{fi.qty}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="text-xs text-info shrink-0 pt-0.5"
                onClick={() => onEdit(course)}
              >
                {t('common.edit')}
              </button>
            </div>
          )
        })
      )}
    </section>
  )
}
