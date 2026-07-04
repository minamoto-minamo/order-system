import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AppHeader, Toast } from "@/components";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/routes";
import { EP } from "@/lib/endpoints";
import { useToast } from "@/hooks/useToast";
import type { Course, DrinkPlan, MenuItem, Category, SubCategory } from "@order-system/shared";
import { DrinkPlanModal } from "./components/DrinkPlanModal";
import { CourseModal } from "./components/CourseModal";
import { DrinkPlanSection } from "./components/DrinkPlanSection";
import { CourseSection } from "./components/CourseSection";

export default function Courses() {
  const { t } = useTranslation();
  const { toast, showToast } = useToast();

  const [drinkPlans, setDrinkPlans]       = useState<DrinkPlan[]>([]);
  const [courses, setCourses]             = useState<Course[]>([]);
  const [menus, setMenus]                 = useState<MenuItem[]>([]);
  const [categories, setCategories]       = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);

  type DrinkPlanModalState = DrinkPlan | 'new' | null;
  type CourseModalState    = Course    | 'new' | null;
  const [dpModal, setDpModal]     = useState<DrinkPlanModalState>(null);
  const [courseModal, setCModal]  = useState<CourseModalState>(null);

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
  const saveDrinkPlan = async (name: string, price: number, menuItemIds: number[]) => {
    try {
      if (dpModal === 'new') {
        const created = await api.post<DrinkPlan>(EP.drinkPlans, { name, price, menuItemIds });
        setDrinkPlans(prev => [...prev, created]);
      } else if (dpModal) {
        const updated = await api.put<DrinkPlan>(EP.drinkPlan(dpModal.id), { name, price, menuItemIds });
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
        <DrinkPlanSection
          drinkPlans={drinkPlans}
          menus={menus}
          onAdd={() => setDpModal('new')}
          onEdit={plan => setDpModal(plan)}
        />
        <CourseSection
          courses={courses}
          drinkPlans={drinkPlans}
          menus={menus}
          onAdd={() => setCModal('new')}
          onEdit={course => setCModal(course)}
        />
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
