import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BaseButton, Toast } from "@/components";
import { api } from "@/lib/api";
import { EP } from "@/lib/endpoints";
import { isGroupActive } from "@/lib/utils";
import type { Group, Seat, SeatLayoutResponse, SeatTable } from "@order-system/shared";
import type { SeatStatus } from "@/pages/hall/Hall/components/FloorSeat";
import { FloorSeat } from "@/pages/hall/Hall/components/FloorSeat";
import { FloorTable } from "@/pages/hall/Hall/components/FloorTable";

function getSeatStatus(seat: Seat, groups: Group[]): SeatStatus {
  const g = groups.find(gr => gr.seatIds.includes(seat.id) && isGroupActive(gr));
  if (!g) return 'empty';
  if (g.status === 'bill_requested') return 'bill';
  return 'occupied';
}

function generateGroupName(seatIds: number[], seats: Seat[], tables: SeatTable[]): string {
  const seenTableIds = new Set<number>();
  const tableParts: string[] = [];
  const standaloneParts: string[] = [];
  for (const id of seatIds) {
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
}

interface Props {
  show: boolean;
  currentGroupId: string;
  currentSeatIds: number[];
  disabled?: boolean;
  onConfirm: (seatIds: number[], name: string) => void;
  onClose: () => void;
}

export function ChangeSeatModal({ show, currentGroupId, currentSeatIds, disabled, onConfirm, onClose }: Props) {
  const { t } = useTranslation();
  const [seats, setSeats] = useState<Seat[]>([]);
  const [tables, setTables] = useState<SeatTable[]>([]);
  const [canvasCols, setCanvasCols] = useState(16);
  const [canvasRows, setCanvasRows] = useState(12);
	  const [gridSize, setGridSize] = useState(48);
	  const [otherGroups, setOtherGroups] = useState<Group[]>([]);
	  const [selectedIds, setSelectedIds] = useState<number[]>([]);
	  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!show) return;
    setSelectedIds(currentSeatIds);
    Promise.all([
      api.get<SeatLayoutResponse>(EP.seatLayout),
      api.get<Group[]>(`${EP.groups}?status=active,bill_requested`),
	    ]).then(([layout, groups]) => {
	      setLoadError(false);
	      const gs = layout.gridSize;
      setGridSize(gs);
      setCanvasCols(layout.canvasCols);
      setCanvasRows(layout.canvasRows);
      setSeats(layout.seats.map(s => ({ ...s, x: s.x * gs, y: s.y * gs })));
      setTables(layout.tables.map(t => ({ ...t, x: t.x * gs, y: t.y * gs, w: t.w * gs, h: t.h * gs })));
      setOtherGroups(groups.filter(g => g.id !== currentGroupId));
	    }).catch(() => setLoadError(true));
  }, [show, currentGroupId, currentSeatIds]);

  if (!show) return null;

  const handleSeatTap = (seat: Seat) => {
    const occupied = otherGroups.some(g => g.seatIds.includes(seat.id) && isGroupActive(g));
    if (occupied) return;
    setSelectedIds(prev =>
      prev.includes(seat.id) ? prev.filter(id => id !== seat.id) : [...prev, seat.id]
    );
  };

  const handleTableTap = (table: SeatTable) => {
    const tableSeats = seats.filter(s => s.tableId === table.id);
    const hasOccupied = tableSeats.some(s => otherGroups.some(g => isGroupActive(g) && g.seatIds.includes(s.id)));
    if (hasOccupied) return;
    const ids = tableSeats.map(s => s.id);
    if (ids.length === 0) return;
    const allSelected = ids.every(id => selectedIds.includes(id));
    setSelectedIds(prev =>
      allSelected
        ? prev.filter(id => !ids.includes(id))
        : [...prev.filter(id => !ids.includes(id)), ...ids]
    );
  };

  const handleConfirm = () => {
    const name = generateGroupName(selectedIds, seats, tables);
    onConfirm(selectedIds, name);
  };

  const canvasW = canvasCols * gridSize;
  const canvasH = canvasRows * gridSize;

  return (
    <div className="fixed inset-0 z-modal bg-surface flex flex-col">
      <div className="bg-white border-b border-divider px-4 py-3 flex items-center gap-3 shrink-0">
        <BaseButton
          variant="ghost"
          className="px-2 py-1 rounded-md text-sm text-dim"
          onClick={onClose}
        >
          {t('common.cancel')}
        </BaseButton>
        <div className="flex-1 text-center text-sub font-medium text-ink">
          {t('group.changeSeat')}
        </div>
        <BaseButton
          variant="primary"
          className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40"
          onClick={handleConfirm}
	          disabled={disabled || loadError || selectedIds.length === 0}
        >
          {t('group.changeSeatConfirm')}
        </BaseButton>
      </div>

	      <div className="flex-1 overflow-auto p-4">
	        {loadError ? (
	          <div className="h-full" />
	        ) : (
	          <div
	            className="relative bg-white border border-divider rounded-[10px]"
	            style={{ width: canvasW, height: canvasH, minWidth: canvasW }}
	          >
	            {tables.map(table => {
	              const tableSeats = seats.filter(s => s.tableId === table.id);
	              const hasOccupied = tableSeats.some(s => otherGroups.some(g => isGroupActive(g) && g.seatIds.includes(s.id)));
	              const ids = tableSeats.map(s => s.id);
	              const isSelected = !hasOccupied && ids.length > 0 && ids.every(id => selectedIds.includes(id));
	              return (
	                <FloorTable
	                  key={table.id}
	                  table={table}
	                  seats={seats}
	                  groups={otherGroups}
	                  isSelected={isSelected}
	                  onTap={handleTableTap}
	                />
	              );
	            })}
	            {seats.map(seat => {
	              const status = getSeatStatus(seat, otherGroups);
	              const isSelected = selectedIds.includes(seat.id);
	              return (
	                <FloorSeat
	                  key={seat.id}
	                  seat={seat}
	                  status={status}
	                  group={null}
	                  readyCount={0}
	                  isSelected={isSelected}
	                  onTap={handleSeatTap}
	                  G={gridSize}
	                />
	              );
	            })}
	          </div>
	        )}
	      </div>
	      <Toast message={loadError ? t('common.loadError') : null} />
    </div>
  );
}
