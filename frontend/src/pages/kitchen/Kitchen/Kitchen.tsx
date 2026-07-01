import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppHeader, SubHeader, ToggleButtonGroup } from "@/components";
import { api } from "@/lib/api";
import { socket } from "@/lib/socket";
import { ROUTES } from "@/lib/routes";
import { EP } from "@/lib/endpoints";
import { SOCKET_EVENTS as SE } from "@/lib/events";
import { useSocketListeners } from "@/hooks/useSocketListeners";
import { getSeatLabels, isGroupActive } from "@/lib/utils";
import type { OrderItem, Group, Seat, MenuItem, Category, SubCategory } from "@order-system/shared";
import { CategoryLane } from "./components/CategoryLane";
import { CardView } from "./components/CardView";
import { SidePanel } from "./components/SidePanel";
import type { DisplayCat, DisplayOrder } from "./components/types";
import "./Kitchen.scss";

// カテゴリ数が増えても色が足りなくなるのを防ぐため5色でローテーション
const CAT_COLORS = ['#4a9eff', '#3ec97a', '#f59e0b', '#e53935', '#9c27b0'];

function buildDisplay(o: OrderItem, menus: MenuItem[], groups: Group[], seats: Seat[], getGroupName: (id: string) => string): DisplayOrder {
  const g = groups.find(x => x.id === o.groupId);
  const m = menus.find(x => x.id === o.menuItemId);
  const seatLabels = g ? getSeatLabels(seats, g.seatIds) : '';
  return {
    id: o.id, groupId: o.groupId,
    groupName: g?.name ?? getGroupName(o.groupId),
    seats: seatLabels,
    item: o.menuItemName,
    qty: o.qty,
    catId: m?.categoryId ?? 0,
    subId: m?.subCategoryId ?? 0,
    orderedAt: o.orderedAt,
    status: o.status,
  };
}

export default function Kitchen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [orders, setOrders]         = useState<OrderItem[]>([]);
  const [groups, setGroups]         = useState<Group[]>([]);
  const [seats, setSeats]           = useState<Seat[]>([]);
  const [menus, setMenus]           = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [view, setView]             = useState("ticket");
  const [panelGroupId, setPanelGroupId] = useState<string | null>(null);
  // 1分ごとに再レンダリングして経過時間表示を最新化するためのダミー state
  const [, setTick] = useState(0);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const fetchAll = () => Promise.all([
      api.get<OrderItem[]>(`${EP.orders}?status=pending&status=ready`),
      api.get<Group[]>(`${EP.groups}?status=active&status=bill_requested`),
      api.get<Seat[]>(EP.seats),
      api.get<MenuItem[]>(EP.menus),
      api.get<Category[]>(EP.categories),
      api.get<SubCategory[]>(EP.subcategories),
    ]).then(([o, g, s, m, c, sc]) => {
      setLoadError(false);
      setOrders(o);
      setGroups(g);
      setSeats(s);
      setMenus(m);
      setCategories(c);
      setSubCategories(sc);
    }).catch(() => setLoadError(true));
    fetchAll();
    socket.on('connect', fetchAll);

    const tickTimer = setInterval(() => setTick(n => n + 1), 60000);
    return () => {
      socket.off('connect', fetchAll);
      clearInterval(tickTimer);
    };
  }, []);

  useSocketListeners({
    [SE.orderCreated]: (o: OrderItem) => {
      if (o.status === 'pending' || o.status === 'ready') setOrders(prev => [...prev, o]);
    },
    [SE.orderUpdated]: (o: OrderItem) => {
      setOrders(prev => {
        const filtered = prev.filter(x => x.id !== o.id);
        return (o.status === 'pending' || o.status === 'ready') ? [...filtered, o] : filtered;
      });
    },
    [SE.orderCancelled]: (id: string) => setOrders(prev => prev.filter(o => o.id !== id)),
    [SE.groupCreated]: (g: Group) => setGroups(prev => [...prev, g]),
    // active でなくなったグループ（会計済み等）はリストから除去
    [SE.groupUpdated]: (g: Group) => setGroups(prev =>
      isGroupActive(g) ? prev.map(x => x.id === g.id ? g : x) : prev.filter(x => x.id !== g.id)
    ),
    [SE.seatUpdated]: (s: Seat) => setSeats(prev => prev.map(x => x.id === s.id ? s : x)),
    [SE.menuSoldout]: (menuItemId: number, soldOut: boolean) => {
      setMenus(prev => prev.map(m => m.id === menuItemId ? { ...m, soldOut } : m));
    },
    [SE.menuCreated]: (item: MenuItem) => setMenus(prev => [...prev, item]),
    [SE.menuUpdated]: (item: MenuItem) => setMenus(prev => prev.map(m => m.id === item.id ? item : m)),
    [SE.menuDeleted]: (menuItemId: number) => setMenus(prev => prev.filter(m => m.id !== menuItemId)),
  });

  const displayCats = useMemo<DisplayCat[]>(() =>
    categories
      .sort((a, b) => a.sort - b.sort)
      .map((cat, i) => ({
        id: cat.id,
        label: cat.name,
        color: CAT_COLORS[i % CAT_COLORS.length],
        subs: subCategories
          .filter(s => s.categoryId === cat.id)
          .sort((a, b) => a.sort - b.sort)
          .map(s => ({ id: s.id, label: s.name })),
      }))
  , [categories, subCategories]);

  const displayOrders = useMemo(() =>
    orders.map(o => buildDisplay(o, menus, groups, seats, (id) => t('common.unknownGroup', { id })))
  , [orders, menus, groups, seats, t]);

  const handleReady  = (id: string) => socket.emit(SE.orderComplete, id);
  const handleServed = (id: string) => socket.emit(SE.orderServe, id);

  const pendingOrders = displayOrders.filter(o => o.status === 'pending');
  const pendingCount  = orders.filter(o => o.status === 'pending').length;
  const readyCount    = orders.filter(o => o.status === 'ready').length;

  if (loadError) return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-secondary">
      <p>{t('common.loadError')}</p>
      <button className="px-4 py-2 rounded-lg bg-info text-white text-sm" onClick={() => window.location.reload()}>{t('common.retry')}</button>
    </div>
  );

  return (
    <>
      <AppHeader
          title={
            <>
              {t('kitchen.title')}
              {pendingCount > 0 && (
                <span className="ml-2 text-label bg-surface-deep border border-line text-secondary px-2 py-0.5 rounded-full">{t('kitchen.pendingCount', { count: pendingCount })}</span>
              )}
              {readyCount > 0 && (
                <span className="ml-1.5 text-label bg-amber-bg text-bill border border-amber-border px-2 py-0.5 rounded-full">{`🍽 ${t('common.readyToServe')} ${t('kitchen.pendingCount', { count: readyCount })}`}</span>
              )}
            </>
          }
        />
        <SubHeader
          right={
            <ToggleButtonGroup
              options={[{ key: "ticket", label: t('kitchen.ticketView') }, { key: "card", label: t('kitchen.groupView') }]}
              value={view}
              onChange={setView}
            />
          }
        />

        <div className="flex-1 overflow-y-auto">
          {view === "card" ? (
            groups.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-muted text-note h-full">
                {t('kitchen.noGroups')}
              </div>
            ) : (
              <CardView groups={groups} orders={pendingOrders} seats={seats} onComplete={handleReady} onCardClick={setPanelGroupId} />
            )
          ) : (
            orders.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-muted text-note h-full">
                {t('kitchen.noOrders')}
              </div>
            ) : (
              <div className="p-3.5 flex flex-col gap-3">
                {displayCats.map(cat => (
                  <CategoryLane
                    key={cat.id}
                    cat={cat}
                    orders={pendingOrders}
                    onComplete={handleReady}
                    onTicketClick={setPanelGroupId}
                  />
                ))}
              </div>
            )
          )}
        </div>

        {panelGroupId && (
          <SidePanel
            groupId={panelGroupId}
            groups={groups}
            orders={displayOrders}
            seats={seats}
            cats={displayCats}
            onClose={() => setPanelGroupId(null)}
            onServed={handleServed}
            onNavigate={id => navigate(ROUTES.kitchenGroup(id))}
          />
        )}
    </>
  );
}
