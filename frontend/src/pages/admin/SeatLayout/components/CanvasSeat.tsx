import { G } from "./types";
import type { SeatData } from "./types";

interface Props {
  seat: SeatData;
  isSelected: boolean;
  onPointerDown: (e: React.PointerEvent, kind: "table" | "seat", id: number) => void;
  onClick: (kind: "table" | "seat", id: number) => void;
}

export function CanvasSeat({ seat, isSelected, onPointerDown, onClick }: Props) {
  return (
    <div
      className={`draggable absolute rounded-full flex items-center justify-center z-10 border ${isSelected ? 'bg-info-bg border-info shadow-[0_0_0_2px_var(--color-info-glow)]' : 'bg-white border-line shadow-[0_1px_4px_rgba(0,0,0,0.06)]'}`}
      onPointerDown={(e) => onPointerDown(e, "seat", seat.id)}
      onClick={(e) => { e.stopPropagation(); onClick("seat", seat.id); }}
      style={{ left: seat.x + 3, top: seat.y + 3, width: G - 8, height: G - 8 }}
    >
      <span className={`text-label font-medium pointer-events-none ${isSelected ? 'text-info-dark' : 'text-secondary'}`}>
        {seat.label}
      </span>
    </div>
  );
}
