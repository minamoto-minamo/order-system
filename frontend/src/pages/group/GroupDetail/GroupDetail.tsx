import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppHeader, BottomSheetModal, ConfirmModal, TabNavigation, QuantityControl } from "@/components";
import { api } from "@/lib/api";
import { socket } from "@/lib/socket";
import { EP } from "@/lib/endpoints";
import { SOCKET_EVENTS as SE } from "@/lib/events";
import { useSocketListeners } from "@/hooks/useSocketListeners";
import { useToast } from "@/hooks/useToast";
import { getSeatLabels } from "@/lib/utils";
import type { Group, OrderItem, MenuItem, Category, SubCategory, Course, DrinkPlan, Seat, Setting } from "@order-system/shared";
import { CancelModal } from "./CancelModal";
import { OrderHistory } from "./OrderHistory";
import { MenuAdd } from "./MenuAdd";
import { BillFooter } from "./BillFooter";
import { CourseTab } from "./CourseTab";
import "./GroupDetail.scss";

// ── メイン ───────────────────────────────────────────────────

export default function GroupDetail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const groupId = Number(id);

  const [group, setGroup]           = useState<Group | null>(null);
  const [items, setItems]           = useState<OrderItem[]>([]);
  const [menus, setMenus]               = useState<MenuItem[]>([]);
  const [categories, setCategories]     = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [courses, setCourses]       = useState<Course[]>([]);
  const [drinkPlans, setDrinkPlans] = useState<DrinkPlan[]>([]);
  const [seats, setSeats]           = useState<Seat[]>([]);

  const [taxRates, setTaxRates] = useState({ inHouse: 10, takeout: 8 });

  const [tab, setTab]                       = useState("menu");
  const [showCourseConfirm, setShowCourseConfirm] = useState<Course | null>(null);
  const [courseQty, setCourseQty] = useState(1);
  const [cancelTarget, setCancelTarget]     = useState<OrderItem | null>(null);
  const [showBillConfirm, setShowBillConfirm]   = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const { toast: addedToast, showToast } = useToast();

  useEffect(() => {
    Promise.all([
      api.get<Group>(EP.group(groupId)),
      api.get<OrderItem[]>(`${EP.orders}?groupId=${groupId}`),
      api.get<MenuItem[]>(EP.menus),
      api.get<Category[]>(EP.categories),
      api.get<SubCategory[]>(EP.subcategories),
      api.get<Course[]>(EP.courses),
      api.get<DrinkPlan[]>(EP.drinkPlans),
      api.get<Seat[]>(EP.seats),
      api.get<Setting>(EP.settings),
    ]).then(([g, o, m, c, sc, cr, dp, s, st]) => {
      setGroup(g);
      setItems(o);
      setMenus(m);
      setCategories(c);
      setSubCategories(sc);
      setCourses(cr);
      setDrinkPlans(dp);
      setSeats(s);
      setTaxRates({ inHouse: st.taxRateInHouse, takeout: st.taxRateTakeout });
    }).catch(console.error);
  }, [groupId]);

  useSocketListeners({
    [SE.orderCreated]: (o: OrderItem) => {
      if (o.groupId === groupId) setItems(prev => prev.some(i => i.id === o.id) ? prev : [...prev, o]);
    },
    [SE.orderUpdated]: (o: OrderItem) => {
      if (o.groupId === groupId) setItems(prev => prev.map(i => i.id === o.id ? o : i));
    },
    [SE.orderCancelled]: (id: number) => setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'cancelled' as const } : i)),
    [SE.groupUpdated]: (g: Group) => {
      if (g.id === groupId) setGroup(g);
    },
    [SE.settingsUpdated]: (s: Setting) => setTaxRates({ inHouse: s.taxRateInHouse, takeout: s.taxRateTakeout }),
  });

  const appliedCourse   = courses.find(c => c.id === group?.courseId) ?? null;
  const activeDrinkPlan = drinkPlans.find(p => p.id === group?.drinkPlanId) ?? null;

  const seatLabels = getSeatLabels(seats, group?.seatIds ?? []);

  const handleCourseOrder = async (course: Course, qty: number) => {
    if (!group) return;
    try {
      if (course.foodItems.length > 0) {
        await api.post<OrderItem[]>(EP.orders, {
          groupId: group.id,
          items: course.foodItems.map(fi => ({ menuItemId: fi.menuItemId, qty: fi.qty * qty, isTakeout: false })),
          courseId: course.id,
        });
      }
      const updatedGroup = await api.put<Group>(EP.group(group.id), {
        courseId: course.id,
        drinkPlanId: course.drinkPlanId,
      });
      setGroup(updatedGroup);
      showToast(t('group.courseAppliedToast', { name: course.name }));
      setShowCourseConfirm(null);
      setTab('history');
    } catch (e) { console.error(e); }
  };

  const handleCourseRemove = async () => {
    if (!group) return;
    try {
      const updatedGroup = await api.put<Group>(EP.group(group.id), { courseId: null, drinkPlanId: null });
      setGroup(updatedGroup);
      showToast(t('group.courseRemovedToast'));
    } catch (e) { console.error(e); }
  };

  const handleChangeStatus = (id: number) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    if (item.status === 'pending') socket.emit(SE.orderComplete, id);
    else if (item.status === 'ready') socket.emit(SE.orderServe, id);
  };

  const handleCancelConfirm = async (id: number, cancelQty: number) => {
    try {
      const updated = await api.put<OrderItem>(EP.orderCancel(id), { qty: cancelQty });
      setItems(prev => prev.map(i => i.id === id ? updated : i));
    } catch {
      showToast(t('group.cancelFailed'));
    }
    setCancelTarget(null);
  };

  const handleAdd = async (orderItems: { item: MenuItem; qty: number }[], isTakeout: boolean) => {
    if (!group || orderItems.length === 0) return;
    try {
      await api.post<OrderItem[]>(EP.orders, {
        groupId: group.id,
        items: orderItems.map(({ item, qty }) => ({ menuItemId: item.id, qty, isTakeout })),
      });
      const names = orderItems.map(({ item, qty }) => `${item.name} ×${qty}`).join('、');
      showToast(t('group.addedToastMsg', { name: names }));
      setTab('history');
    } catch {
      showToast(t('group.addOrderFailed'));
    }
  };

  const handleBillConfirm = async () => {
    if (!group) return;
    try {
      const updated = await api.put<Group>(EP.group(group.id), { status: 'bill_requested' });
      setGroup(updated);
    } catch {
      showToast(t('group.billFailed'));
    }
    setShowBillConfirm(false);
  };

  const handleBillCancel = async () => {
    if (!group) return;
    try {
      const updated = await api.put<Group>(EP.group(group.id), { status: 'active' });
      setGroup(updated);
      setTab('history');
    } catch {
      showToast(t('group.billCancelFailed'));
    }
  };

  const handleResetConfirm = async () => {
    if (!group) return;
    const updated = await api.put<Group>(EP.group(group.id), { status: 'closed' }).catch(() => null);
    if (updated) navigate(-1);
  };

  return (
    <>
      <div className="h-dvh bg-white flex flex-col max-w-120 mx-auto">

        <AppHeader
          title={group?.name ?? '...'}
          sub={seatLabels || undefined}
          breadcrumb={{ label: t('common.back'), onClick: () => navigate(-1) }}
        />

        <TabNavigation
          tabs={group?.status === 'active'
            ? [
                { key: "menu",    label: t('group.menuTab') },
                { key: "history", label: t('group.orderHistory') },
                { key: "course",  label: t('group.courseTab') },
              ]
            : [{ key: "history", label: t('group.orderHistory') }]
          }
          activeTab={group?.status === 'active' ? tab : 'history'}
          onChange={setTab}
        />

        <div className="flex-1 overflow-hidden flex flex-col">
          {tab === "history" ? (
            <>
              <OrderHistory
                items={items}
                onChangeStatus={handleChangeStatus}
                onCancelTap={setCancelTarget}
              />
              <BillFooter
                items={items}
                taxRates={taxRates}
                groupStatus={group?.status}
                onBillRequest={() => setShowBillConfirm(true)}
                onBillCancel={handleBillCancel}
                onCheckOut={() => setShowResetConfirm(true)}
              />
            </>
          ) : tab === "menu" ? (
            <MenuAdd menus={menus} categories={categories} subCategories={subCategories} onAdd={handleAdd} />
          ) : (
            <CourseTab
              courses={courses}
              drinkPlans={drinkPlans}
              menus={menus}
              appliedCourse={appliedCourse}
              activeDrinkPlan={activeDrinkPlan}
              groupGuestCount={group?.guestCount ?? 1}
              onApply={(course) => { setShowCourseConfirm(course); setCourseQty(group?.guestCount ?? 1); }}
              onRemove={handleCourseRemove}
            />
          )}
        </div>

        {cancelTarget && (
          <CancelModal
            item={cancelTarget}
            onConfirm={handleCancelConfirm}
            onClose={() => setCancelTarget(null)}
          />
        )}

        {addedToast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-ink text-white rounded-full px-5 py-2.25 text-xs whitespace-nowrap animate-[slideUp_0.2s_ease_both] z-300">
            {addedToast}
          </div>
        )}

        <ConfirmModal
          show={showBillConfirm}
          title={t('group.billConfirmTitle')}
          description={t('group.billConfirmDesc')}
          cancelLabel={t('common.back')}
          confirmLabel={t('group.billConfirmAction')}
          onConfirm={handleBillConfirm}
          onClose={() => setShowBillConfirm(false)}
        />

        <ConfirmModal
          show={showResetConfirm}
          cancelLabel={t('common.back')}
          confirmLabel={t('group.checkOutAction')}
          variant="danger"
          onConfirm={handleResetConfirm}
          onClose={() => setShowResetConfirm(false)}
        >
          <div className="mb-5 text-center">
            <div className="text-3xl mb-3">🚪</div>
            <div className="text-sub font-semibold text-ink mb-2">{t('group.checkOutConfirmTitle')}</div>
            <div className="text-xs text-danger font-medium">{t('group.checkOutConfirmDesc')}</div>
          </div>
        </ConfirmModal>

        {showCourseConfirm && (
          <BottomSheetModal
            show={true}
            onClose={() => setShowCourseConfirm(null)}
            secondaryAction={{ label: t('common.back'), onClick: () => setShowCourseConfirm(null) }}
            primaryAction={{ label: t('group.courseApplyAction'), onClick: () => handleCourseOrder(showCourseConfirm, courseQty) }}
          >
            <div className="text-sub font-medium text-ink mb-1">{showCourseConfirm.name}</div>
            <div className="text-xs text-muted mb-4">¥{showCourseConfirm.price.toLocaleString()} {t('common.perPerson')}</div>
            <div className="mb-4">
              <div className="text-xs text-dim mb-2.5">{t('hall.guestCount')}</div>
              <QuantityControl value={courseQty} onChange={setCourseQty} min={1} unit="名" />
            </div>
            {showCourseConfirm.drinkPlanId && (() => {
              const plan = drinkPlans.find(p => p.id === showCourseConfirm.drinkPlanId);
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
            {showCourseConfirm.foodItems.length > 0 && (
              <div className="mb-5">
                <div className="text-label text-course mb-1.5 font-medium">🍽 {t('group.courseFoodLabel')}</div>
                <div className="bg-surface border border-divider rounded-lg px-3.5 py-2.5">
                  {showCourseConfirm.foodItems.map((fi, i) => {
                    const name = menus.find(m => m.id === fi.menuItemId)?.name ?? t('common.unknownItem', { id: fi.menuItemId });
                    return (
                      <div key={i} className={`flex justify-between py-1.25 ${i < showCourseConfirm.foodItems.length - 1 ? 'border-b border-surface-deep' : ''}`}>
                        <span className="text-note text-secondary">{name}</span>
                        <span className="text-xs text-muted">×{fi.qty * courseQty}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </BottomSheetModal>
        )}

      </div>
    </>
  );
}
