import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { BaseButton, Icon } from "@/components/primitives";
import { ACTION_ICONS } from "@/lib/icons";
import { useTranslation } from "react-i18next";
import type { Cat, ModalState, Product } from "./types";
import { toMeta } from "./types";

interface ProductListProps {
  cats: Cat[];
  visibleProducts: Product[];
  selectedLabel: string;
  selectedSubId: number | null;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onCollapseSidebar: () => void;
  onReorder: (ids: number[]) => void;
  setModal: (modal: ModalState) => void;
}

interface RowProps {
  p: Product;
  cats: Cat[];
  isDragEnabled: boolean;
  setModal: (modal: ModalState) => void;
}

function SortableProductRow({ p, cats, isDragEnabled, setModal }: RowProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: p.id,
    disabled: !isDragEnabled,
  })
  const style = isDragEnabled
    ? { transform: CSS.Transform.toString(transform), transition }
    : undefined
  const cat = cats.find(c => c.id === p.catId);
  const sub = cat?.subs.find(s => s.id === p.subId);
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`px-3 py-3 border-b border-surface flex items-center gap-2 bg-white ${p.soldOut ? 'opacity-50' : ''} ${isDragging ? 'shadow-md z-10 relative' : ''}`}
    >
      {isDragEnabled && (
        <span
          className="w-5 h-7 flex items-center justify-center text-muted text-note shrink-0 touch-none cursor-grab"
          {...attributes}
          {...listeners}
          onClick={e => e.stopPropagation()}
        >⠿</span>
      )}
      <div
        className="flex-1 flex items-center gap-2 tappable"
        onClick={() => setModal({ type: "editProduct", payload: p })}
      >
        <div className="flex-1">
          <div className="text-sm text-ink mb-0.75">
            {p.name}
            {p.soldOut && (
              <span className="ml-2 text-caption text-danger bg-danger-bg border border-danger-border px-1.5 py-px rounded-full">{t('productSettings.soldOut')}</span>
            )}
          </div>
          <div className="flex gap-1.5 items-center flex-wrap">
            <span className="text-xs text-muted">¥{p.price.toLocaleString()}</span>
            {cat && sub && (
              <span className="text-caption text-dim">
                {cat.label} › {sub.label}
              </span>
            )}
            {(() => {
              const m = toMeta(p.takeout);
              return (
                <span className="text-caption px-1.5 py-px rounded-full border"
                  style={{ color: m.color, background: m.bg, borderColor: m.border }}>{t(m.labelKey)}</span>
              );
            })()}
          </div>
        </div>
        <span className="w-7 h-7 flex items-center justify-center text-muted text-note shrink-0">
          <Icon src={ACTION_ICONS.gear} />
        </span>
      </div>
    </div>
  );
}

export function ProductList({
  cats,
  visibleProducts,
  selectedLabel,
  selectedSubId,
  sidebarOpen,
  onToggleSidebar,
  onCollapseSidebar,
  onReorder,
  setModal,
}: ProductListProps) {
  const { t } = useTranslation();
  const isDragEnabled = selectedSubId !== null;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = visibleProducts.findIndex(p => p.id === active.id)
    const newIndex = visibleProducts.findIndex(p => p.id === over.id)
    const newOrder = arrayMove(visibleProducts, oldIndex, newIndex)
    onReorder(newOrder.map(p => p.id))
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" onClick={onCollapseSidebar}>
      {/* 商品エリアヘッダー */}
      <div className="px-3 py-3 border-b border-divider flex items-center gap-2 bg-white shrink-0">
        <BaseButton
          className="w-7 h-7 flex items-center justify-center rounded text-dim text-note shrink-0"
          onClick={onToggleSidebar}
        >
          <Icon src={sidebarOpen ? ACTION_ICONS.arrowLeft : ACTION_ICONS.menu} />
        </BaseButton>
        <div className="text-note text-dim flex-1">
          {selectedLabel}
          <span className="text-label text-muted ml-1.5">
            {visibleProducts.length}件
          </span>
        </div>
        <BaseButton variant="primary" className="rounded-[7px] px-3 py-1.5 text-xs whitespace-nowrap shrink-0"
          onClick={() => setModal({ type: "addProduct" })}>
          {t('productSettings.addProductBtn')}
        </BaseButton>
      </div>

      {/* 商品リスト */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-y-auto">
          {visibleProducts.length === 0 && (
            <div className="py-10 text-center text-muted text-note">
              {t('productSettings.noProducts')}
            </div>
          )}
          <SortableContext items={visibleProducts.map(p => p.id)} strategy={verticalListSortingStrategy}>
            {visibleProducts.map(p => (
              <SortableProductRow
                key={p.id}
                p={p}
                cats={cats}
                isDragEnabled={isDragEnabled}
                setModal={setModal}
              />
            ))}
          </SortableContext>
        </div>
      </DndContext>
    </div>
  );
}
