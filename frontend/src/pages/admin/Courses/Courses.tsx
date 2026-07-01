import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AppHeader, BaseButton, Toast } from "@/components";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/routes";
import { EP } from "@/lib/endpoints";
import { useToast } from "@/hooks/useToast";
import type { Course, DrinkPlan, MenuItem, Category, SubCategory } from "@order-system/shared";

// ── DrinkPlan モーダル ────────────────────────────────────────
function DrinkPlanModal({ plan, menus, categories, subCategories, onSave, onDelete, onClose }: {
  plan: DrinkPlan | null;
  menus: MenuItem[];
  categories: Category[];
  subCategories: SubCategory[];
  onSave: (name: string, menuItemIds: number[]) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(plan?.name ?? "");
  const [selected, setSelected] = useState<Set<number>>(new Set(plan?.menuItemIds ?? []));

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
    <div className="fixed inset-0 bg-black/30 flex items-end z-modal animate-[fadeIn_0.15s_ease_both]" onClick={onClose}>
      <div className="w-full bg-white rounded-t-2xl border-t border-divider animate-[slideUp_0.22s_ease_both] flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4 border-b border-divider flex items-center justify-between shrink-0">
          <div className="text-sub font-medium text-ink">
            {plan ? t('courses.editDrinkPlanTitle') : t('courses.addDrinkPlanTitle')}
          </div>
          <BaseButton className="w-7 h-7 flex items-center justify-center rounded text-muted text-note" onClick={onClose}>×</BaseButton>
        </div>

        <div className="px-6 pt-4 pb-2 shrink-0">
          <label className="text-xs text-muted block mb-1.5">{t('courses.drinkPlanNameLabel')}</label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            className="input-field w-full border border-line rounded-[7px] px-3 py-2.25 text-sm outline-none text-ink"
          />
        </div>

        <div className="px-6 pt-3 pb-2 shrink-0">
          <div className="text-xs text-muted mb-2">{t('courses.drinkPlanItemsLabel')}</div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
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
                            {selected.has(item.id) && '✓'}
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

        <div className="px-6 pt-3 pb-10 border-t border-divider flex gap-2.5 shrink-0">
          {onDelete && (
            <BaseButton variant="secondary" className="flex-1 py-3.25 rounded-[10px] text-sm text-danger" onClick={onDelete}>
              {t('common.delete')}
            </BaseButton>
          )}
          <BaseButton
            variant="primary"
            className="flex-1 py-3.25 rounded-[10px] text-sm font-medium disabled:opacity-40"
            disabled={!name.trim()}
            onClick={() => name.trim() && onSave(name.trim(), [...selected])}
          >
            {t('common.save')}
          </BaseButton>
        </div>
      </div>
    </div>
  );
}

// ── Course モーダル ───────────────────────────────────────────
function CourseModal({ course, drinkPlans, menus, categories, onSave, onDelete, onClose }: {
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
                        <div className="flex items-center gap-1.5 shrink-0">
                          <BaseButton
                            className="w-6 h-6 flex items-center justify-center rounded border border-line text-muted text-note leading-none disabled:opacity-30"
                            disabled={qty === 0}
                            onClick={() => setQty(item.id, qty - 1)}
                          >−</BaseButton>
                          <span className={`w-5 text-center text-note ${qty > 0 ? 'text-ink font-medium' : 'text-muted'}`}>{qty}</span>
                          <BaseButton
                            className="w-6 h-6 flex items-center justify-center rounded border border-line text-muted text-note leading-none"
                            onClick={() => setQty(item.id, qty + 1)}
                          >＋</BaseButton>
                        </div>
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

// ── メイン ───────────────────────────────────────────────────
export default function Courses() {
  const { t } = useTranslation();
  const { toast, showToast } = useToast();

  const [drinkPlans, setDrinkPlans]       = useState<DrinkPlan[]>([]);
  const [courses, setCourses]             = useState<Course[]>([]);
  const [menus, setMenus]                 = useState<MenuItem[]>([]);
  const [categories, setCategories]       = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);

  type DrinkPlanModal = DrinkPlan | 'new' | null;
  type CourseModal    = Course    | 'new' | null;
  const [dpModal, setDpModal]     = useState<DrinkPlanModal>(null);
  const [courseModal, setCModal]  = useState<CourseModal>(null);

  useEffect(() => {
    Promise.all([
      api.get<DrinkPlan[]>(EP.drinkPlans),
      api.get<Course[]>(EP.courses),
      api.get<MenuItem[]>(EP.menus),
      api.get<Category[]>(EP.categories),
      api.get<SubCategory[]>(EP.subcategories),
    ]).then(([dp, c, m, cat, sub]) => {
      setDrinkPlans(dp);
      setCourses(c);
      setMenus(m);
      setCategories(cat.sort((a, b) => a.sort - b.sort));
      setSubCategories(sub);
    }).catch(() => {});
  }, []);

  // ── DrinkPlan CRUD ──────────────────────────────────────────
  const saveDrinkPlan = async (name: string, menuItemIds: number[]) => {
    try {
      if (dpModal === 'new') {
        const created = await api.post<DrinkPlan>(EP.drinkPlans, { name, menuItemIds });
        setDrinkPlans(prev => [...prev, created]);
      } else if (dpModal) {
        const updated = await api.put<DrinkPlan>(EP.drinkPlan(dpModal.id), { name, menuItemIds });
        setDrinkPlans(prev => prev.map(p => p.id === updated.id ? updated : p));
      }
      setDpModal(null);
    } catch { showToast(t('common.saveFailed')); }
  };

  const deleteDrinkPlan = async () => {
    if (!dpModal || dpModal === 'new') return;
    try {
      await api.delete(EP.drinkPlan(dpModal.id));
      setDrinkPlans(prev => prev.filter(p => p.id !== (dpModal as DrinkPlan).id));
      setDpModal(null);
    } catch { showToast(t('common.deleteFailed')); }
  };

  // ── Course CRUD ────────────────────────────────────────────
  const saveCourse = async (data: { name: string; price: number; drinkPlanId: number | null; foodItems: { menuItemId: number; qty: number }[] }) => {
    try {
      if (courseModal === 'new') {
        const created = await api.post<Course>(EP.courses, data);
        setCourses(prev => [...prev, created]);
      } else if (courseModal) {
        const updated = await api.put<Course>(EP.course((courseModal as Course).id), data);
        setCourses(prev => prev.map(c => c.id === updated.id ? updated : c));
      }
      setCModal(null);
    } catch { showToast(t('common.saveFailed')); }
  };

  const deleteCourse = async () => {
    if (!courseModal || courseModal === 'new') return;
    try {
      await api.delete(EP.course((courseModal as Course).id));
      setCourses(prev => prev.filter(c => c.id !== (courseModal as Course).id));
      setCModal(null);
    } catch { showToast(t('common.deleteFailed')); }
  };

  return (
    <>
      <AppHeader title={t('admin.courses')} breadcrumb={{ label: t('admin.menuTitle'), to: ROUTES.admin }} />

      <div className="flex-1 overflow-y-auto">

        {/* 飲み放題プランセクション */}
        <section className="px-5 pt-5 pb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-note font-medium text-ink">{t('courses.drinkPlanSection')}</h2>
            <button className="text-note text-info" onClick={() => setDpModal('new')}>
              {t('courses.addDrinkPlan')}
            </button>
          </div>
          {drinkPlans.length === 0 ? (
            <p className="text-xs text-muted py-2">{t('courses.noDrinkPlans')}</p>
          ) : drinkPlans.map(plan => (
            <div key={plan.id} className="py-3 border-b border-surface flex items-start gap-3">
              <div className="flex-1">
                <div className="text-note text-ink mb-1.5">{plan.name}</div>
                <div className="flex flex-wrap gap-1">
                  {plan.menuItemIds.map(mid => {
                    const name = menus.find(m => m.id === mid)?.name ?? t('common.unknownItem', { id: mid });
                    return (
                      <span key={mid} className="text-caption text-dim bg-surface border border-divider px-1.75 py-0.5 rounded-full">
                        {name}
                      </span>
                    );
                  })}
                </div>
              </div>
              <button className="text-xs text-info shrink-0 pt-0.5" onClick={() => setDpModal(plan)}>
                {t('common.edit')}
              </button>
            </div>
          ))}
        </section>

        {/* コースセクション */}
        <section className="px-5 pt-5 pb-4 border-t border-divider">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-note font-medium text-ink">{t('courses.courseSection')}</h2>
            <button className="text-note text-info" onClick={() => setCModal('new')}>
              {t('courses.addCourse')}
            </button>
          </div>
          {courses.length === 0 ? (
            <p className="text-xs text-muted py-2">{t('courses.noCourses')}</p>
          ) : courses.map(course => {
            const plan = course.drinkPlanId ? drinkPlans.find(p => p.id === course.drinkPlanId) : null;
            return (
              <div key={course.id} className="py-3 border-b border-surface flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-note text-ink font-medium">{course.name}</span>
                    <span className="text-xs text-muted">¥{course.price.toLocaleString()} {t('common.perPerson')}</span>
                  </div>
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
                            {name} ×{fi.qty}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                <button className="text-xs text-info shrink-0 pt-0.5" onClick={() => setCModal(course)}>
                  {t('common.edit')}
                </button>
              </div>
            );
          })}
        </section>

      </div>

      {dpModal !== null && (
        <DrinkPlanModal
          plan={dpModal === 'new' ? null : dpModal}
          menus={menus}
          categories={categories}
          subCategories={subCategories}
          onSave={saveDrinkPlan}
          onDelete={dpModal !== 'new' ? deleteDrinkPlan : undefined}
          onClose={() => setDpModal(null)}
        />
      )}

      {courseModal !== null && (
        <CourseModal
          course={courseModal === 'new' ? null : courseModal}
          drinkPlans={drinkPlans}
          menus={menus}
          categories={categories}
          onSave={saveCourse}
          onDelete={courseModal !== 'new' ? deleteCourse : undefined}
          onClose={() => setCModal(null)}
        />
      )}

      <Toast message={toast} />
    </>
  );
}
