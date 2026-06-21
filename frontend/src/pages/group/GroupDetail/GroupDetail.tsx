import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppHeader, BottomSheetModal, TabNavigation, Button, QuantityControl } from "@/components";
import { api } from "@/lib/api";
import { socket } from "@/lib/socket";
import { EP } from "@/lib/endpoints";
import { SOCKET_EVENTS as SE } from "@/lib/events";
import type { Group, OrderItem, MenuItem, Category, SubCategory, Course, DrinkPlan, Seat, Setting } from "@order-system/shared";
import { CancelModal } from "./CancelModal";
import { OrderHistory } from "./OrderHistory";
import { MenuAdd } from "./MenuAdd";
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
  const [addedToast, setAddedToast]         = useState<string | null>(null);

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

    const onOrderCreated = (o: OrderItem) => {
      if (o.groupId === groupId) setItems(prev => prev.some(i => i.id === o.id) ? prev : [...prev, o]);
    };
    const onOrderUpdated = (o: OrderItem) => {
      if (o.groupId === groupId) setItems(prev => prev.map(i => i.id === o.id ? o : i));
    };
    const onOrderCancelled = (id: number) => setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'cancelled' as const } : i));
    const onGroupUpdated = (g: Group) => {
      if (g.id === groupId) setGroup(g);
    };

    const onSettingsUpdated = (s: Setting) => setTaxRates({ inHouse: s.taxRateInHouse, takeout: s.taxRateTakeout });

    socket.on(SE.orderCreated,    onOrderCreated);
    socket.on(SE.orderUpdated,    onOrderUpdated);
    socket.on(SE.orderCancelled,  onOrderCancelled);
    socket.on(SE.groupUpdated,    onGroupUpdated);
    socket.on(SE.settingsUpdated, onSettingsUpdated);

    return () => {
      socket.off(SE.orderCreated,    onOrderCreated);
      socket.off(SE.orderUpdated,    onOrderUpdated);
      socket.off(SE.orderCancelled,  onOrderCancelled);
      socket.off(SE.groupUpdated,    onGroupUpdated);
      socket.off(SE.settingsUpdated, onSettingsUpdated);
    };
  }, [groupId]);

  const appliedCourse   = courses.find(c => c.id === group?.courseId) ?? null;
  const activeDrinkPlan = drinkPlans.find(p => p.id === group?.drinkPlanId) ?? null;

  const seatLabels = seats
    .filter(s => group?.seatIds.includes(s.id))
    .map(s => s.label)
    .join('・');

  const showToast = (msg: string) => {
    setAddedToast(msg);
    setTimeout(() => setAddedToast(null), 1800);
  };

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
              <div className="px-4 pt-4 pb-5 border-t border-divider bg-surface shrink-0">
                {(() => {
                  const activeItems = items.filter(i => i.status !== 'cancelled');
                  const subtotal = activeItems.reduce((s, i) => s + i.price * i.qty, 0);
                  const tax = activeItems.reduce((s, i) => s + Math.floor(i.price * i.qty * (i.isTakeout ? taxRates.takeout : taxRates.inHouse) / 100), 0);
                  return (
                    <div className="mb-3.5">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <span className="text-note text-dim">{t('group.total')}</span>
                        <span className="text-lg font-medium text-ink">¥{subtotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-muted">{t('group.tax')}</span>
                        <span className="text-xs text-muted">+¥{tax.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })()}
                {group?.status === 'bill_requested' ? (
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      className="flex-1 rounded-[10px] py-3.5 text-note font-medium"
                      onClick={handleBillCancel}
                    >
                      {t('group.billCancel')}
                    </Button>
                    <Button
                      variant="secondary"
                      className="flex-1 rounded-[10px] py-3.5 text-note font-medium"
                      onClick={() => setShowResetConfirm(true)}
                    >
                      {t('group.checkOut')}
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="w-full border-none rounded-[10px] py-3.5 text-sub font-medium text-white disabled:opacity-40"
                    style={{ background: 'var(--color-ink)' }}
                    onClick={() => setShowBillConfirm(true)}
                    disabled={items.some(i => i.status === 'pending' || i.status === 'ready')}
                  >
                    {t('group.bill')}
                  </Button>
                )}
              </div>
            </>
          ) : tab === "menu" ? (
            <MenuAdd menus={menus} categories={categories} subCategories={subCategories} onAdd={handleAdd} />
          ) : (
            <div className="flex-1 overflow-y-auto">
              {appliedCourse && (
                <div className="mt-3 mx-5 px-3.5 py-2.5 bg-course-bg border border-open-border rounded-lg text-xs text-open-fg flex items-center gap-1.5">
                  <span>✓</span>
                  <span className="flex-1"><b>{appliedCourse.name}</b> {t('group.courseActiveLabel')}</span>
                  {activeDrinkPlan && (
                    <span className="text-info">／ {activeDrinkPlan.name} {t('group.drinkPlanActive')}</span>
                  )}
                  <button
                    className="ml-1 text-muted underline bg-transparent border-none cursor-pointer text-caption"
                    onClick={handleCourseRemove}
                  >
                    {t('group.courseRemove')}
                  </button>
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
                              const name = menus.find(m => m.id === fi.menuItemId)?.name ?? `商品${fi.menuItemId}`;
                              return (
                                <span key={i} className="text-caption text-dim bg-surface border border-divider px-1.75 py-0.5 rounded-full">
                                  {name}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <Button
                        className={`border-none rounded-lg px-4 py-2 text-xs whitespace-nowrap shrink-0 ${isApplied ? 'bg-surface-deep text-muted' : 'bg-ink text-white'}`}
                        onClick={() => { setShowCourseConfirm(course); setCourseQty(group?.guestCount ?? 1); }}
                        disabled={isApplied}
                      >
                        {isApplied ? t('group.courseApplyDone') : t('group.courseApply')}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
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

        <BottomSheetModal
          show={showBillConfirm}
          title={t('group.billConfirmTitle')}
          description={t('group.billConfirmDesc')}
          onClose={() => setShowBillConfirm(false)}
          secondaryAction={{ label: t('common.back'), onClick: () => setShowBillConfirm(false) }}
          primaryAction={{ label: t('group.billConfirmAction'), onClick: handleBillConfirm }}
        />

        <BottomSheetModal
          show={showResetConfirm}
          onClose={() => setShowResetConfirm(false)}
          secondaryAction={{ label: t('common.back'), onClick: () => setShowResetConfirm(false) }}
          primaryAction={{ label: t('group.checkOutAction'), onClick: handleResetConfirm, variant: 'danger' }}
        >
          <div className="mb-5 text-center">
            <div className="text-3xl mb-3">🚪</div>
            <div className="text-sub font-semibold text-ink mb-2">{t('group.checkOutConfirmTitle')}</div>
            <div className="text-xs text-danger font-medium">{t('group.checkOutConfirmDesc')}</div>
          </div>
        </BottomSheetModal>

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
                      const name = menus.find(m => m.id === mid)?.name ?? `商品${mid}`;
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
                    const name = menus.find(m => m.id === fi.menuItemId)?.name ?? `商品${fi.menuItemId}`;
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
