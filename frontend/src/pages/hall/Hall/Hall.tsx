import { AppHeader, BaseButton, BottomSheetModal, QuantityControl, SubHeader } from "@/components";
import { useSocketListeners } from "@/hooks/useSocketListeners";
import { api } from "@/lib/api";
import { EP } from "@/lib/endpoints";
import { SOCKET_EVENTS as SE } from "@/lib/events";
import { ROUTES } from "@/lib/routes";
import { isGroupActive } from "@/lib/utils";
import type { Group, OrderItem, Seat, SeatLayoutResponse, SeatTable } from "@order-system/shared";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { SeatStatus } from "./components/FloorSeat";
import { FloorSeat } from "./components/FloorSeat";
import { FloorTable } from "./components/FloorTable";

function getSeatStatus(seat: Seat, groups: Group[]): SeatStatus {
  const g = groups.find(gr => gr.seatIds.includes(seat.id) && isGroupActive(gr));
  if (!g) return 'empty';
  if (g.status === 'bill_requested') return 'bill';
  return 'occupied';
}

export default function Hall() {
  const navigate = useNavigate();
  const { t } = useTranslation();
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

  useEffect(() => {
    Promise.all([
      api.get<SeatLayoutResponse>(EP.seatLayout),
      api.get<Group[]>(`${EP.groups}?status=active,bill_requested`),
      api.get<OrderItem[]>(`${EP.orders}?status=ready`),
    ]).then(([layout, g, o]) => {
      const gs = layout.gridSize;
      setGridSize(gs);
      setCanvasCols(layout.canvasCols);
      setCanvasRows(layout.canvasRows);
      setSeats(layout.seats.map(s => ({ ...s, x: s.x * gs, y: s.y * gs })));
      setSeatTables(layout.tables.map(t => ({ ...t, x: t.x * gs, y: t.y * gs, w: t.w * gs, h: t.h * gs })));
      setGroups(g);
      setReadyOrders(o);
    }).catch(console.error);
  }, []);

  useSocketListeners({
    [SE.groupCreated]: (g: Group) => setGroups(prev => [...prev, g]),
    [SE.groupUpdated]: (g: Group) => setGroups(prev =>
      isGroupActive(g)
        ? prev.map(x => x.id === g.id ? g : x)
        : prev.filter(x => x.id !== g.id)
    ),
    [SE.seatUpdated]: (s: Seat) => setSeats(prev => prev.map(x => x.id === s.id ? s : x)),
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

  // グループ名を席ラベルから自動生成。テーブル単位のラベルを先にまとめ、単独席を後ろに並べる
  const groupName = (() => {
    if (selectedEmptySeats.length === 0) return '';
    const seenTableIds = new Set<number>();
    const tableParts: string[] = [];
    const standaloneParts: string[] = [];
    for (const id of selectedEmptySeats) {
      const seat = seats.find(s => s.id === id);
      if (!seat) continue;
      if (seat.tableId !== null) {
        if (!seenTableIds.has(seat.tableId)) {
          seenTableIds.add(seat.tableId);
          const table = tables.find(t => t.id === seat.tableId);
          if (table) tableParts.push(table.label);
        }
      } else {
        standaloneParts.push(seat.label);
      }
    }
    return [...tableParts, ...standaloneParts].join('・');
  })();

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

  return (
    <>
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

      <div className="flex-1 overflow-auto p-4 animate-[fadeIn_0.3s_ease_both]">
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

      {canCreate && (
        <div className="fixed bottom-0 left-0 right-0 z-modal px-5 py-3.5 bg-white border-t border-divider animate-[slideUp_0.2s_ease_both]">
          <div className="text-label text-muted mb-2 text-center">
            {t('hall.seatsSelected', { seats: groupName })}
          </div>
          <BaseButton
            variant="primary"
            onClick={() => { setGuestCount(1); setShowCreateModal(true); }}
            className="w-full rounded-[10px] p-3.5 text-sm font-medium tracking-[0.04em]"
          >
            {t('hall.createGroup')}
          </BaseButton>
        </div>
      )}

      <BottomSheetModal
        show={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        secondaryAction={{ label: t('common.cancel'), onClick: () => setShowCreateModal(false) }}
        primaryAction={{ label: t('hall.createGroupAction', { count: guestCount }), onClick: () => { handleCreateGroup(); } }}
      >
        <div className="text-sub font-medium text-ink mb-1">
          {t('hall.createGroup')}
        </div>
        <div className="text-xs text-muted mb-5">
          {groupName}
        </div>
        <div className="mb-6">
          <div className="text-xs text-dim mb-2.5">{t('hall.guestCount')}</div>
          <QuantityControl value={guestCount} onChange={setGuestCount} min={1} unit="名" />
        </div>
      </BottomSheetModal>

    </>
  );
}
