import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AppHeader, SubHeader } from "@/components";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/routes";
import { EP } from "@/lib/endpoints";
import { TableRect } from "./TableRect";
import { SeatCell } from "./SeatCell";
import { Palette } from "./Palette";
import { EditModal } from "./EditModal";
import { FooterBar } from "./FooterBar";
import type { TableData, SeatData, SelectedItem, DragState, ApiSeat, ApiTable } from "./types";
import { G } from "./types";
import "./SeatLayout.scss";

const snap = (v: number) => Math.round(v / G) * G;

function hitTest(seat: { x: number; y: number }, table: TableData) {
  return (
    seat.x >= table.x && seat.x < table.x + table.w &&
    seat.y >= table.y && seat.y < table.y + table.h
  );
}

// ── メイン ───────────────────────────────────────────────────
export default function SeatLayout() {
  const { t } = useTranslation();
  const [tables, setTables] = useState<TableData[]>([]);
  const [seats,  setSeats]  = useState<SeatData[]>([]);
  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [saved, setSaved] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);

  const originalSeatsRef   = useRef<ApiSeat[]>([]);
  const originalTablesRef  = useRef<ApiTable[]>([]);
  // 仮ID: 負数にすることでDBが発行する正数IDと衝突しない
  const nextSeatIdRef      = useRef(-1);
  const nextTableIdRef     = useRef(-1);

  // ── 初期ロード ─────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      api.get<ApiSeat[]>(EP.seats),
      api.get<ApiTable[]>(EP.seatTables),
    ]).then(([apiSeats, apiTables]) => {
      originalSeatsRef.current = apiSeats
      originalTablesRef.current = apiTables
      setSeats(apiSeats.map(s => ({ id: s.id, label: s.label, x: s.x, y: s.y, tableId: s.tableId })))
      setTables(apiTables.map(t => ({ id: t.id, label: t.label, x: t.x, y: t.y, w: t.w, h: t.h })))
    }).catch(() => {})
  }, [])

  // ── 保存（差分同期） ───────────────────────────────────────
  const handleSave = async () => {
    // 保存前に座標ベースで tableId を再計算
    const resolvedSeats = seats.map(s => ({
      ...s,
      tableId: tables.find(t => hitTest(s, t))?.id ?? null,
    }));
    setSeats(resolvedSeats);

    // テーブル差分
    const origTableIds = new Set(originalTablesRef.current.map(t => t.id))
    const currTableIds = new Set(tables.filter(t => t.id > 0).map(t => t.id))
    const tableDeletes = [...origTableIds].filter(id => !currTableIds.has(id))
    const tableCreates = tables.filter(t => t.id < 0)
    const tableUpdates = tables.filter(t => {
      if (t.id < 0) return false
      const orig = originalTablesRef.current.find(o => o.id === t.id)
      if (!orig) return false
      return orig.label !== t.label || orig.x !== t.x || orig.y !== t.y || orig.w !== t.w || orig.h !== t.h
    })

    // 席差分（resolvedSeats を使う）
    const origSeatIds = new Set(originalSeatsRef.current.map(s => s.id))
    const currSeatIds = new Set(resolvedSeats.filter(s => s.id > 0).map(s => s.id))
    const seatDeletes = [...origSeatIds].filter(id => !currSeatIds.has(id))
    const seatCreates = resolvedSeats.filter(s => s.id < 0)
    const seatUpdates = resolvedSeats.filter(s => {
      if (s.id < 0) return false
      const orig = originalSeatsRef.current.find(o => o.id === s.id)
      if (!orig) return false
      return orig.label !== s.label || orig.x !== s.x || orig.y !== s.y || orig.tableId !== s.tableId
    })

    try {
      await Promise.all(tableDeletes.map(id => api.delete(EP.seatTable(id))))
      // 新規テーブルを作成して仮ID→実IDのマップを作る
      const tableIdMap = new Map<number, number>()
      await Promise.all(tableCreates.map(async t => {
        const created = await api.post<ApiTable>(EP.seatTables, { label: t.label, x: t.x, y: t.y, w: t.w, h: t.h })
        tableIdMap.set(t.id, created.id)
      }))
      await Promise.all(tableUpdates.map(t =>
        api.put(EP.seatTable(t.id), { label: t.label, x: t.x, y: t.y, w: t.w, h: t.h })
      ))

      await Promise.all(seatDeletes.map(id => api.delete(EP.seat(id))))
      await Promise.all(seatCreates.map(s => {
        const tid = s.tableId !== null ? (tableIdMap.get(s.tableId) ?? s.tableId) : null
        return api.post(EP.seats, { label: s.label, type: tid !== null ? 'table' : 'counter', x: s.x, y: s.y, tableId: tid })
      }))
      await Promise.all(seatUpdates.map(s => {
        const tid = s.tableId !== null ? (tableIdMap.get(s.tableId) ?? s.tableId) : null
        return api.put(EP.seat(s.id), { label: s.label, type: tid !== null ? 'table' : 'counter', x: s.x, y: s.y, tableId: tid })
      }))

      // リロードして ref を更新
      const [freshSeats, freshTables] = await Promise.all([
        api.get<ApiSeat[]>(EP.seats),
        api.get<ApiTable[]>(EP.seatTables),
      ])
      originalSeatsRef.current = freshSeats
      originalTablesRef.current = freshTables
      setSeats(freshSeats.map(s => ({ id: s.id, label: s.label, x: s.x, y: s.y, tableId: s.tableId })))
      setTables(freshTables.map(t => ({ id: t.id, label: t.label, x: t.x, y: t.y, w: t.w, h: t.h })))
      nextSeatIdRef.current = -1
      nextTableIdRef.current = -1
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {}
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
      const nx = snap(Math.max(0, e2.clientX - r.left - d.ox));
      const ny = snap(Math.max(0, e2.clientY - r.top  - d.oy));

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
  }, [seats, tables]);

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
      const newW = Math.max(G, snap(d.initW! + e2.clientX - d.ox));
      const newH = Math.max(G, snap(d.initH! + e2.clientY - d.oy));
      setTables(prev => prev.map(t => t.id === d.id ? { ...t, w: newW, h: newH } : t));
    };
    const onUp = () => {
      drag.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [tables]);

  // ── パレットからドロップ ─────────────────────────────────
  const addItemAt = useCallback((type: string, clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return;
    const x = snap(Math.max(0, clientX - rect.left - G / 2));
    const y = snap(Math.max(0, clientY - rect.top  - G / 2));
    if (type === "table") {
      const tableId = nextTableIdRef.current--;
      const newTable: TableData = { id: tableId, label: t('seatEditor.defaultTableLabel', { n: tables.length + 1 }), x, y, w: G*3, h: G*2 };
      setTables(prev => [...prev, newTable]);
      setSelected({ kind: "table", id: tableId });
    } else {
      const cnt = seats.filter(s => s.label.startsWith("S")).length;
      const newSeat: SeatData = { id: nextSeatIdRef.current--, label: `S${cnt + 1}`, x, y, tableId: null };
      setSeats(prev => [...prev, newSeat]);
      setSelected({ kind: "seat", id: newSeat.id });
    }
  }, [seats, tables]);

  const handlePalettePointerDown = (e: React.PointerEvent, type: string, icon: string) => {
    e.preventDefault();
    const ghost = document.createElement("div");
    Object.assign(ghost.style, {
      position: "fixed", pointerEvents: "none", zIndex: "9999",
      width: "44px", height: "44px", borderRadius: "10px",
      background: "white", border: "1.5px solid #c8c8c8",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "18px", opacity: "0.85",
      transform: "translate(-50%, -50%)",
      left: e.clientX + "px", top: e.clientY + "px",
    });
    ghost.textContent = icon;
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

  const paletteItems = [
    { type: "table", icon: "▭", label: t('seatEditor.table'), sub: t('seatEditor.tableSub') },
    { type: "seat",  icon: "○", label: t('seatEditor.seat'),  sub: t('seatEditor.seatSub') },
  ];

  return (
    <>
      <div className="h-dvh bg-surface flex flex-col">


        <AppHeader
          title={t('admin.seats')}
          breadcrumb={{ label: t('admin.menuTitle'), to: ROUTES.admin }}
        />
        <SubHeader
          right={
            <button
              onClick={handleSave}
              className={`border-none rounded-lg px-4 py-1.5 text-note font-medium cursor-pointer transition-all ${saved ? 'bg-success-bg text-success-fg' : 'bg-ink text-white'}`}
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
          />

          {/* キャンバスエリア */}
          <div className="flex-1 overflow-auto pb-52">
            <div
              ref={canvasRef}
              onClick={() => setSelected(null)}
              className="relative m-5 rounded-lg border border-line bg-white"
              style={{
                width: G * 16, height: G * 12,
                backgroundImage: `
                  linear-gradient(to right, var(--color-surface-deep) 1px, transparent 1px),
                  linear-gradient(to bottom, var(--color-surface-deep) 1px, transparent 1px)
                `,
                backgroundSize: `${G}px ${G}px`,
              }}
            >
              {tables.map(table => (
                <TableRect
                  key={table.id}
                  table={table}
                  isSelected={selected?.kind === "table" && selected.id === table.id}
                  onPointerDown={handlePointerDown}
                  onClick={(kind, id) => setSelected({ kind, id })}
                  onResizeStart={handleResizeStart}
                />
              ))}
              {seats.map(seat => (
                <SeatCell
                  key={seat.id}
                  seat={seat}
                  isSelected={selected?.kind === "seat" && selected.id === seat.id}
                  onPointerDown={handlePointerDown}
                  onClick={(kind, id) => setSelected({ kind, id })}
                />
              ))}
            </div>
          </div>
        </div>

      {/* 編集モーダル */}
      {selectedItem && selected && (
        <EditModal
          item={selectedItem}
          selected={selected}
          onLabelChange={handleLabelChange}
          onDelete={handleDelete}
          onClose={() => setSelected(null)}
        />
      )}

        {/* フッター */}
        <FooterBar
          tableCount={tables.length}
          tableSeatCount={tableSeats.length}
          counterSeatCount={counterSeats.length}
          totalSeatCount={seats.length}
        />
      </div>
    </>
  );
}
