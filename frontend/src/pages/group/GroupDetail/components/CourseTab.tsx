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

export function CourseTab({ courses, drinkPlans, menus, appliedCourse, appliedCourseQty, activeDrinkPlan, groupGuestCount, onApply, onRemove, onChangeQty }: CourseTabProps) {
  const { t } = useTranslation();
  const [editingQty, setEditingQty] = useState<number | null>(null);
  const displayQty = appliedCourseQty ?? groupGuestCount;

  return (
    <div className="flex-1 overflow-y-auto">
      {appliedCourse && (
        <div className="mx-5 mt-3 rounded-[10px] border border-brand-border bg-course-bg px-4 py-3.5">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-course px-2 py-0.5 text-caption font-medium text-white">
                  {t('group.courseApplyDone')}
                </span>
                <span className="min-w-0 truncate text-note font-medium text-ink">
                  {appliedCourse.name}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-caption text-secondary">
                <span>¥{appliedCourse.price.toLocaleString()}{t('common.perPerson')}</span>
                {displayQty != null && (
                  <span>{t('group.courseQtyLabel', { qty: displayQty })}</span>
                )}
              </div>
              {activeDrinkPlan && (
                <div className="mt-2 inline-flex max-w-full items-center rounded-full border border-info-border bg-info-bg px-2 py-0.5 text-caption text-info">
                  <span className="truncate">🍺 {activeDrinkPlan.name} {t('group.drinkPlanActive')}</span>
                </div>
              )}
            </div>
          </div>

          {editingQty != null ? (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-caption text-muted mb-1">{t('group.courseQtyChange')}</div>
                <QuantityControl value={editingQty} onChange={setEditingQty} min={1} unit="名" />
              </div>
              <div className="flex gap-2">
                <BaseButton
                  variant="primary"
                  className="rounded-lg px-3.5 py-2 text-caption font-medium"
                  onClick={() => { onChangeQty(editingQty); setEditingQty(null); }}
                >
                  {t('group.courseQtyConfirm')}
                </BaseButton>
                <BaseButton
                  variant="ghost"
                  className="rounded-lg border border-line bg-white px-3.5 py-2 text-caption font-medium text-dim"
                  onClick={() => setEditingQty(null)}
                >
                  {t('common.cancel')}
                </BaseButton>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex items-center justify-end gap-2">
              <BaseButton
                variant="ghost"
                className="rounded-lg border border-brand-border bg-white px-3.5 py-2 text-caption font-medium text-brand-dark"
                onClick={() => setEditingQty(displayQty)}
              >
                {t('group.courseQtyChange')}
              </BaseButton>
              <BaseButton
                variant="ghost"
                className="rounded-lg border border-danger-border bg-white px-3.5 py-2 text-caption font-medium text-danger"
                onClick={onRemove}
              >
                {t('group.courseRemove')}
              </BaseButton>
            </div>
          )}
        </div>
      )}

      {courses.map(course => {
        const plan = course.drinkPlanId ? drinkPlans.find(p => p.id === course.drinkPlanId) : null;
        const isApplied = appliedCourse?.id === course.id;
        return (
          <div key={course.id} className={`px-5 py-3.5 border-b border-surface ${isApplied ? 'bg-course-bg' : 'bg-white'}`}>
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
              {isApplied ? (
                <span className="shrink-0 rounded-full border border-brand-border bg-course-bg px-3 py-1 text-caption font-medium text-course">
                  {t('group.courseApplyDone')}
                </span>
              ) : (
                <BaseButton
                  className="border-none rounded-lg px-4 py-2 text-xs whitespace-nowrap shrink-0 bg-brand text-white"
                  onClick={() => onApply(course)}
                >
                  {t('group.courseApply')}
                </BaseButton>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
