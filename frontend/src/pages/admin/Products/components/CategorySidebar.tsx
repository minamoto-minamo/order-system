import { BaseButton, Icon } from "@/components/primitives";
import { ACTION_ICONS } from "@/lib/icons";
import { useTranslation } from "react-i18next";
import type { Cat, ModalState, Product } from "./types";

interface CategorySidebarProps {
  cats: Cat[];
  products: Product[];
  selectedSubId: number | null;
  expandedCats: Record<number, boolean>;
  sidebarOpen: boolean;
  onSelectAll: () => void;
  onSelectSub: (subId: number) => void;
  onToggleCat: (catId: number) => void;
  setModal: (modal: ModalState) => void;
}

export function CategorySidebar({
  cats,
  products,
  selectedSubId,
  expandedCats,
  sidebarOpen,
  onSelectAll,
  onSelectSub,
  onToggleCat,
  setModal,
}: CategorySidebarProps) {
  const { t } = useTranslation();

  return (
    <div className={`${sidebarOpen ? 'w-40' : 'w-0'} bg-white border-r border-divider flex flex-col shrink-0 overflow-hidden transition-[width] duration-200`}>
      {/* ルートの overflow-hidden は開閉アニメーション用のため、縦スクロールは内側で確保する */}
      <div className="flex-1 overflow-y-auto">
        {/* すべて */}
        <div className={`tappable px-4 py-2.75 text-note border-b border-surface-deep ${selectedSubId === null ? 'text-ink font-medium bg-surface' : 'text-dim bg-transparent'}`}
          onClick={onSelectAll}>
          {t('common.all')}
          <span className="text-label text-muted ml-1.5">
            {products.length}
          </span>
        </div>

        {/* 大分類ツリー */}
        {cats.map(cat => (
          <div key={cat.id}>
            {/* 大分類行 */}
            <div className="flex items-center pl-4 pr-3 py-2.25 border-b border-divider bg-surface">
              <div
                className="tappable flex-1 flex items-center gap-1.25"
                onClick={() => onToggleCat(cat.id)}
              >
                <span className="text-caption text-dim">
                  <Icon src={expandedCats[cat.id] ? ACTION_ICONS.chevronDown : ACTION_ICONS.chevronRight} />
                </span>
                <span className="text-note font-semibold text-ink">{cat.label}</span>
              </div>
              {/* 大分類操作 */}
              <BaseButton
                className="w-6 h-6 flex items-center justify-center rounded text-muted text-note"
                onClick={() => setModal({ type: "editCat", payload: cat })}
              >
                <Icon src={ACTION_ICONS.gear} />
              </BaseButton>
            </div>

            {/* 小分類 */}
            {expandedCats[cat.id] && (
              <>
                {cat.subs.map(sub => (
                  <div key={sub.id}
                    className={`tappable flex items-center pl-7 pr-2.5 py-2 border-b border-surface ${selectedSubId === sub.id ? 'bg-info-bg' : 'bg-white'}`}
                  >
                    <div onClick={() => onSelectSub(sub.id)}
                      className={`flex-1 text-xs ${selectedSubId === sub.id ? 'text-info-dark' : 'text-dim'}`}>
                      {sub.label}
                      <span className="text-caption text-dim ml-1.25">
                        {products.filter(p => p.subId === sub.id).length}
                      </span>
                    </div>
                    <BaseButton
                      className="w-6 h-6 flex items-center justify-center rounded text-dim text-caption"
                      onClick={() => setModal({ type: "editSub", payload: { cat, sub } })}
                    >
                      <Icon src={ACTION_ICONS.gear} />
                    </BaseButton>
                  </div>
                ))}

                {/* 小分類追加 */}
                <div className="tappable pl-7 pr-2.5 py-1.75 text-label text-muted border-b border-surface"
                  onClick={() => setModal({ type: "addSub", payload: { catId: cat.id } })}>
                  {t('productSettings.addSubCategory')}
                </div>
              </>
            )}
          </div>
        ))}

        {/* 大分類追加 */}
        <div className="tappable px-4 py-2.75 text-xs text-muted mt-1"
          onClick={() => setModal({ type: "addCat" })}>
          {t('productSettings.addCategory')}
        </div>
      </div>
    </div>
  );
}
