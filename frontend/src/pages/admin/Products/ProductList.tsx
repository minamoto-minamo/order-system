import { useTranslation } from "react-i18next";
import { Button } from "@/components";
import { toMeta } from "./types";
import type { Cat, Product, ModalState } from "./types";

interface ProductListProps {
  cats: Cat[];
  visibleProducts: Product[];
  selectedLabel: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onCollapseSidebar: () => void;
  setModal: (modal: ModalState) => void;
}

export function ProductList({
  cats,
  visibleProducts,
  selectedLabel,
  sidebarOpen,
  onToggleSidebar,
  onCollapseSidebar,
  setModal,
}: ProductListProps) {
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex flex-col overflow-hidden" onClick={onCollapseSidebar}>
      {/* 商品エリアヘッダー */}
      <div className="px-3 py-3 border-b border-divider flex items-center gap-2 bg-white shrink-0">
        <button
          className="action-btn w-7 h-7 flex items-center justify-center rounded text-dim text-note shrink-0"
          onClick={onToggleSidebar}
        >
          {sidebarOpen ? '←' : '☰'}
        </button>
        <div className="text-note text-dim flex-1">
          {selectedLabel}
          <span className="text-label text-muted ml-1.5">
            {visibleProducts.length}件
          </span>
        </div>
        <Button variant="primary" className="rounded-[7px] px-3 py-1.5 text-xs whitespace-nowrap shrink-0"
          onClick={() => setModal({ type: "addProduct" })}>
          {t('productSettings.addProductBtn')}
        </Button>
      </div>

      {/* 商品リスト */}
      <div className="flex-1 overflow-y-auto">
        {visibleProducts.length === 0 && (
          <div className="py-10 text-center text-muted text-note">
            {t('productSettings.noProducts')}
          </div>
        )}
        {visibleProducts.map(p => {
          const cat = cats.find(c => c.id === p.catId);
          const sub = cat?.subs.find(s => s.id === p.subId);
          return (
            <div key={p.id}
              className={`tappable px-3 py-3 border-b border-surface flex items-center gap-2 bg-white ${p.soldOut ? 'opacity-50' : 'opacity-100'}`}
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
              <span className="w-7 h-7 flex items-center justify-center text-muted text-note shrink-0">⚙</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
