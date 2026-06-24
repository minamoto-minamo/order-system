import type { TableData } from "./types";

interface Props {
  table: TableData;
  isSelected: boolean;
  onPointerDown: (e: React.PointerEvent, kind: "table" | "seat", id: number) => void;
  onClick: (kind: "table" | "seat", id: number) => void;
  onResizeStart: (e: React.PointerEvent, id: number) => void;
}

export function CanvasTable({ table, isSelected, onPointerDown, onClick, onResizeStart }: Props) {
  return (
    <>
      <div
        className={`draggable absolute rounded-lg z-1 border-[1.5px] ${isSelected ? 'bg-info-bg border-solid border-info' : 'bg-surface border-dashed border-line'}`}
        onPointerDown={(e) => onPointerDown(e, "table", table.id)}
        onClick={(e) => { e.stopPropagation(); onClick("table", table.id); }}
        style={{ left: table.x, top: table.y, width: table.w, height: table.h }}
      >
        {isSelected && (
          <div
            className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 border-r-2 border-b-2 border-info rounded-sm"
            style={{ cursor: 'se-resize' }}
            onPointerDown={(e) => { e.stopPropagation(); onResizeStart(e, table.id); }}
          />
        )}
      </div>
      <span
        className={`absolute z-20 text-caption font-normal tracking-[0.04em] pointer-events-none ${isSelected ? 'text-info' : 'text-muted'}`}
        style={{ left: table.x + 8, top: table.y + 4 }}
      >
        {table.label}
      </span>
    </>
  );
}
