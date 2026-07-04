import type { RefObject } from "react";
import { CanvasTable } from "./CanvasTable";
import { CanvasSeat } from "./CanvasSeat";
import type { TableData, SeatData, SelectedItem } from "./types";

export function EditorCanvas({ canvasRef, gridSize, cols, rows, tables, seats, selected, onPointerDown, onResizeStart, onSelect, onClearSelect }: {
  canvasRef: RefObject<HTMLDivElement>;
  gridSize: number;
  cols: number;
  rows: number;
  tables: TableData[];
  seats: SeatData[];
  selected: SelectedItem | null;
  onPointerDown: (e: React.PointerEvent, kind: "table" | "seat", id: number) => void;
  onResizeStart: (e: React.PointerEvent, id: number) => void;
  onSelect: (item: SelectedItem) => void;
  onClearSelect: () => void;
}) {
  return (
    <div className="flex-1 overflow-auto pb-52">
      <div
        ref={canvasRef}
        onClick={onClearSelect}
        className="relative m-5 rounded-lg border border-line bg-white"
        style={{
          width: gridSize * cols, height: gridSize * rows,
          backgroundImage: `
            linear-gradient(to right, var(--color-surface-deep) 1px, transparent 1px),
            linear-gradient(to bottom, var(--color-surface-deep) 1px, transparent 1px)
          `,
          backgroundSize: `${gridSize}px ${gridSize}px`,
        }}
      >
        {tables.map(table => (
          <CanvasTable
            key={table.id}
            table={table}
            isSelected={selected?.kind === "table" && selected.id === table.id}
            onPointerDown={onPointerDown}
            onClick={(kind, id) => onSelect({ kind, id })}
            onResizeStart={onResizeStart}
          />
        ))}
        {seats.map(seat => (
          <CanvasSeat
            key={seat.id}
            seat={seat}
            isSelected={selected?.kind === "seat" && selected.id === seat.id}
            onPointerDown={onPointerDown}
            onClick={(kind, id) => onSelect({ kind, id })}
            G={gridSize}
          />
        ))}
      </div>
    </div>
  );
}
