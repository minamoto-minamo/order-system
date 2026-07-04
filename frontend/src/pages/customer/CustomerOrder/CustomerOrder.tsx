import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { EP } from "@/lib/endpoints";
import { SOCKET_EVENTS as SE } from "@/lib/events";
import { socket } from "@/lib/socket";
import { useSocketListeners } from "@/hooks/useSocketListeners";
import { BaseButton, BottomSheetModal, IconButton, MenuConfirmModal, MenuQtyStepper, NoticeBanner, SlideUpFooter, SubCategorySidebar } from "@/components";
import { CustomerOrderHistory } from "./components/CustomerOrderHistory";
import type { MenuItem, Category, SubCategory, OrderItem, Group } from "@order-system/shared";

type CustomerGroup = { id: string; name: string; status: string };
type CustomerMenusResponse = {
  menus: MenuItem[];
  categories: Category[];
  subCategories: SubCategory[];
};

export default function CustomerOrder() {
  const { t } = useTranslation();
  const { id: groupId = "" } = useParams<{ id: string }>();

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
  const [successMsg, setSuccessMsg]         = useState<string | null>(null);
  const [errorMsg, setErrorMsg]             = useState<string | null>(null);

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
      if (g.id === groupId) setGroup({ id: g.id, name: g.name, status: g.status });
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
    setErrorMsg(null);
    try {
      const created = await api.post<OrderItem[]>(EP.customerOrders, {
        groupId,
        items: orderItems.map(({ item, qty }) => ({ menuItemId: item.id, qty })),
      });
      // order:created イベントの到着を待たず、レスポンスを直接反映して履歴タブに即時反映する
      setItems(prev => [...prev, ...created.filter(c => !prev.some(i => i.id === c.id))]);
      setQtys({});
      setConfirmOpen(false);
      setSuccessMsg(t('customerOrder.orderSuccess'));
      setTimeout(() => setSuccessMsg(null), 3000);
      setTab('history');
    } catch {
      setErrorMsg(t('customerOrder.orderFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleBill = async () => {
    if (billing || group?.status !== 'active') return;
    setBilling(true);
    try {
      setConfirmBill(false);
      await api.post(EP.customerBill(groupId), {});
      setGroup(prev => prev ? { ...prev, status: 'bill_requested' } : prev);
    } finally {
      setBilling(false);
    }
  };

  const handleCallStaff = async () => {
    if (calling) return;
    setCalling(true);
    try {
      setConfirmCall(false);
      await api.post(EP.customerCallStaff(groupId), {});
      setSuccessMsg(t('customerOrder.callStaffSuccess'));
      setTimeout(() => setSuccessMsg(null), 3000);
    } finally {
      setCalling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <span className="text-muted text-sub">{t('customerOrder.loading')}</span>
      </div>
    );
  }

  if (notFound || !group) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <span className="text-muted text-sub">{t('customerOrder.groupNotFound')}</span>
      </div>
    );
  }

  if (group.status !== 'active' && group.status !== 'bill_requested') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <span className="text-muted text-sub">{t('customerOrder.orderNotAccepted')}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <div className="bg-white border-b border-divider px-4 py-3 shrink-0 flex items-center justify-between">
        <div className="text-sub font-medium text-ink">{group.name}</div>
        <div className="flex items-center gap-1">
          <IconButton
            className="w-8 h-8 flex items-center justify-center rounded-md text-dim text-base"
            onClick={() => setConfirmCall(true)}
            aria-label={t('customerOrder.callStaff')}
          >
            🔔
          </IconButton>
          <IconButton
            className={`w-8 h-8 flex items-center justify-center rounded-md text-base ${group.status === 'bill_requested' ? 'text-amber-fg' : 'text-dim'}`}
            onClick={() => setConfirmBill(true)}
            disabled={group.status !== 'active'}
            aria-label={t('customerOrder.requestBill')}
          >
            ¥
          </IconButton>
        </div>
      </div>

      <div className="flex border-b border-divider bg-white shrink-0">
        <button
          className={`flex-1 py-2.5 text-note border-none bg-transparent cursor-pointer border-b-2 ${tab === 'menu' ? 'text-ink font-medium border-ink' : 'text-muted border-transparent'}`}
          onClick={() => setTab('menu')}
        >
          {t('customerOrder.menuTab')}
        </button>
        <button
          className={`flex-1 py-2.5 text-note border-none bg-transparent cursor-pointer border-b-2 ${tab === 'history' ? 'text-ink font-medium border-ink' : 'text-muted border-transparent'}`}
          onClick={() => setTab('history')}
        >
          {t('customerOrder.historyTab')}
        </button>
      </div>

      {tab === 'menu' ? (
        <>
          <div className="flex border-b border-divider bg-white shrink-0 overflow-x-auto">
            {activeCats.map(c => (
              <button
                key={c.id}
                className={`px-4 py-2.5 text-note border-none bg-none cursor-pointer whitespace-nowrap border-b-2 ${
                  safeCatId === c.id ? 'text-ink font-medium border-ink' : 'text-muted border-transparent'
                }`}
                onClick={() => { setActiveCatId(c.id); setActiveSubId(null); }}
              >
                {c.name}
              </button>
            ))}
          </div>

          <div className="flex flex-1 overflow-hidden">
            <SubCategorySidebar subs={catSubs} activeSubId={safeSubId} onSelect={setActiveSubId} />

            <div className="flex-1 overflow-y-auto" style={{ paddingBottom: orderItems.length > 0 ? 80 : 16 }}>
              {filteredItems.map(item => {
                const qty = getQty(item.id);
                return (
                  <div key={item.id} className="px-5 py-3 border-b border-surface flex items-center gap-3 bg-white">
                    <div className="flex-1">
                      <div className="text-sm text-ink mb-0.5">{item.name}</div>
                      <div className="text-xs text-muted">¥{item.price.toLocaleString()}</div>
                    </div>
                    <MenuQtyStepper qty={qty} onChange={val => setQty(item.id, val)} />
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <CustomerOrderHistory items={items} />
      )}

      {successMsg && <NoticeBanner>{successMsg}</NoticeBanner>}

      {errorMsg && <NoticeBanner variant="danger">{errorMsg}</NoticeBanner>}

      {tab === 'menu' && orderItems.length > 0 && (
        <SlideUpFooter>
          <BaseButton
            className="w-full border-none rounded-[10px] p-3.5 text-sm font-medium text-white bg-ink disabled:opacity-50"
            onClick={() => setConfirmOpen(true)}
            disabled={group?.status !== 'active'}
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
