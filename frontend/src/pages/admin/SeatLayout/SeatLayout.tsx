import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { RetryableLoadError } from "@/components/feedback";
import { ActionBar, AppHeader } from "@/features/navigation/components";
import { api } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { useToastStore } from "@/stores/toast";
import { ROUTES } from "@/lib/routes";
import { EP } from "@/lib/endpoints";
import { SYMBOL_ICONS } from "@/lib/icons";
import { Palette } from "./components/Palette";
import { EditSheet } from "./components/EditSheet";
import { StatsBar } from "./components/StatsBar";
import { EditorCanvas } from "./components/EditorCanvas";
import { snap, hitTest } from "./components/utils";
import type { SeatLayoutResponse, SeatLayoutSaveRequest } from "@order-system/shared";
import type { TableData, SeatData, SelectedItem, DragState } from "./components/types";
import "./SeatLayout.scss";

// ── メイン ───────────────────────────────────────────────────
export default function SeatLayout() {
  const { t } = useTranslation();
  const showToast = useToastStore((state) => state.showToast);
  const [tables, setTables] = useState<TableData[]>([]);
  const [seats,  setSeats]  = useState<SeatData[]>([]);
  const [cols, setCols] = useState(16);
  const [rows, setRows] = useState(12);
  const [colsMin, setColsMin] = useState(8);
  const [colsMax, setColsMax] = useState(32);
  const [rowsMin, setRowsMin] = useState(6);
  const [rowsMax, setRowsMax] = useState(24);
  const [gridSize, setGridSize] = useState(48);
  const [gridSizeMin, setGridSizeMin] = useState(32);
  const [gridSizeMax, setGridSizeMax] = useState(80);
  const [selected, setSelected] = useState<SelectedItem | null>(null);
	  const [saved, setSaved] = useState(false);
	  const [sidebarOpen, setSidebarOpen] = useState(true);
	  const [loadError, setLoadError] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);

  const originalSeatsRef   = useRef<SeatLayoutResponse['seats']>([]);
  const originalTablesRef  = useRef<SeatLayoutResponse['tables']>([]);
  // 仮ID: 負数にすることでDBが発行する正数IDと衝突しない
  const nextSeatIdRef      = useRef(-1);
  const nextTableIdRef     = useRef(-1);

  // ── 初期ロード ─────────────────────────────────────────────
	  useEffect(() => {
	    api.get<SeatLayoutResponse>(EP.seatLayout).then(data => {
	      setLoadError(false)
	      originalSeatsRef.current = data.seats
      originalTablesRef.current = data.tables
      setCols(data.canvasCols)
      setRows(data.canvasRows)
      setColsMin(data.canvasColsMin)
      setColsMax(data.canvasColsMax)
      setRowsMin(data.canvasRowsMin)
      setRowsMax(data.canvasRowsMax)
      setGridSize(data.gridSize)
      setGridSizeMin(data.gridSizeMin)
      setGridSizeMax(data.gridSizeMax)
      const g = data.gridSize
      setSeats(data.seats.map(s => ({ id: s.id, label: s.label, x: s.x * g, y: s.y * g, tableId: s.tableId })))
      setTables(data.tables.map(t => ({ id: t.id, label: t.label, x: t.x * g, y: t.y * g, w: t.w * g, h: t.h * g })))
	    }).catch(() => setLoadError(true))
	  }, [])

  // ── 保存 ──────────────────────────────────────────────────
  const handleSave = async () => {
    const resolvedSeats = seats.map(s => ({
      ...s,
      tableId: tables.find(t => hitTest(s, t))?.id ?? null,
    }));

    const payload: SeatLayoutSaveRequest = {
      canvasCols: cols,
      canvasRows: rows,
      gridSize,
      tables: tables.map(t => ({ ...t, x: t.x / gridSize, y: t.y / gridSize, w: t.w / gridSize, h: t.h / gridSize })),
      seats: resolvedSeats.map(s => ({ ...s, x: s.x / gridSize, y: s.y / gridSize })),
    }

    try {
      const fresh = await api.put<SeatLayoutResponse>(EP.seatLayout, payload)
      originalSeatsRef.current  = fresh.seats
      originalTablesRef.current = fresh.tables
      const g = fresh.gridSize
      setSeats(fresh.seats.map(s => ({ id: s.id, label: s.label, x: s.x * g, y: s.y * g, tableId: s.tableId })))
      setTables(fresh.tables.map(t => ({ id: t.id, label: t.label, x: t.x * g, y: t.y * g, w: t.w * g, h: t.h * g })))
      setCols(fresh.canvasCols)
      setRows(fresh.canvasRows)
      setColsMin(fresh.canvasColsMin)
      setColsMax(fresh.canvasColsMax)
      setRowsMin(fresh.canvasRowsMin)
      setRowsMax(fresh.canvasRowsMax)
      setGridSize(fresh.gridSize)
      setGridSizeMin(fresh.gridSizeMin)
      setGridSizeMax(fresh.gridSizeMax)
      nextSeatIdRef.current  = -1
      nextTableIdRef.current = -1
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      showToast(apiErrorMessage(e, t('common.saveFailed')))
    }
  };

  // ── 汎用ドラッグ開始 ─────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent, kind: "table" | "seat", id: number) => {
    e.preventDefault();
    e.stopPropagation();
    setSelected({ kind, id });
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    if (kind === "seat") {
      const seat = seats.find(s => s.id === id);
      if (!seat) return;
      drag.current = { kind, id, ox: e.clientX - rect.left - seat.x, oy: e.clientY - rect.top - seat.y };
    } else {
      const table = tables.find(t => t.id === id);
      if (!table) return;
      drag.current = {
        kind, id,
        ox: e.clientX - rect.left - table.x,
        oy: e.clientY - rect.top  - table.y,
      };
    }

    const onMove = (e2: PointerEvent) => {
      const d = drag.current;
      const canvas = canvasRef.current;
      if (!d || !canvas) return;
      const r = canvas.getBoundingClientRect();
      const nx = snap(Math.max(0, e2.clientX - r.left - d.ox), gridSize);
      const ny = snap(Math.max(0, e2.clientY - r.top  - d.oy), gridSize);

      if (d.kind === "seat") {
        setSeats(prev => prev.map(s => s.id === d.id ? { ...s, x: nx, y: ny } : s));
      } else {
        setTables(prev => prev.map(t => t.id === d.id ? { ...t, x: nx, y: ny } : t));
      }
    };

    const onUp = () => {
      drag.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [seats, tables, gridSize]);

  // ── リサイズ ─────────────────────────────────────────────
  const handleResizeStart = useCallback((e: React.PointerEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    const table = tables.find(t => t.id === id);
    if (!table) return;
    drag.current = { kind: "resize", id, ox: e.clientX, oy: e.clientY, initW: table.w, initH: table.h };

    const onMove = (e2: PointerEvent) => {
      const d = drag.current;
      if (!d || d.kind !== "resize") return;
      const newW = Math.max(gridSize, snap(d.initW! + e2.clientX - d.ox, gridSize));
      const newH = Math.max(gridSize, snap(d.initH! + e2.clientY - d.oy, gridSize));
      setTables(prev => prev.map(t => t.id === d.id ? { ...t, w: newW, h: newH } : t));
    };
    const onUp = () => {
      drag.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [tables, gridSize]);

  // ── パレットからドロップ ─────────────────────────────────
  const addItemAt = useCallback((type: string, clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return;
    const x = snap(Math.max(0, clientX - rect.left - gridSize / 2), gridSize);
    const y = snap(Math.max(0, clientY - rect.top  - gridSize / 2), gridSize);
    if (type === "table") {
      const tableId = nextTableIdRef.current--;
      const newTable: TableData = { id: tableId, label: t('seatEditor.defaultTableLabel', { n: tables.length + 1 }), x, y, w: gridSize*3, h: gridSize*2 };
      setTables(prev => [...prev, newTable]);
      setSelected({ kind: "table", id: tableId });
    } else {
      const cnt = seats.filter(s => s.label.startsWith("S")).length;
      const newSeat: SeatData = { id: nextSeatIdRef.current--, label: `S${cnt + 1}`, x, y, tableId: null };
      setSeats(prev => [...prev, newSeat]);
      setSelected({ kind: "seat", id: newSeat.id });
    }
  }, [seats, tables, gridSize]);

  const handlePalettePointerDown = (e: React.PointerEvent, type: string, icon: string) => {
    e.preventDefault();
    const ghost = document.createElement("div");
    Object.assign(ghost.style, {
      position: "fixed", pointerEvents: "none", zIndex: "9999",
      width: "44px", height: "44px", borderRadius: "10px",
      background: "white", border: "1.5px solid var(--color-line)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "var(--color-secondary)", opacity: "0.85",
      transform: "translate(-50%, -50%)",
      left: e.clientX + "px", top: e.clientY + "px",
    });
    const ghostIcon = document.createElement("span");
    Object.assign(ghostIcon.style, {
      WebkitMaskImage: `url(${icon})`,
      maskImage: `url(${icon})`,
      maskSize: "contain",
      maskRepeat: "no-repeat",
      maskPosition: "center",
      backgroundColor: "currentColor",
      display: "inline-block",
      width: "20px",
      height: "20px",
    });
    ghost.appendChild(ghostIcon);
    document.body.appendChild(ghost);
    const onMove = (e2: PointerEvent) => {
      ghost.style.left = e2.clientX + "px";
      ghost.style.top = e2.clientY + "px";
    };
    const onUp = (e2: PointerEvent) => {
      document.body.removeChild(ghost);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      addItemAt(type, e2.clientX, e2.clientY);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // ── グリッドサイズ変更 ───────────────────────────────────
  const handleGridSizeChange = useCallback((newG: number) => {
    const ratio = newG / gridSize;
    setSeats(prev => prev.map(s => ({ ...s, x: snap(s.x * ratio, newG), y: snap(s.y * ratio, newG) })));
    setTables(prev => prev.map(t => ({
      ...t,
      x: snap(t.x * ratio, newG), y: snap(t.y * ratio, newG),
      w: snap(t.w * ratio, newG), h: snap(t.h * ratio, newG),
    })));
    setGridSize(newG);
  }, [gridSize]);

  // ── 削除 ─────────────────────────────────────────────────
  const handleDelete = () => {
    if (!selected) return;
    if (selected.kind === "table") {
      setTables(prev => prev.filter(t => t.id !== selected.id));
      setSeats(prev => prev.map(s => s.tableId === selected.id ? { ...s, tableId: null } : s));
    } else {
      setSeats(prev => prev.filter(s => s.id !== selected.id));
    }
    setSelected(null);
  };

  // ── ラベル編集 ───────────────────────────────────────────
  const handleLabelChange = (val: string) => {
    if (!selected) return;
    if (selected.kind === "table") {
      setTables(prev => prev.map(t => t.id === selected.id ? { ...t, label: val } : t));
    } else {
      setSeats(prev => prev.map(s => s.id === selected.id ? { ...s, label: val } : s));
    }
  };

  const selectedItem = selected
    ? selected.kind === "table"
      ? tables.find(t => t.id === selected.id)
      : seats.find(s => s.id === selected.id)
    : null;

  const counterSeats = seats.filter(s => s.tableId === null);
  const tableSeats   = seats.filter(s => s.tableId !== null);

  const hasOutOfBounds =
    seats.some(s => s.x >= cols * gridSize || s.y >= rows * gridSize) ||
    tables.some(t => t.x + t.w > cols * gridSize || t.y + t.h > rows * gridSize);

  const paletteItems = [
    { type: "table", icon: SYMBOL_ICONS.table, label: t('seatEditor.table'), sub: t('seatEditor.tableSub') },
    { type: "seat",  icon: SYMBOL_ICONS.seat,  label: t('seatEditor.seat'),  sub: t('seatEditor.seatSub') },
  ];

	  if (loadError) return <RetryableLoadError />;

	  return (
    <>
      <AppHeader
          title={t('admin.seats')}
          breadcrumb={{ label: t('admin.menuTitle'), to: ROUTES.admin }}
        />
        <ActionBar
          right={
            <button
              onClick={handleSave}
              disabled={hasOutOfBounds}
              className={`border-none rounded-lg px-4 py-1.5 text-note font-medium transition-all ${hasOutOfBounds ? 'bg-surface text-faint cursor-not-allowed' : saved ? 'bg-success-bg text-success-fg cursor-pointer' : 'bg-brand text-white cursor-pointer'}`}
            >
              {saved ? t('common.saved') : t('common.save')}
            </button>
          }
        />

        {/* ボディ */}
        <div className="flex-1 flex overflow-hidden">

          {/* 左サイドバー */}
          <Palette
            sidebarOpen={sidebarOpen}
            onToggle={() => setSidebarOpen(v => !v)}
            items={paletteItems}
            onPalettePointerDown={handlePalettePointerDown}
            cols={cols}
            rows={rows}
            colsMin={colsMin}
            colsMax={colsMax}
            rowsMin={rowsMin}
            rowsMax={rowsMax}
            gridSize={gridSize}
            gridSizeMin={gridSizeMin}
            gridSizeMax={gridSizeMax}
            hasOutOfBounds={hasOutOfBounds}
            onColsChange={setCols}
            onRowsChange={setRows}
            onGridSizeChange={handleGridSizeChange}
          />

          {/* キャンバスエリア */}
          <EditorCanvas
            canvasRef={canvasRef}
            gridSize={gridSize}
            cols={cols}
            rows={rows}
            tables={tables}
            seats={seats}
            selected={selected}
            onPointerDown={handlePointerDown}
            onResizeStart={handleResizeStart}
            onSelect={setSelected}
            onClearSelect={() => setSelected(null)}
          />
        </div>

      {/* 編集モーダル */}
      {selectedItem && selected && (
        <EditSheet
          item={selectedItem}
          selected={selected}
          onLabelChange={handleLabelChange}
          onDelete={handleDelete}
          onClose={() => setSelected(null)}
          G={gridSize}
        />
      )}

        {/* フッター */}
        <StatsBar
          tableCount={tables.length}
          tableSeatCount={tableSeats.length}
          counterSeatCount={counterSeats.length}
          totalSeatCount={seats.length}
        />

    </>
  );
}
