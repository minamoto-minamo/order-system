import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AppHeader, Button, InputModal } from "@/components";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/routes";
import { EP } from "@/lib/endpoints";
import type { Category, SubCategory, MenuItem } from "@order-system/shared";
import { ProductModal } from "./ProductModal";
import { toMeta } from "./types";
import type { Cat, Sub, Product, ProductFormData } from "./types";

type ModalState = null
  | { type: "addCat" }
  | { type: "editCat"; payload: Cat }
  | { type: "addSub"; payload: { catId: number } }
  | { type: "editSub"; payload: { cat: Cat; sub: Sub } }
  | { type: "addProduct" }
  | { type: "editProduct"; payload: Product };

// ── メイン ───────────────────────────────────────────────────
export default function Products() {
  const { t } = useTranslation();
  const [cats, setCats]         = useState<Cat[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedSubId, setSelectedSubId] = useState<number | null>(null);
  const [expandedCats, setExpandedCats]   = useState<Record<number, boolean>>({});
  const [modal, setModal] = useState<ModalState>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── 初期ロード ─────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      api.get<Category[]>(EP.categories),
      api.get<SubCategory[]>(EP.subcategories),
      api.get<MenuItem[]>(EP.menus),
    ]).then(([apiCats, apiSubs, apiMenus]) => {
      const catList: Cat[] = apiCats.map(c => ({
        id: c.id,
        label: c.name,
        subs: apiSubs.filter(s => s.categoryId === c.id).map(s => ({ id: s.id, label: s.name })),
      }))
      setCats(catList)
      setExpandedCats(Object.fromEntries(catList.map(c => [c.id, true])))
      setProducts(apiMenus.map(m => ({
        id: m.id,
        name: m.name,
        price: m.price,
        catId: m.categoryId,
        subId: m.subCategoryId,
        soldOut: m.soldOut,
        takeout: m.takeout,
      })))
    }).catch(() => {})
  }, [])

  // ── カテゴリ操作 ───────────────────────────────────────────
  const addCat = async (label: string) => {
    try {
      const cat = await api.post<Category>(EP.categories, { name: label })
      setCats(prev => [...prev, { id: cat.id, label: cat.name, subs: [] }])
      setExpandedCats(prev => ({ ...prev, [cat.id]: true }))
      setModal(null)
    } catch {}
  };

  const editCat = async (catId: number, label: string) => {
    try {
      await api.put(EP.category(catId), { name: label })
      setCats(prev => prev.map(c => c.id === catId ? { ...c, label } : c))
      setModal(null)
    } catch {}
  };

  const deleteCat = async (catId: number) => {
    try {
      await api.delete(EP.category(catId))
      setCats(prev => prev.filter(c => c.id !== catId))
      setProducts(prev => prev.filter(p => p.catId !== catId))
      if (selectedSubId && cats.find(c => c.id === catId)?.subs.some(s => s.id === selectedSubId)) {
        setSelectedSubId(null)
      }
    } catch {}
  };

  const addSub = async (catId: number, label: string) => {
    try {
      const sub = await api.post<SubCategory>(EP.subcategories, { name: label, categoryId: catId })
      setCats(prev => prev.map(c => c.id === catId ? { ...c, subs: [...c.subs, { id: sub.id, label: sub.name }] } : c))
      setModal(null)
    } catch {}
  };

  const editSub = async (catId: number, subId: number, label: string) => {
    try {
      await api.put(EP.subcategory(subId), { name: label })
      setCats(prev => prev.map(c => c.id === catId
        ? { ...c, subs: c.subs.map(s => s.id === subId ? { ...s, label } : s) }
        : c
      ))
      setModal(null)
    } catch {}
  };

  const deleteSub = async (catId: number, subId: number) => {
    try {
      await api.delete(EP.subcategory(subId))
      setCats(prev => prev.map(c => c.id === catId
        ? { ...c, subs: c.subs.filter(s => s.id !== subId) }
        : c
      ))
      setProducts(prev => prev.filter(p => p.subId !== subId))
      if (selectedSubId === subId) setSelectedSubId(null)
    } catch {}
  };

  // ── 商品操作 ───────────────────────────────────────────────
  const addProduct = async ({ name, price, subId, takeout }: ProductFormData) => {
    const cat = cats.find(c => c.subs.some(s => s.id === subId))
    if (!cat) return
    try {
      const item = await api.post<MenuItem>(EP.menus, {
        name, price, categoryId: cat.id, subCategoryId: subId, soldOut: false, takeout,
      })
      setProducts(prev => [...prev, {
        id: item.id, name: item.name, price: item.price,
        catId: item.categoryId, subId: item.subCategoryId,
        soldOut: item.soldOut, takeout: item.takeout,
      }])
      setModal(null)
    } catch {}
  };

  const editProduct = async (id: number, { name, price, subId, takeout }: ProductFormData) => {
    const cat = cats.find(c => c.subs.some(s => s.id === subId))
    if (!cat) return
    try {
      await api.put(EP.menu(id), { name, price, categoryId: cat.id, subCategoryId: subId, takeout })
      setProducts(prev => prev.map(p => p.id === id ? { ...p, name, price, catId: cat.id, subId, takeout } : p))
      setModal(null)
    } catch {}
  };

  const deleteProduct = async (id: number) => {
    try {
      await api.delete(EP.menu(id))
      setProducts(prev => prev.filter(p => p.id !== id))
    } catch {}
  };

  const toggleSoldOut = async (id: number) => {
    const product = products.find(p => p.id === id)
    if (!product) return
    const newSoldOut = !product.soldOut
    try {
      await api.put(EP.menu(id), { soldOut: newSoldOut })
      setProducts(prev => prev.map(p => p.id === id ? { ...p, soldOut: newSoldOut } : p))
    } catch {}
  };

  // ── 表示フィルタ ───────────────────────────────────────────
  const visibleProducts = selectedSubId
    ? products.filter(p => p.subId === selectedSubId)
    : products;

  const selectedLabel = selectedSubId
    ? (() => {
        for (const c of cats) {
          const s = c.subs.find(s => s.id === selectedSubId);
          if (s) return `${c.label} › ${s.label}`;
        }
        return "";
      })()
    : t('productSettings.allProducts');

  return (
    <>
      <div className="h-dvh bg-surface flex flex-col">
        <AppHeader title={t('admin.products')} breadcrumb={{ label: t('admin.menuTitle'), to: ROUTES.admin }} />

        {/* ボディ：2カラム */}
        <div className="flex-1 flex overflow-hidden">

          {/* 左：カテゴリツリー */}
          <div className={`${sidebarOpen ? 'w-40' : 'w-0'} bg-white border-r border-divider flex flex-col shrink-0 overflow-hidden transition-[width] duration-200`}>
            {/* すべて */}
            <div className={`tappable px-4 py-2.75 text-note border-b border-surface-deep ${selectedSubId === null ? 'text-ink font-medium bg-surface' : 'text-dim bg-transparent'}`}
              onClick={() => { setSelectedSubId(null); setSidebarOpen(false); }}>
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
                    onClick={() => setExpandedCats(prev => ({ ...prev, [cat.id]: !prev[cat.id] }))}
                  >
                    <span className="text-caption text-dim">
                      {expandedCats[cat.id] ? "▾" : "▸"}
                    </span>
                    <span className="text-note font-semibold text-ink">{cat.label}</span>
                  </div>
                  {/* 大分類操作 */}
                  <button
                    className="action-btn w-6 h-6 flex items-center justify-center rounded text-muted text-note"
                    onClick={() => setModal({ type: "editCat", payload: cat })}
                  >
                    ⚙
                  </button>
                </div>

                {/* 小分類 */}
                {expandedCats[cat.id] && (
                  <>
                    {cat.subs.map(sub => (
                      <div key={sub.id}
                        className={`tappable flex items-center pl-7 pr-2.5 py-2 border-b border-surface ${selectedSubId === sub.id ? 'bg-info-bg' : 'bg-white'}`}
                      >
                        <div onClick={() => { setSelectedSubId(sub.id); setSidebarOpen(false); }}
                          className={`flex-1 text-xs ${selectedSubId === sub.id ? 'text-info-dark' : 'text-dim'}`}>
                          {sub.label}
                          <span className="text-caption text-dim ml-1.25">
                            {products.filter(p => p.subId === sub.id).length}
                          </span>
                        </div>
                        <button
                          className="action-btn w-6 h-6 flex items-center justify-center rounded text-dim text-caption"
                          onClick={() => setModal({ type: "editSub", payload: { cat, sub } })}
                        >
                          ⚙
                        </button>
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

          {/* 右：商品一覧 */}
          <div className="flex-1 flex flex-col overflow-hidden" onClick={() => { if (sidebarOpen) setSidebarOpen(false); }}>
            {/* 商品エリアヘッダー */}
            <div className="px-3 py-3 border-b border-divider flex items-center gap-2 bg-white shrink-0">
              <button
                className="action-btn w-7 h-7 flex items-center justify-center rounded text-dim text-note shrink-0"
                onClick={() => setSidebarOpen(prev => !prev)}
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
        </div>
      </div>

      {/* モーダル群 */}
      {modal?.type === "addCat" && (
        <InputModal title={t('productSettings.addCategoryTitle')} placeholder="例：ドリンク" onConfirm={addCat} onClose={() => setModal(null)} />
      )}
      {modal?.type === "editCat" && (
        <InputModal title={t('productSettings.editCategoryTitle')} placeholder="" initialValue={modal.payload.label}
          onConfirm={(v) => editCat(modal.payload.id, v)} onClose={() => setModal(null)}
          onDelete={() => { deleteCat(modal.payload.id); setModal(null); }} />
      )}
      {modal?.type === "addSub" && (
        <InputModal title={t('productSettings.addSubCategoryTitle')}
          sub={cats.find(c => c.id === modal.payload.catId)?.label}
          placeholder="例：アルコール"
          onConfirm={(v) => addSub(modal.payload.catId, v)} onClose={() => setModal(null)} />
      )}
      {modal?.type === "editSub" && (
        <InputModal title={t('productSettings.editSubCategoryTitle')} placeholder="" initialValue={modal.payload.sub.label}
          onConfirm={(v) => editSub(modal.payload.cat.id, modal.payload.sub.id, v)} onClose={() => setModal(null)}
          onDelete={() => { deleteSub(modal.payload.cat.id, modal.payload.sub.id); setModal(null); }} />
      )}
      {modal?.type === "addProduct" && (
        <ProductModal cats={cats} initialSubId={selectedSubId} onConfirm={addProduct} onClose={() => setModal(null)} />
      )}
      {modal?.type === "editProduct" && (
        <ProductModal cats={cats} product={modal.payload}
          onConfirm={(v) => editProduct(modal.payload.id, v)} onClose={() => setModal(null)}
          onToggleSoldOut={() => { toggleSoldOut(modal.payload.id); setModal(null); }}
          onDelete={() => { deleteProduct(modal.payload.id); setModal(null); }} />
      )}
    </>
  );
}
