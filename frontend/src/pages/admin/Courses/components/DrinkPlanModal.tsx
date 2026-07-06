import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BaseButton, BottomSheetModal, Icon } from "@/components";
import { ACTION_ICONS } from "@/lib/icons";
import type { DrinkPlan, MenuItem, Category, SubCategory } from "@order-system/shared";

export function DrinkPlanModal({ plan, menus, categories, subCategories, onSave, onDelete, onClose }: {
  plan: DrinkPlan | null;
  menus: MenuItem[];
  categories: Category[];
  subCategories: SubCategory[];
  onSave: (name: string, price: number, menuItemIds: number[]) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(plan?.name ?? "");
  const [price, setPrice] = useState(String(plan?.price ?? ""));
  const [selected, setSelected] = useState<Set<number>>(new Set(plan?.menuItemIds ?? []));

  const priceNum = Number(price);
  const priceValid = price !== "" && !isNaN(priceNum) && priceNum >= 0;

  const toggle = (id: number) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleSub = (items: MenuItem[], allSelected: boolean) => setSelected(prev => {
    const next = new Set(prev);
    if (allSelected) items.forEach(m => next.delete(m.id));
    else items.forEach(m => next.add(m.id));
    return next;
  });

  return (
    <BottomSheetModal
      show
      scrollable
      onClose={onClose}
      secondaryAction={onDelete ? { label: t('common.delete'), onClick: onDelete, variant: "danger" } : undefined}
      primaryAction={{
        label: t('common.save'),
        disabled: !name.trim() || !priceValid,
        onClick: () => name.trim() && priceValid && onSave(name.trim(), priceNum, [...selected]),
      }}
    >
      <div className="px-6 pt-6 pb-4 border-b border-divider flex items-center justify-between">
        <div className="text-sub font-medium text-ink">
          {plan ? t('courses.editDrinkPlanTitle') : t('courses.addDrinkPlanTitle')}
        </div>
        <BaseButton className="w-7 h-7 flex items-center justify-center rounded text-muted text-note" onClick={onClose} aria-label={t('common.close')}>
          <Icon src={ACTION_ICONS.close} />
        </BaseButton>
      </div>

      <div className="px-6 pt-4 pb-2">
        <label className="text-xs text-muted block mb-1.5">{t('courses.drinkPlanNameLabel')}</label>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          className="input-field w-full border border-line rounded-[7px] px-3 py-2.25 text-sm outline-none text-ink"
        />
      </div>

      <div className="px-6 pt-3 pb-2">
        <label className="text-xs text-muted block mb-1.5">{t('courses.drinkPlanPriceLabel')}</label>
        <input
          type="number"
          inputMode="numeric"
          value={price}
          onChange={e => setPrice(e.target.value)}
          className="input-field w-full border border-line rounded-[7px] px-3 py-2.25 text-sm outline-none text-ink"
        />
      </div>

      <div className="px-6 pt-3 pb-2">
        <div className="text-xs text-muted mb-2">{t('courses.drinkPlanItemsLabel')}</div>
      </div>

      <div className="px-6 pb-4">
        {categories.map(cat => {
          const catItems = menus.filter(m => m.categoryId === cat.id);
          if (catItems.length === 0) return null;
          const subs = subCategories.filter(s => s.categoryId === cat.id).sort((a, b) => a.sort - b.sort);
          return (
            <div key={cat.id} className="mb-4">
              <div className="text-caption text-muted mb-1.5 font-medium tracking-wide">{cat.name}</div>
              {subs.map(sub => {
                const items = menus.filter(m => m.subCategoryId === sub.id);
                if (items.length === 0) return null;
                const allSelected = items.every(m => selected.has(m.id));
                return (
                  <div key={sub.id} className="mb-2">
                    <div className="flex items-center justify-between py-1">
                      <div className="text-caption text-secondary font-medium">{sub.name}</div>
                      <button
                        className="text-caption text-info"
                        onClick={() => toggleSub(items, allSelected)}
                      >
                        {allSelected ? t('courses.deselectAll') : t('courses.selectAll')}
                      </button>
                    </div>
                    {items.map(item => (
                      <button
                        key={item.id}
                        className="w-full flex items-center gap-3 py-2.25 border-b border-surface text-left"
                        onClick={() => toggle(item.id)}
                      >
                        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 text-caption ${selected.has(item.id) ? 'bg-info border-info text-white' : 'border-line'}`}>
                          {selected.has(item.id) && <Icon src={ACTION_ICONS.check} size="0.85em" />}
                        </span>
                        <span className="text-note text-ink flex-1">{item.name}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </BottomSheetModal>
  );
}
