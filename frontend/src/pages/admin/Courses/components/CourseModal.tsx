import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BaseButton, MenuQtyStepper } from "@/components";
import type { Course, DrinkPlan, MenuItem, Category } from "@order-system/shared";

export function CourseModal({ course, drinkPlans, menus, categories, onSave, onDelete, onClose }: {
  course: Course | null;
  drinkPlans: DrinkPlan[];
  menus: MenuItem[];
  categories: Category[];
  onSave: (data: { name: string; price: number; drinkPlanId: number | null; foodItems: { menuItemId: number; qty: number }[] }) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(course?.name ?? "");
  const [price, setPrice] = useState(String(course?.price ?? ""));
  const [drinkPlanId, setDrinkPlanId] = useState<number | null>(course?.drinkPlanId ?? null);
  const [qtys, setQtys] = useState<Map<number, number>>(
    () => new Map(course?.foodItems.map(fi => [fi.menuItemId, fi.qty]) ?? [])
  );

  const setQty = (id: number, qty: number) => setQtys(prev => {
    const next = new Map(prev);
    if (qty <= 0) next.delete(id);
    else next.set(id, qty);
    return next;
  });

  const foodItems = [...qtys.entries()].map(([menuItemId, qty]) => ({ menuItemId, qty }));
  const priceNum = Number(price);
  const valid = name.trim() && price !== "" && !isNaN(priceNum) && priceNum >= 0;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-end z-modal animate-[fadeIn_0.15s_ease_both]" onClick={onClose}>
      <div className="w-full bg-white rounded-t-2xl border-t border-divider animate-[slideUp_0.22s_ease_both] flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4 border-b border-divider flex items-center justify-between shrink-0">
          <div className="text-sub font-medium text-ink">
            {course ? t('courses.editCourseTitle') : t('courses.addCourseTitle')}
          </div>
          <BaseButton className="w-7 h-7 flex items-center justify-center rounded text-muted text-note" onClick={onClose}>×</BaseButton>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-6 pt-4 pb-3 space-y-3.5">
            <div>
              <label className="text-xs text-muted block mb-1.5">{t('courses.courseNameLabel')}</label>
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                className="input-field w-full border border-line rounded-[7px] px-3 py-2.25 text-sm outline-none text-ink"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1.5">{t('courses.coursePriceLabel')}</label>
              <input
                type="number"
                inputMode="numeric"
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="input-field w-full border border-line rounded-[7px] px-3 py-2.25 text-sm outline-none text-ink"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1.5">{t('courses.courseDrinkPlanLabel')}</label>
              <select
                value={drinkPlanId ?? ""}
                onChange={e => setDrinkPlanId(e.target.value === "" ? null : Number(e.target.value))}
                className="input-field w-full border border-line rounded-[7px] px-3 py-2.25 text-sm outline-none text-ink bg-white"
              >
                <option value="">{t('courses.noneOption')}</option>
                {drinkPlans.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="px-6 pb-2 border-t border-surface">
            <div className="text-xs text-muted pt-3 mb-2">{t('courses.courseFoodItemsLabel')}</div>
            {categories.map(cat => {
              const items = menus.filter(m => m.categoryId === cat.id);
              if (items.length === 0) return null;
              return (
                <div key={cat.id} className="mb-3">
                  <div className="text-caption text-muted mb-1.5 font-medium tracking-wide">{cat.name}</div>
                  {items.map(item => {
                    const qty = qtys.get(item.id) ?? 0;
                    return (
                      <div key={item.id} className="flex items-center gap-3 py-2 border-b border-surface">
                        <span className={`flex-1 text-note ${qty > 0 ? 'text-ink' : 'text-muted'}`}>{item.name}</span>
                        <MenuQtyStepper qty={qty} onChange={val => setQty(item.id, val)} />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-6 pt-3 pb-10 border-t border-divider flex gap-2.5 shrink-0">
          {onDelete && (
            <BaseButton variant="secondary" className="flex-1 py-3.25 rounded-[10px] text-sm text-danger" onClick={onDelete}>
              {t('common.delete')}
            </BaseButton>
          )}
          <BaseButton
            variant="primary"
            className="flex-1 py-3.25 rounded-[10px] text-sm font-medium disabled:opacity-40"
            disabled={!valid}
            onClick={() => valid && onSave({ name: name.trim(), price: priceNum, drinkPlanId, foodItems })}
          >
            {t('common.save')}
          </BaseButton>
        </div>
      </div>
    </div>
  );
}
