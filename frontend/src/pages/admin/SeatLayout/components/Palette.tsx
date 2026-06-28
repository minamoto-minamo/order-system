import { BaseButton } from "@/components";
import { useTranslation } from "react-i18next";

interface PaletteItem {
  type: string;
  icon: string;
  label: string;
  sub: string;
}

interface Props {
  sidebarOpen: boolean;
  onToggle: () => void;
  items: PaletteItem[];
  onPalettePointerDown: (e: React.PointerEvent, type: string, icon: string) => void;
  cols: number;
  rows: number;
  colsMin: number;
  colsMax: number;
  rowsMin: number;
  rowsMax: number;
  gridSize: number;
  gridSizeMin: number;
  gridSizeMax: number;
  hasOutOfBounds: boolean;
  onColsChange: (v: number) => void;
  onRowsChange: (v: number) => void;
  onGridSizeChange: (v: number) => void;
}

export function Palette({ sidebarOpen, onToggle, items, onPalettePointerDown, cols, rows, colsMin, colsMax, rowsMin, rowsMax, gridSize, gridSizeMin, gridSizeMax, hasOutOfBounds, onColsChange, onRowsChange, onGridSizeChange }: Props) {
  const { t } = useTranslation();
  return (
    <div className={`bg-white border-r border-divider shrink-0 flex flex-col overflow-y-auto overflow-x-hidden transition-[width] duration-200 ${sidebarOpen ? 'w-39' : 'w-10'}`}>
      <BaseButton
        className="self-end m-1.5 w-5 h-5 flex items-center justify-center rounded text-muted text-note shrink-0"
        onClick={onToggle}
      >
        {sidebarOpen ? '«' : '»'}
      </BaseButton>
      <div className={`flex flex-col flex-1 ${sidebarOpen ? 'px-3 pb-4' : 'px-1.5 pb-3'}`}>
        {sidebarOpen
          ? <div className="text-label text-muted tracking-widest mb-2.5">{t('common.add')}</div>
          : <div className="text-caption text-dim text-center mb-1.5">{t('seatEditor.addLabel')}</div>
        }
        {items.map(item => (
          <div
            key={item.type}
            className={`palette-item mb-1.75 flex items-center ${sidebarOpen ? 'bg-white border border-line rounded-lg shadow-sm gap-2 px-2.5 py-2.25' : 'justify-center p-1.5'}`}
            onPointerDown={(e) => onPalettePointerDown(e, item.type, item.icon)}
            title={item.label}
          >
            <div className={`w-6.5 h-6.5 bg-surface border border-line flex items-center justify-center text-xs text-secondary shrink-0 ${item.type === 'seat' ? 'rounded-full' : 'rounded-[5px]'}`}>
              {item.icon}
            </div>
            {sidebarOpen && (
              <div className="min-w-0">
                <div className="text-label text-secondary font-medium">{item.label}</div>
                <div className="text-caption text-dim mt-px">{item.sub}</div>
              </div>
            )}
          </div>
        ))}
        {sidebarOpen && (
          <div className="text-caption text-dim text-center pt-1.5 pb-3.5 leading-[1.7]">
            {t('seatEditor.dragHintLine1')}<br />{t('seatEditor.dragHintLine2')}
          </div>
        )}
        {sidebarOpen && (
          <div className="mt-3 pt-3 border-t border-divider">
            <div className="text-label text-muted tracking-widest mb-2">{t('seatEditor.canvasSize')}</div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-caption text-dim w-5">{t('seatEditor.canvasCols')}</span>
                <input
                  type="number" min={colsMin} max={colsMax}
                  value={cols}
                  onChange={e => onColsChange(Math.max(colsMin, Math.min(colsMax, Number(e.target.value))))}
                  className="input-field w-14 text-center text-note"
                />
                <span className="text-caption text-dim">{t('seatEditor.canvasUnit')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-caption text-dim w-5">{t('seatEditor.canvasRows')}</span>
                <input
                  type="number" min={rowsMin} max={rowsMax}
                  value={rows}
                  onChange={e => onRowsChange(Math.max(rowsMin, Math.min(rowsMax, Number(e.target.value))))}
                  className="input-field w-14 text-center text-note"
                />
                <span className="text-caption text-dim">{t('seatEditor.canvasUnit')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-caption text-dim w-5">{t('seatEditor.gridSize')}</span>
                <input
                  type="number" min={gridSizeMin} max={gridSizeMax}
                  value={gridSize}
                  onChange={e => onGridSizeChange(Math.max(gridSizeMin, Math.min(gridSizeMax, Number(e.target.value))))}
                  className="input-field w-14 text-center text-note"
                />
                <span className="text-caption text-dim">px</span>
              </div>
            </div>
            {hasOutOfBounds && (
              <p className="text-caption text-danger mt-1.5">{t('seatEditor.canvasOutOfBounds')}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
