import { useTranslation } from "react-i18next";
import { BottomSheetModal, QuantityControl } from "@/components";
import type { Course, DrinkPlan, MenuItem } from "@order-system/shared";

export function CourseConfirmModal({ course, courseQty, setCourseQty, drinkPlans, menus, onConfirm, onClose }: {
  course: Course;
  courseQty: number;
  setCourseQty: (qty: number) => void;
  drinkPlans: DrinkPlan[];
  menus: MenuItem[];
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <BottomSheetModal
      show={true}
      onClose={onClose}
      secondaryAction={{ label: t('common.back'), onClick: onClose }}
      primaryAction={{ label: t('group.courseApplyAction'), onClick: onConfirm }}
    >
      <div className="text-sub font-medium text-ink mb-1">{course.name}</div>
      <div className="text-xs text-muted mb-4">¥{course.price.toLocaleString()} {t('common.perPerson')}</div>
      <div className="mb-4">
        <div className="text-xs text-dim mb-2.5">{t('hall.guestCount')}</div>
        <QuantityControl value={courseQty} onChange={setCourseQty} min={1} unit="名" />
      </div>
      {course.drinkPlanId && (() => {
        const plan = drinkPlans.find(p => p.id === course.drinkPlanId);
        if (!plan) return null;
        return (
          <div className="mb-3">
            <div className="text-label text-info mb-1.5 font-medium">🍺 {plan.name}{t('group.drinkPlanNote')}</div>
            <div className="bg-info-bg border border-info-border rounded-lg px-3.5 py-2 flex flex-wrap gap-1">
              {plan.menuItemIds.map(mid => {
                const name = menus.find(m => m.id === mid)?.name ?? t('common.unknownItem', { id: mid });
                return (
                  <span key={mid} className="text-label text-info bg-white border border-info-border px-2 py-0.5 rounded-full">{name}</span>
                );
              })}
            </div>
          </div>
        );
      })()}
      {course.foodItems.length > 0 && (
        <div className="mb-5">
          <div className="text-label text-course mb-1.5 font-medium">🍽 {t('group.courseFoodLabel')}</div>
          <div className="bg-surface border border-divider rounded-lg px-3.5 py-2.5">
            {course.foodItems.map((fi, i) => {
              const name = menus.find(m => m.id === fi.menuItemId)?.name ?? t('common.unknownItem', { id: fi.menuItemId });
              return (
                <div key={i} className={`flex justify-between py-1.25 ${i < course.foodItems.length - 1 ? 'border-b border-surface-deep' : ''}`}>
                  <span className="text-note text-secondary">{name}</span>
                  <span className="text-xs text-muted">×{fi.qty * courseQty}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </BottomSheetModal>
  );
}
