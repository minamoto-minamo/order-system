import { useTranslation } from "react-i18next";
import { Icon } from "@/components/primitives";
import { SYMBOL_ICONS } from "@/lib/icons";
import type { Seat, Group } from "@order-system/shared";
import "./FloorSeat.scss";

export type SeatStatus = 'empty' | 'occupied' | 'bill';

const S = {
  empty:         { bg: "white",                    border: "var(--color-line)",         text: "var(--color-secondary)" },
  occupied:      { bg: "var(--color-success-bg)",  border: "var(--color-open-border)",  text: "var(--color-ink)" },
  occupiedReady: { bg: "var(--color-amber-bg)",    border: "var(--color-amber-border)", text: "var(--color-ink)" },
  bill:          { bg: "var(--color-bill-bg)",     border: "var(--color-bill-border)",  text: "var(--color-ink)" },
  selected:      { bg: "var(--color-info-bg)",     border: "var(--color-info)",         text: "var(--color-info-dark)" },
};

interface Props {
  seat: Seat;
  status: SeatStatus;
  group: Group | null;
  readyCount: number;
  isSelected: boolean;
  onTap: (seat: Seat) => void;
  G: number;
}

export function FloorSeat({ seat, status, group, readyCount, isSelected, onTap, G }: Props) {
  const { t } = useTranslation();
  const st = isSelected ? S.selected : (status === 'occupied' && readyCount > 0) ? S.occupiedReady : S[status];
  return (
    <div
      className="seat-cell absolute z-10 flex flex-col items-center justify-center gap-px rounded-full border"
      onClick={() => onTap(seat)}
      style={{
        left: seat.x + 3, top: seat.y + 3,
        width: G - 8, height: G - 8,
        background: st.bg, borderColor: st.border,
        boxShadow: isSelected
          ? "0 0 0 2px var(--color-info-glow)"
          : status === "bill"
          ? "0 0 0 1px var(--color-bill-glow)"
          : status === "occupied" && readyCount > 0
          ? "0 0 0 1px var(--color-amber-border)"
          : "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      <span className="text-caption font-medium" style={{ color: st.text }}>{seat.label}</span>
      {status === "bill" && (
        <span className="text-nano font-medium text-bill-fg">{t('hall.billShort')}</span>
      )}
      {status === "occupied" && group && (
        readyCount > 0
          ? <span className="inline-flex items-center gap-0.5 text-nano font-medium text-amber-fg"><Icon src={SYMBOL_ICONS.dining} />{readyCount}件</span>
          : <span className="text-nano text-dim">{t('hall.occupied')}</span>
      )}
    </div>
  );
}
