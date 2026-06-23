import { useTranslation } from "react-i18next";
import { G } from "./types";
import type { TableData, SeatData, SelectedItem } from "./types";

interface Props {
  item: TableData | SeatData;
  selected: SelectedItem;
  onLabelChange: (val: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function EditModal({ item, selected, onLabelChange, onDelete, onClose }: Props) {
  const { t } = useTranslation();
  return (
    <div className="fixed bottom-0 left-0 right-0 z-200 flex justify-center pointer-events-none animate-[slideUp_0.2s_ease_both]">
      <div className="pointer-events-auto bg-white rounded-t-2xl px-5 pt-4 pb-8 w-full max-w-lg shadow-xl border-t border-divider">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-ink">
            {selected.kind === "table" ? t('seatEditor.editTable') : t('seatEditor.editSeat')}
          </div>
          <button className="action-btn w-6 h-6 flex items-center justify-center rounded text-muted text-note" onClick={onClose}>×</button>
        </div>
        <div className="text-label text-dim mb-1">{t('seatEditor.labelName')}</div>
        <input
          value={item.label}
          onChange={(e) => onLabelChange(e.target.value)}
          className="input-field w-full border border-line rounded-[7px] px-3 py-2.25 text-sm outline-none text-ink mb-3"
        />
        {selected.kind === "table" && (
          <div className="text-caption text-dim mb-3 leading-[1.6]">
            {Math.round((item as TableData).w / G)} × {Math.round((item as TableData).h / G)} {t('seatEditor.cellUnit')}
            <span className="ml-1">{t('seatEditor.resizeHint')}</span>
          </div>
        )}
        {selected.kind === "seat" && (
          <div className="text-caption text-dim mb-3 leading-[1.6]">
            {t('seatEditor.tableHint')}
          </div>
        )}
        <div className="flex gap-2">
          <button className="action-btn flex-1 py-2.25 border border-danger-border rounded-lg text-note text-danger bg-white" onClick={onDelete}>
            {t('common.delete')}
          </button>
          <button className="action-btn flex-1 py-2.25 border-none rounded-lg text-note text-white bg-ink font-medium" onClick={onClose}>
            {t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
