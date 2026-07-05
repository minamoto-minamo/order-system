import { AppHeader, LoadError, NoticeBanner, SubHeader } from "@/components";
import { useSocketListeners } from "@/hooks/useSocketListeners";
import { useToast } from "@/hooks/useToast";
import { api } from "@/lib/api";
import { EP } from "@/lib/endpoints";
import { SOCKET_EVENTS as SE } from "@/lib/events";
import { ROUTES } from "@/lib/routes";
import { socket } from "@/lib/socket";
import { isGroupActive } from "@/lib/utils";
import type { Group, OrderItem, Seat, SeatLayoutResponse, SeatTable } from "@order-system/shared";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { CreateGroupSheet } from "./components/CreateGroupSheet";
import { FloorSeat } from "./components/FloorSeat";
import { FloorTable } from "./components/FloorTable";
import { buildGroupName, getSeatStatus } from "./components/hallUtils";

export default function Hall() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast, showToast } = useToast();
  const [seats, setSeats] = useState<Seat[]>([]);
  const [seatTables, setSeatTables] = useState<SeatTable[]>([]);
  const [canvasCols, setCanvasCols] = useState(16);
  const [canvasRows, setCanvasRows] = useState(12);
  const [gridSize, setGridSize] = useState(48);
  const [groups, setGroups] = useState<Group[]>([]);
  const [readyOrders, setReadyOrders] = useState<OrderItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [guestCount, setGuestCount] = useState(1);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const fetchAll = () => Promise.all([
      api.get<SeatLayoutResponse>(EP.seatLayout),
      api.get<Group[]>(`${EP.groups}?status=active,bill_requested`),
      api.get<OrderItem[]>(`${EP.orders}?status=ready`),
    ]).then(([layout, g, o]) => {
      setLoadError(false);
      const gs = layout.gridSize;
      setGridSize(gs);
      setCanvasCols(layout.canvasCols);
      setCanvasRows(layout.canvasRows);
      setSeats(layout.seats.map(s => ({ ...s, x: s.x * gs, y: s.y * gs })));
      setSeatTables(layout.tables.map(t => ({ ...t, x: t.x * gs, y: t.y * gs, w: t.w * gs, h: t.h * gs })));
      setGroups(g);
      setReadyOrders(o);
    }).catch(() => setLoadError(true));
    fetchAll();
    socket.on('connect', fetchAll);
    return () => { socket.off('connect', fetchAll); };
  }, []);

  useSocketListeners({
    [SE.groupCreated]: (g: Group) => setGroups(prev => [...prev, g]),
    [SE.groupUpdated]: (g: Group) => setGroups(prev =>
      isGroupActive(g)
        ? prev.map(x => x.id === g.id ? g : x)
        : prev.filter(x => x.id !== g.id)
    ),
    [SE.seatLayoutUpdated]: (layout: SeatLayoutResponse) => {
      const gs = layout.gridSize;
      setGridSize(gs);
      setCanvasCols(layout.canvasCols);
      setCanvasRows(layout.canvasRows);
      setSeats(layout.seats.map(s => ({ ...s, x: s.x * gs, y: s.y * gs })));
      setSeatTables(layout.tables.map(t => ({ ...t, x: t.x * gs, y: t.y * gs, w: t.w * gs, h: t.h * gs })));
    },
    [SE.seatCreated]: (s: Seat) => setSeats(prev => [...prev, { ...s, x: s.x * gridSize, y: s.y * gridSize }]),
    [SE.seatUpdated]: (s: Seat) => setSeats(prev => prev.map(x => x.id === s.id ? { ...s, x: s.x * gridSize, y: s.y * gridSize } : x)),
    [SE.orderCreated]: (o: OrderItem) => {
      if (o.status === 'ready') setReadyOrders(prev => [...prev, o]);
    },
    [SE.orderUpdated]: (o: OrderItem) => {
      setReadyOrders(prev => {
        const filtered = prev.filter(x => x.id !== o.id);
        return o.status === 'ready' ? [...filtered, o] : filtered;
      });
    },
    [SE.orderCancelled]: (id: string) => setReadyOrders(prev => prev.filter(o => o.id !== id)),
    [SE.staffCalled]: (_groupId: string, groupName: string) => {
      showToast(`${groupName} ${t('hall.staffCalled')}`);
    },
  });

  const tables = seatTables;

  const readyCountByGroup = useMemo(() => {
    const counts: Record<string, number> = {};
    readyOrders.forEach(o => { counts[o.groupId] = (counts[o.groupId] ?? 0) + 1; });
    return counts;
  }, [readyOrders]);

  const handleTap = (seat: Seat) => {
    const group = groups.find(g => g.seatIds.includes(seat.id) && isGroupActive(g));
    if (group) {
      navigate(ROUTES.hallGroup(group.id));
      return;
    }
    setSelectedIds(prev =>
      prev.includes(seat.id) ? prev.filter(id => id !== seat.id) : [...prev, seat.id]
    );
  };

  const handleTableTap = (table: SeatTable) => {
    const tableSeats = seats.filter(s => s.tableId === table.id);
    const hasOccupied = tableSeats.some(s => groups.some(g => isGroupActive(g) && g.seatIds.includes(s.id)));
    if (hasOccupied) return;
    const ids = tableSeats.map(s => s.id);
    if (ids.length === 0) return;
    // 全席が選択済みならトグルで解除。重複を防ぐため先に既存 ids を除いてから追加
    const allSelected = ids.every(id => selectedIds.includes(id));
    setSelectedIds(prev =>
      allSelected
        ? prev.filter(id => !ids.includes(id))
        : [...prev.filter(id => !ids.includes(id)), ...ids]
    );
  };

  // 選択中でも占有済みの席はグループ作成対象から除く（選択後に他スタッフが着席した場合の競合防止）
  const selectedEmptySeats = selectedIds.filter(id =>
    !groups.some(g => g.seatIds.includes(id) && isGroupActive(g))
  );

  const groupName = buildGroupName(selectedEmptySeats, seats, tables);

  const canCreate = selectedEmptySeats.length > 0;

  const handleCreateGroup = async () => {
    try {
      const group = await api.post<Group>(EP.groups, {
        name: groupName,
        guestCount,
        seatIds: selectedEmptySeats,
      });
      navigate(ROUTES.hallGroup(group.id));
    } catch (e) {
      console.error(e);
    }
  };

  const emptyCnt = seats.filter(s => getSeatStatus(s, groups) === 'empty').length;
  const occupiedCnt = seats.filter(s => getSeatStatus(s, groups) === 'occupied').length;
  const billCnt = seats.filter(s => getSeatStatus(s, groups) === 'bill').length;
  const readyCnt = seats.filter(s => {
    const g = groups.find(gr => gr.seatIds.includes(s.id) && isGroupActive(gr));
    return g && (readyCountByGroup[g.id] ?? 0) > 0;
  }).length;

  const canvasW = canvasCols * gridSize;
  const canvasH = canvasRows * gridSize;
  const bottomPadding = canCreate ? 152 : 24;

  if (loadError) return <LoadError />;

  return (
    <>
      {toast && <NoticeBanner>{toast}</NoticeBanner>}
      <AppHeader title={t('hall.title')} />

      <SubHeader
        left={
          <div className="flex gap-4">
            {[
              { label: t('hall.emptySeat'), count: emptyCnt, color: "var(--color-faint)" },
              { label: t('hall.occupied'), count: occupiedCnt, color: "var(--color-open)" },
              { label: t('common.readyToServe'), count: readyCnt, color: "var(--color-amber)" },
              { label: t('hall.billRequested'), count: billCnt, color: "var(--color-bill)" },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1.25">
                <div className="w-1.75 h-1.75 rounded-full" style={{ background: item.color }} />
                <span className="text-label text-muted">{item.label} {item.count}</span>
              </div>
            ))}
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-4 animate-[fadeIn_0.3s_ease_both]" style={{ paddingBottom: bottomPadding }}>
        <div
          className="relative bg-white border border-divider rounded-[10px]"
          style={{ width: canvasW, height: canvasH, minWidth: canvasW }}
        >
          {tables.map(table => {
            const tableSeats = seats.filter(s => s.tableId === table.id);
            const hasOccupied = tableSeats.some(s => groups.some(g => isGroupActive(g) && g.seatIds.includes(s.id)));
            const ids = tableSeats.map(s => s.id);
            const isSelected = !hasOccupied && ids.length > 0 && ids.every(id => selectedIds.includes(id));
            return (
              <FloorTable key={table.id} table={table} seats={seats} groups={groups} isSelected={isSelected} onTap={handleTableTap} />
            );
          })}
          {seats.map(seat => {
            const status = getSeatStatus(seat, groups);
            const group = groups.find(g => g.seatIds.includes(seat.id) && isGroupActive(g)) ?? null;
            return (
              <FloorSeat
                key={seat.id}
                seat={seat}
                status={status}
                group={group}
                readyCount={group ? (readyCountByGroup[group.id] ?? 0) : 0}
                isSelected={selectedIds.includes(seat.id)}
                onTap={handleTap}
                G={gridSize}
              />
            );
          })}
        </div>
      </div>

      <CreateGroupSheet
        canCreate={canCreate}
        groupName={groupName}
        guestCount={guestCount}
        showModal={showCreateModal}
        onOpenModal={() => { setGuestCount(1); setShowCreateModal(true); }}
        onCloseModal={() => setShowCreateModal(false)}
        onGuestCountChange={setGuestCount}
        onCreate={handleCreateGroup}
      />

    </>
  );
}
