import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { RetryableLoadError } from "@/components/feedback";
import { ActionBar, AppHeader } from "@/features/navigation/components";
import { ToggleButtonGroup } from "@/components/primitives";
import { api } from "@/lib/api";
import { socket } from "@/lib/socket";
import { ROUTES } from "@/lib/routes";
import { EP } from "@/lib/endpoints";
import { SOCKET_EVENTS as SE } from "@/lib/events";
import { useSocketListeners } from "@/hooks/useSocketListeners";
import { isGroupActive } from "@/lib/utils";
import type { OrderItem, Group, Seat, MenuItem, Category, SubCategory } from "@order-system/shared";
import { CategoryLane } from "./components/CategoryLane";
import { CardView } from "./components/CardView";
import { SidePanel } from "./components/SidePanel";
import { buildDisplay } from "./components/utils";
import type { DisplayCat } from "./components/types";
import "./Kitchen.scss";

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
      // コース/飲み放題の定額課金明細は調理対象ではないためキッチン画面には表示しない
      setOrders(o.filter(item => !item.isCourseCharge));
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
      if (o.isCourseCharge) return;
      if (o.status === 'pending' || o.status === 'ready') setOrders(prev => [...prev, o]);
    },
    [SE.orderUpdated]: (o: OrderItem) => {
      if (o.isCourseCharge) return;
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
      .map((cat) => ({
        id: cat.id,
        label: cat.name,
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

  if (loadError) return <RetryableLoadError />;

  return (
    <>
      <AppHeader
          titleTruncate={false}
          title={
            <div className="flex min-w-0 items-center gap-1.5 flex-wrap">
              <span className="text-sub font-medium text-ink whitespace-nowrap">{t('kitchen.title')}</span>
              {pendingCount > 0 && (
                <span className="ml-2 inline-flex items-center rounded-full border border-line bg-surface px-2 py-0.5 text-label text-secondary whitespace-nowrap">
                  {t('kitchen.pendingCount', { count: pendingCount })}
                </span>
              )}
              {readyCount > 0 && (
                <span className="ml-1.5 inline-flex items-center rounded-full border border-amber-border bg-amber-bg px-2 py-0.5 text-label text-amber-fg whitespace-nowrap">
                  {t('common.readyToServe')} {t('kitchen.pendingCount', { count: readyCount })}
                </span>
              )}
            </div>
          }
        />
        <ActionBar
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
