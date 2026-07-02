import { useState } from "react";
import { BaseButton, QuantityControl } from "@/components";
import type { Course, DrinkPlan, MenuItem } from "@order-system/shared";
import { useTranslation } from "react-i18next";

interface CourseTabProps {
  courses: Course[]
  drinkPlans: DrinkPlan[]
  menus: MenuItem[]
  appliedCourse: Course | null
  appliedCourseQty: number | null
  activeDrinkPlan: DrinkPlan | null
  groupGuestCount: number
  onApply: (course: Course) => void
  onRemove: () => void
  onChangeQty: (qty: number) => void
}

export function CourseTab({ courses, drinkPlans, menus, appliedCourse, appliedCourseQty, activeDrinkPlan, onApply, onRemove, onChangeQty }: CourseTabProps) {
  const { t } = useTranslation();
  const [editingQty, setEditingQty] = useState<number | null>(null);

  return (
    <div className="flex-1 overflow-y-auto">
      {appliedCourse && (
        <div className="mt-3 mx-5 px-3.5 py-2.5 bg-course-bg border border-open-border rounded-lg text-xs text-open-fg flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <span>✓</span>
            <span className="flex-1"><b>{appliedCourse.name}</b> {t('group.courseActiveLabel')}</span>
            {activeDrinkPlan && (
              <span className="text-info">／ {activeDrinkPlan.name} {t('group.drinkPlanActive')}</span>
            )}
            <button
              className="ml-1 text-muted underline bg-transparent border-none cursor-pointer text-caption"
              onClick={onRemove}
            >
              {t('group.courseRemove')}
            </button>
          </div>
          {appliedCourseQty != null && (
            editingQty != null ? (
              <div className="flex items-center gap-3">
                <QuantityControl value={editingQty} onChange={setEditingQty} min={1} unit="名" />
                <button
                  className="text-info underline bg-transparent border-none cursor-pointer text-caption"
                  onClick={() => { onChangeQty(editingQty); setEditingQty(null); }}
                >
                  {t('group.courseQtyConfirm')}
                </button>
                <button
                  className="text-muted underline bg-transparent border-none cursor-pointer text-caption"
                  onClick={() => setEditingQty(null)}
                >
                  {t('common.cancel')}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span>{t('group.courseQtyLabel', { qty: appliedCourseQty })}</span>
                <button
                  className="text-info underline bg-transparent border-none cursor-pointer text-caption"
                  onClick={() => setEditingQty(appliedCourseQty)}
                >
                  {t('group.courseQtyChange')}
                </button>
              </div>
            )
          )}
        </div>
      )}

      {courses.map(course => {
        const plan = course.drinkPlanId ? drinkPlans.find(p => p.id === course.drinkPlanId) : null;
        const isApplied = appliedCourse?.id === course.id;
        return (
          <div key={course.id} className={`px-5 py-3.5 border-b border-surface ${isApplied ? 'bg-white' : 'bg-white'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium text-ink mb-1">{course.name}</div>
                <div className="text-xs text-muted mb-2">¥{course.price.toLocaleString()} {t('common.perPerson')}</div>
                {plan && (
                  <div className="mb-1.5">
                    <span className="text-caption text-info bg-info-bg border border-info-border px-1.75 py-0.5 rounded-full">
                      🍺 {plan.name}
                    </span>
                  </div>
                )}
                {course.foodItems.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {course.foodItems.map((fi, i) => {
                      const name = menus.find(m => m.id === fi.menuItemId)?.name ?? t('common.unknownItem', { id: fi.menuItemId });
                      return (
                        <span key={i} className="text-caption text-dim bg-surface border border-divider px-1.75 py-0.5 rounded-full">
                          {name}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              <BaseButton
                className={`border-none rounded-lg px-4 py-2 text-xs whitespace-nowrap shrink-0 ${isApplied ? 'bg-surface-deep text-muted' : 'bg-ink text-white'}`}
                onClick={() => onApply(course)}
                disabled={isApplied}
              >
                {isApplied ? t('group.courseApplyDone') : t('group.courseApply')}
              </BaseButton>
            </div>
          </div>
        );
      })}
    </div>
  );
}
