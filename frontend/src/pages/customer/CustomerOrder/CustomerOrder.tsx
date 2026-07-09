import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { ApiError, apiErrorMessage } from "@/lib/apiError";
import { EP } from "@/lib/endpoints";
import { SOCKET_EVENTS as SE } from "@/lib/events";
import { ACTION_ICONS } from "@/lib/icons";
import { socket } from "@/lib/socket";
import { useSocketListeners } from "@/hooks/useSocketListeners";
import { BottomSheetModal, MenuConfirmModal, SlideUpFooter, TabNavigation } from "@/components/composite";
import { BaseButton, Icon, IconButton } from "@/components/primitives";
import { useToastStore } from "@/stores/toast";
import { CustomerMenuList } from "./components/CustomerMenuList";
import { CustomerOrderHistory } from "./components/CustomerOrderHistory";
import type { MenuItem, Category, SubCategory, OrderItem, Group } from "@order-system/shared";

type CustomerGroup = Pick<Group, 'id' | 'name' | 'status' | 'effectiveTaxRateInHouse' | 'effectiveTaxRateTakeout' | 'effectiveTaxInclusive'>;
type CustomerMenusResponse = {
  menus: MenuItem[];
  categories: Category[];
  subCategories: SubCategory[];
};

export default function CustomerOrder() {
  const { t } = useTranslation();
  const { id: groupId = "" } = useParams<{ id: string }>();
  const showToast = useToastStore((state) => state.showToast);

  const [group, setGroup]                   = useState<CustomerGroup | null>(null);
  const [menus, setMenus]                   = useState<MenuItem[]>([]);
  const [categories, setCategories]         = useState<Category[]>([]);
  const [subCategories, setSubCategories]   = useState<SubCategory[]>([]);
  const [items, setItems]                   = useState<OrderItem[]>([]);
  const [loading, setLoading]               = useState(true);
  const [notFound, setNotFound]             = useState(false);
  const [tab, setTab]                       = useState<'menu' | 'history'>('menu');
  const [activeCatId, setActiveCatId]       = useState<number | null>(null);
  const [activeSubId, setActiveSubId]       = useState<number | null>(null);
  const [qtys, setQtys]                     = useState<Record<number, number>>({});
  const [confirmOpen, setConfirmOpen]       = useState(false);
  const [submitting, setSubmitting]         = useState(false);
  const [calling, setCalling]               = useState(false);
  const [billing, setBilling]               = useState(false);
  const [confirmCall, setConfirmCall]       = useState(false);
  const [confirmBill, setConfirmBill]       = useState(false);

  useEffect(() => {
    const fetchAll = () => Promise.all([
      api.get<CustomerGroup>(EP.customerGroup(groupId)),
      api.get<CustomerMenusResponse>(EP.customerMenus(groupId)),
      api.get<OrderItem[]>(EP.customerGroupOrders(groupId)),
    ]).then(([g, m, o]) => {
      setGroup(g);
      setMenus(m.menus);
      setCategories(m.categories);
      setSubCategories(m.subCategories);
      setItems(o);
    }).catch(() => {
      setNotFound(true);
    }).finally(() => setLoading(false));
    fetchAll();
    socket.on('connect', fetchAll);
    return () => { socket.off('connect', fetchAll); };
  }, [groupId]);

  useEffect(() => {
    const join = () => socket.emit(SE.groupJoin, groupId);
    join();
    socket.on('connect', join);
    return () => { socket.off('connect', join); };
  }, [groupId]);

  useSocketListeners({
    [SE.orderCreated]: (o: OrderItem) => {
      if (o.groupId === groupId) setItems(prev => prev.some(i => i.id === o.id) ? prev : [...prev, o]);
    },
    [SE.orderUpdated]: (o: OrderItem) => {
      if (o.groupId === groupId) setItems(prev => prev.map(i => i.id === o.id ? o : i));
    },
    [SE.orderCancelled]: (id: string) => {
      setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'cancelled' as const } : i));
    },
    [SE.groupUpdated]: (g: Group) => {
      if (g.id === groupId) setGroup({
        id: g.id,
        name: g.name,
        status: g.status,
        effectiveTaxRateInHouse: g.effectiveTaxRateInHouse,
        effectiveTaxRateTakeout: g.effectiveTaxRateTakeout,
        effectiveTaxInclusive: g.effectiveTaxInclusive,
      });
    },
  });

  const dineInMenus = menus.filter(m => m.takeout === 'dine_in' || m.takeout === 'both');
  const activeCats = categories.filter(c => dineInMenus.some(m => m.categoryId === c.id));
  const safeCatId = activeCats.find(c => c.id === activeCatId)?.id ?? activeCats[0]?.id ?? null;

  const catSubs = subCategories
    .filter(s => s.categoryId === safeCatId && dineInMenus.some(m => m.subCategoryId === s.id))
    .sort((a, b) => a.sort - b.sort);

  const safeSubId = catSubs.find(s => s.id === activeSubId)?.id ?? null;
  const filteredItems = dineInMenus
    .filter(m => m.categoryId === safeCatId)
    .filter(m => safeSubId === null || m.subCategoryId === safeSubId);

  const getQty = (id: number) => qtys[id] ?? 0;
  const setQty = (id: number, val: number) => setQtys(prev => ({ ...prev, [id]: Math.max(0, val) }));

  const orderItems = Object.entries(qtys)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({ item: menus.find(m => m.id === Number(id))!, qty }))
    .filter(x => x.item != null);

  const handleSubmit = async () => {
    if (submitting || orderItems.length === 0) return;
    setSubmitting(true);
    try {
      const created = await api.post<OrderItem[]>(EP.customerOrders, {
        groupId,
        items: orderItems.map(({ item, qty }) => ({ menuItemId: item.id, qty })),
      });
      // order:created イベントの到着を待たず、レスポンスを直接反映して履歴タブに即時反映する
      setItems(prev => [...prev, ...created.filter(c => !prev.some(i => i.id === c.id))]);
      setQtys({});
      setConfirmOpen(false);
      showToast(t('customerOrder.orderSuccess'));
      setTab('history');
    } catch (e) {
      let soldOutNames: string[] = [];
      if (e instanceof ApiError && e.serverCode === 'customer.orders.sold_out') {
        const details = e.details as { menuItemIds?: number[]; menuItemNames?: string[] } | null;
        const soldOutIds = details?.menuItemIds ?? [];
        setQtys(prev => {
          const next = { ...prev };
          for (const id of soldOutIds) delete next[id];
          return next;
        });
        soldOutNames = details?.menuItemNames ?? [];
        api.get<CustomerMenusResponse>(EP.customerMenus(groupId)).then(m => {
          setMenus(m.menus);
          setCategories(m.categories);
          setSubCategories(m.subCategories);
        });
        setConfirmOpen(false);
      }
      const errorMsg = apiErrorMessage(e, t('customerOrder.orderFailed'));
      showToast(`${errorMsg}${soldOutNames.length > 0 ? `（${soldOutNames.join('、')}）` : ''}`, 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBill = async () => {
    if (billing || group?.status !== 'active') return;
    setBilling(true);
    try {
      await api.post(EP.customerBill(groupId), {});
      setGroup(prev => prev ? { ...prev, status: 'bill_requested' } : prev);
      setConfirmBill(false);
    } catch {
      showToast(t('customerOrder.orderFailed'), 'danger');
    } finally {
      setBilling(false);
    }
  };

  const handleCallStaff = async () => {
    if (calling) return;
    setCalling(true);
    try {
      await api.post(EP.customerCallStaff(groupId), {});
      setConfirmCall(false);
      showToast(t('customerOrder.callStaffSuccess'));
    } catch {
      showToast(t('customerOrder.orderFailed'), 'danger');
    } finally {
      setCalling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-dvh bg-white">
        <span className="text-muted text-sub">{t('customerOrder.loading')}</span>
      </div>
    );
  }

  if (notFound || !group) {
    return (
      <div className="flex items-center justify-center h-dvh bg-white">
        <span className="text-muted text-sub">{t('customerOrder.groupNotFound')}</span>
      </div>
    );
  }

  // 会計リクエスト後（bill_requested）は会計ボタンを消し、タブを注文履歴のみに制限して追加注文を止める
  const orderable = group.status === 'active';
  const activeTab = orderable ? tab : 'history';

  if (group.status !== 'active' && group.status !== 'bill_requested') {
    return (
      <div className="flex items-center justify-center h-dvh bg-white">
        <span className="text-muted text-sub">{t('customerOrder.orderNotAccepted')}</span>
      </div>
    );
  }

  return (
    <div className="app-shell flex flex-col h-dvh bg-white overflow-hidden">
      <div className="bg-white border-b border-divider px-4 py-3 shrink-0 flex items-center justify-between">
        <div className="text-sub font-medium text-ink">{group.name}</div>
        <div className="flex items-center gap-1">
          <IconButton
            className="w-8 h-8 flex items-center justify-center rounded-md text-dim text-base"
            onClick={() => setConfirmCall(true)}
            aria-label={t('customerOrder.callStaff')}
          >
            <Icon src={ACTION_ICONS.bell} />
          </IconButton>
          {orderable && (
            <IconButton
              className="w-8 h-8 flex items-center justify-center rounded-md text-base text-dim"
              onClick={() => setConfirmBill(true)}
              aria-label={t('customerOrder.requestBill')}
            >
              <Icon src={ACTION_ICONS.yen} />
            </IconButton>
          )}
        </div>
      </div>

      <TabNavigation
        className="bg-white"
        tabs={orderable
          ? [
            { key: 'menu', label: t('customerOrder.menuTab') },
            { key: 'history', label: t('customerOrder.historyTab') },
          ]
          : [{ key: 'history', label: t('customerOrder.historyTab') }]
        }
        activeTab={activeTab}
        onChange={key => setTab(key as 'menu' | 'history')}
      />

      {activeTab === 'menu' ? (
        <CustomerMenuList
          categories={activeCats}
          activeCatId={safeCatId}
          onSelectCategory={id => { setActiveCatId(id); setActiveSubId(null); }}
          subs={catSubs}
          activeSubId={safeSubId}
          onSelectSub={setActiveSubId}
          items={filteredItems}
          getQty={getQty}
          onQtyChange={setQty}
          footerVisible={orderItems.length > 0}
        />
      ) : (
        <CustomerOrderHistory items={items} tax={group} />
      )}

      {activeTab === 'menu' && orderItems.length > 0 && (
        <SlideUpFooter>
          <BaseButton
            className="w-full border-none rounded-[10px] p-3.5 text-sm font-medium text-white bg-brand"
            onClick={() => setConfirmOpen(true)}
          >
            {t('group.reviewOrder')}
          </BaseButton>
        </SlideUpFooter>
      )}

      <MenuConfirmModal
        open={confirmOpen}
        items={orderItems}
        orderType="dine_in"
        submitting={submitting}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleSubmit}
      />

      <BottomSheetModal
        show={confirmCall}
        title={t('customerOrder.callStaff')}
        description={t('customerOrder.callStaffConfirm')}
        onClose={() => setConfirmCall(false)}
        primaryAction={{ label: t('customerOrder.callStaff'), onClick: handleCallStaff }}
        secondaryAction={{ label: t('common.cancel'), onClick: () => setConfirmCall(false) }}
      />

      <BottomSheetModal
        show={confirmBill}
        title={t('customerOrder.requestBill')}
        description={t('customerOrder.requestBillConfirm')}
        onClose={() => setConfirmBill(false)}
        primaryAction={{ label: t('customerOrder.requestBill'), onClick: handleBill }}
        secondaryAction={{ label: t('common.cancel'), onClick: () => setConfirmBill(false) }}
      />
    </div>
  );
}
