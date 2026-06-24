import type { SeatTable, Seat, Group } from "@order-system/shared";
import { isGroupActive } from "@/lib/utils";

export function FloorTable({ table, seats, groups, isSelected, onTap }: {
  table: SeatTable; seats: Seat[]; groups: Group[]; isSelected: boolean; onTap: (table: SeatTable) => void;
}) {
  const tableSeats = seats.filter(s => s.tableId === table.id);
  const hasOccupied = tableSeats.some(s => groups.some(g => isGroupActive(g) && g.seatIds.includes(s.id)));
  return (
    <>
      <div
        className={`absolute z-1 rounded-lg border-[1.5px] border-dashed ${
          isSelected ? 'bg-info-bg border-info' : hasOccupied ? 'bg-surface border-line' : 'tappable bg-white border-divider'
        }`}
        style={{ left: table.x, top: table.y, width: table.w, height: table.h }}
        onClick={() => onTap(table)}
      />
      <span
        className={`absolute z-20 text-micro pointer-events-none ${isSelected ? 'text-info' : 'text-dim'}`}
        style={{ left: table.x + 6, top: table.y + 4 }}
      >
        {table.label}
      </span>
    </>
  );
}
