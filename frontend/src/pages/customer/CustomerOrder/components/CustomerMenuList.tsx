import { MenuQtyStepper, SubCategorySidebar } from "@/components";
import type { MenuItem, Category, SubCategory } from "@order-system/shared";

// メニュータブのカテゴリタブ・サブカテゴリサイドバー・商品リスト。
export function CustomerMenuList({ categories, activeCatId, onSelectCategory, subs, activeSubId, onSelectSub, items, getQty, onQtyChange, footerVisible }: {
  categories: Category[];
  activeCatId: number | null;
  onSelectCategory: (id: number) => void;
  subs: SubCategory[];
  activeSubId: number | null;
  onSelectSub: (id: number | null) => void;
  items: MenuItem[];
  getQty: (id: number) => number;
  onQtyChange: (id: number, val: number) => void;
  footerVisible: boolean;
}) {
  return (
    <>
      <div className="flex border-b border-divider bg-white shrink-0 overflow-x-auto">
        {categories.map(c => (
          <button
            key={c.id}
            className={`px-4 py-2.5 text-note border-none bg-none cursor-pointer whitespace-nowrap border-b-2 ${
              activeCatId === c.id ? 'text-brand font-medium border-brand' : 'text-muted border-transparent'
            }`}
            onClick={() => onSelectCategory(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <SubCategorySidebar subs={subs} activeSubId={activeSubId} onSelect={onSelectSub} />

        <div className="flex-1 overflow-y-auto" style={{ paddingBottom: footerVisible ? 80 : 16 }}>
          {items.map(item => {
            const qty = getQty(item.id);
            return (
              <div key={item.id} className="px-5 py-3 border-b border-surface flex items-center gap-3 bg-white">
                <div className="flex-1">
                  <div className="text-sm text-ink mb-0.5">{item.name}</div>
                  <div className="text-xs text-muted">¥{item.price.toLocaleString()}</div>
                </div>
                <MenuQtyStepper qty={qty} onChange={val => onQtyChange(item.id, val)} />
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
