import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppHeader, SubHeader, ToggleButtonGroup } from "@/components";
import { api } from "@/lib/api";
import { socket } from "@/lib/socket";
import { ROUTES } from "@/lib/routes";
import { EP } from "@/lib/endpoints";
import { SOCKET_EVENTS as SE } from "@/lib/events";
import type { OrderItem, Group, Seat, MenuItem, Category, SubCategory } from "@order-system/shared";
import { CategoryLane } from "./CategoryLane";
import { CardView } from "./CardView";
import { SidePanel } from "./SidePanel";
import type { DisplayCat, DisplayOrder } from "./types";
import "./Kitchen.scss";

const CAT_COLORS = ['#4a9eff', '#3ec97a', '#f59e0b', '#e53935', '#9c27b0'];

function buildDisplay(o: OrderItem, menus: MenuItem[], groups: Group[], seats: Seat[]): DisplayOrder {
  const g = groups.find(x => x.id === o.groupId);
  const m = menus.find(x => x.id === o.menuItemId);
  const seatLabels = g
    ? seats.filter(s => g.seatIds.includes(s.id)).map(s => s.label).join('・')
    : '';
  return {
    id: o.id, groupId: o.groupId,
    groupName: g?.name ?? `グループ${o.groupId}`,
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
  const [panelGroupId, setPanelGroupId] = useState<number | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    Promise.all([
      api.get<OrderItem[]>(`${EP.orders}?status=pending&status=ready`),
      api.get<Group[]>(`${EP.groups}?status=active&status=bill_requested`),
      api.get<Seat[]>(EP.seats),
      api.get<MenuItem[]>(EP.menus),
      api.get<Category[]>(EP.categories),
      api.get<SubCategory[]>(EP.subcategories),
    ]).then(([o, g, s, m, c, sc]) => {
      setOrders(o);
      setGroups(g);
      setSeats(s);
      setMenus(m);
      setCategories(c);
      setSubCategories(sc);
    }).catch(console.error);

    const t = setInterval(() => setTick(n => n + 1), 60000);

    const onOrderCreated = (o: OrderItem) => {
      if (o.status === 'pending' || o.status === 'ready') setOrders(prev => [...prev, o]);
    };
    const onOrderUpdated = (o: OrderItem) => {
      setOrders(prev => {
        const filtered = prev.filter(x => x.id !== o.id);
        return (o.status === 'pending' || o.status === 'ready') ? [...filtered, o] : filtered;
      });
    };
    const onOrderCancelled = (id: number) => setOrders(prev => prev.filter(o => o.id !== id));
    const onGroupCreated = (g: Group) => setGroups(prev => [...prev, g]);
    const onGroupUpdated = (g: Group) => setGroups(prev =>
      g.status === 'closed' ? prev.filter(x => x.id !== g.id) : prev.map(x => x.id === g.id ? g : x)
    );
    const onSeatUpdated = (s: Seat) => setSeats(prev => prev.map(x => x.id === s.id ? s : x));
    const onMenuSoldout = (menuItemId: number, soldOut: boolean) => {
      setMenus(prev => prev.map(m => m.id === menuItemId ? { ...m, soldOut } : m));
    };

    socket.on(SE.orderCreated,   onOrderCreated);
    socket.on(SE.orderUpdated,   onOrderUpdated);
    socket.on(SE.orderCancelled, onOrderCancelled);
    socket.on(SE.groupCreated,   onGroupCreated);
    socket.on(SE.groupUpdated,   onGroupUpdated);
    socket.on(SE.seatUpdated,    onSeatUpdated);
    socket.on(SE.menuSoldout,    onMenuSoldout);

    return () => {
      clearInterval(t);
      socket.off(SE.orderCreated,   onOrderCreated);
      socket.off(SE.orderUpdated,   onOrderUpdated);
      socket.off(SE.orderCancelled, onOrderCancelled);
      socket.off(SE.groupCreated,   onGroupCreated);
      socket.off(SE.groupUpdated,   onGroupUpdated);
      socket.off(SE.seatUpdated,    onSeatUpdated);
      socket.off(SE.menuSoldout,    onMenuSoldout);
    };
  }, []);

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
    orders.map(o => buildDisplay(o, menus, groups, seats))
  , [orders, menus, groups, seats]);

  const handleReady  = (id: number) => socket.emit(SE.orderComplete, id);
  const handleServed = (id: number) => socket.emit(SE.orderServe, id);

  const pendingOrders = displayOrders.filter(o => o.status === 'pending');
  const pendingCount  = orders.filter(o => o.status === 'pending').length;
  const readyCount    = orders.filter(o => o.status === 'ready').length;

  return (
    <>
      <div className="min-h-dvh bg-surface flex flex-col">

        <AppHeader
          title={
            <>
              {t('kitchen.title')}
              {pendingCount > 0 && (
                <span className="ml-2 text-label bg-surface-deep border border-line text-secondary px-2 py-0.5 rounded-full">{pendingCount}件</span>
              )}
              {readyCount > 0 && (
                <span className="ml-1.5 text-label bg-amber-bg text-bill border border-amber-border px-2 py-0.5 rounded-full">{`🍽 ${t('common.readyToServe')} ${readyCount}件`}</span>
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
      </div>
    </>
  );
}
