import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppHeader, IconButton, TabNavigation, Toast } from "@/components";
import { ConfirmModal } from "./components/ConfirmModal";
import { api } from "@/lib/api";
import { socket } from "@/lib/socket";
import { EP } from "@/lib/endpoints";
import { SOCKET_EVENTS as SE } from "@/lib/events";
import { useSocketListeners } from "@/hooks/useSocketListeners";
import { useToast } from "@/hooks/useToast";
import { getSeatLabels } from "@/lib/utils";
import type { Group, OrderItem, MenuItem, Category, SubCategory, Course, DrinkPlan, Seat } from "@order-system/shared";
import { CancelModal } from "./components/CancelModal";
import { OrderHistory } from "./components/OrderHistory";
import { MenuAdd } from "./components/MenuAdd";
import { BillFooter } from "./components/BillFooter";
import { CourseTab } from "./components/CourseTab";
import { CourseConfirmModal } from "./components/CourseConfirmModal";
import { ChangeSeatModal } from "./components/ChangeSeatModal";
import { QrModal } from "./components/QrModal";

// ── メイン ───────────────────────────────────────────────────

export default function GroupDetail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id: groupId = '' } = useParams<{ id: string }>();

  const [group, setGroup]           = useState<Group | null>(null);
  const [items, setItems]           = useState<OrderItem[]>([]);
  const [menus, setMenus]               = useState<MenuItem[]>([]);
  const [categories, setCategories]     = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [courses, setCourses]       = useState<Course[]>([]);
  const [drinkPlans, setDrinkPlans] = useState<DrinkPlan[]>([]);
  const [seats, setSeats]           = useState<Seat[]>([]);


  const [tab, setTab]                       = useState("menu");
  const [showSeatModal, setShowSeatModal]   = useState(false);
  const [showQr, setShowQr]                 = useState(false);
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
    ]).then(([g, o, m, c, sc, cr, dp, s]) => {
      setGroup(g);
      setItems(o);
      setMenus(m);
      setCategories(c);
      setSubCategories(sc);
      setCourses(cr);
      setDrinkPlans(dp);
      setSeats(s);
    }).catch(console.error);
  }, [groupId]);

  useSocketListeners({
    // Socket と初期ロードの二重受信を防ぐため id 重複チェックを行う
    [SE.orderCreated]: (o: OrderItem) => {
      if (o.groupId === groupId) setItems(prev => prev.some(i => i.id === o.id) ? prev : [...prev, o]);
    },
    [SE.orderUpdated]: (o: OrderItem) => {
      if (o.groupId === groupId) setItems(prev => prev.map(i => i.id === o.id ? o : i));
    },
    // orderCancelled は id だけ届くため、アイテム全体はローカルで status だけ更新
    [SE.orderCancelled]: (id: string) => setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'cancelled' as const } : i)),
    [SE.groupUpdated]: (g: Group) => {
      if (g.id === groupId) setGroup(g);
    },
    [SE.menuSoldout]: (menuItemId: number, soldOut: boolean) =>
      setMenus(prev => prev.map(m => m.id === menuItemId ? { ...m, soldOut } : m)),
  });

  const appliedCourse   = courses.find(c => c.id === group?.courseId) ?? null;
  const activeDrinkPlan = drinkPlans.find(p => p.id === group?.drinkPlanId) ?? null;

  const seatLabels = getSeatLabels(seats, group?.seatIds ?? []);

  // 食事アイテムを先に注文として登録してからグループの courseId/drinkPlanId を更新する
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

  const handleChangeStatus = (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    if (item.status === 'pending') socket.emit(SE.orderComplete, id);
    else if (item.status === 'ready') socket.emit(SE.orderServe, id);
  };

  const handleCancelConfirm = async (id: string, cancelQty: number) => {
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

  const handleSeatChange = async (seatIds: number[], name: string) => {
    if (!group) return;
    try {
      const updated = await api.put<Group>(EP.group(group.id), { seatIds, name });
      setGroup(updated);
      showToast(t('group.changeSeatToast'));
    } catch {
      showToast(t('group.changeSeatFailed'));
    }
    setShowSeatModal(false);
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
      <AppHeader
          title={group?.name ?? '...'}
          sub={seatLabels || undefined}
          breadcrumb={{ label: t('common.back'), onClick: () => navigate(-1) }}
          right={group?.status === 'active' ? (
            <div className="flex items-center gap-2">
              <IconButton
                className="w-8 h-8 flex items-center justify-center rounded-md text-dim"
                onClick={() => setShowQr(true)}
                aria-label={t('group.showQr')}
              >
                ▣
              </IconButton>
              <IconButton
                className="w-8 h-8 flex items-center justify-center rounded-md text-dim"
                onClick={() => setShowSeatModal(true)}
                aria-label={t('group.changeSeat')}
              >
                ✎
              </IconButton>
            </div>
          ) : undefined}
        />

        {/* bill_requested / closed 状態ではメニュー追加・コース操作を禁止するためタブを history のみに制限 */}
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

        <Toast message={addedToast} />

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
          <CourseConfirmModal
            course={showCourseConfirm}
            courseQty={courseQty}
            setCourseQty={setCourseQty}
            drinkPlans={drinkPlans}
            menus={menus}
            onConfirm={() => handleCourseOrder(showCourseConfirm, courseQty)}
            onClose={() => setShowCourseConfirm(null)}
          />
        )}

        <ChangeSeatModal
          show={showSeatModal}
          currentGroupId={groupId}
          currentSeatIds={group?.seatIds ?? []}
          onConfirm={handleSeatChange}
          onClose={() => setShowSeatModal(false)}
        />

        <QrModal show={showQr} groupId={groupId} onClose={() => setShowQr(false)} />

    </>
  );
}
