import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AppHeader, InputModal } from "@/components";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/routes";
import { EP } from "@/lib/endpoints";
import { useToast } from "@/hooks/useToast";
import type { Category, SubCategory, MenuItem } from "@order-system/shared";
import { ProductModal } from "./ProductModal";
import { CategorySidebar } from "./CategorySidebar";
import { ProductList } from "./ProductList";
import type { Cat, Product, ProductFormData, ModalState } from "./types";

// ── メイン ───────────────────────────────────────────────────
export default function Products() {
  const { t } = useTranslation();
  const { showToast } = useToast();
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
    } catch { showToast(t('common.saveFailed')) }
  };

  const editCat = async (catId: number, label: string) => {
    try {
      await api.put(EP.category(catId), { name: label })
      setCats(prev => prev.map(c => c.id === catId ? { ...c, label } : c))
      setModal(null)
    } catch { showToast(t('common.saveFailed')) }
  };

  const deleteCat = async (catId: number) => {
    try {
      await api.delete(EP.category(catId))
      setCats(prev => prev.filter(c => c.id !== catId))
      setProducts(prev => prev.filter(p => p.catId !== catId))
      if (selectedSubId && cats.find(c => c.id === catId)?.subs.some(s => s.id === selectedSubId)) {
        setSelectedSubId(null)
      }
    } catch { showToast(t('common.deleteFailed')) }
  };

  const addSub = async (catId: number, label: string) => {
    try {
      const sub = await api.post<SubCategory>(EP.subcategories, { name: label, categoryId: catId })
      setCats(prev => prev.map(c => c.id === catId ? { ...c, subs: [...c.subs, { id: sub.id, label: sub.name }] } : c))
      setModal(null)
    } catch { showToast(t('common.saveFailed')) }
  };

  const editSub = async (catId: number, subId: number, label: string) => {
    try {
      await api.put(EP.subcategory(subId), { name: label })
      setCats(prev => prev.map(c => c.id === catId
        ? { ...c, subs: c.subs.map(s => s.id === subId ? { ...s, label } : s) }
        : c
      ))
      setModal(null)
    } catch { showToast(t('common.saveFailed')) }
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
    } catch { showToast(t('common.deleteFailed')) }
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
    } catch { showToast(t('common.saveFailed')) }
  };

  const editProduct = async (id: number, { name, price, subId, takeout }: ProductFormData) => {
    const cat = cats.find(c => c.subs.some(s => s.id === subId))
    if (!cat) return
    try {
      await api.put(EP.menu(id), { name, price, categoryId: cat.id, subCategoryId: subId, takeout })
      setProducts(prev => prev.map(p => p.id === id ? { ...p, name, price, catId: cat.id, subId, takeout } : p))
      setModal(null)
    } catch { showToast(t('common.saveFailed')) }
  };

  const deleteProduct = async (id: number) => {
    try {
      await api.delete(EP.menu(id))
      setProducts(prev => prev.filter(p => p.id !== id))
    } catch { showToast(t('common.deleteFailed')) }
  };

  const toggleSoldOut = async (id: number) => {
    const product = products.find(p => p.id === id)
    if (!product) return
    const newSoldOut = !product.soldOut
    try {
      await api.put(EP.menu(id), { soldOut: newSoldOut })
      setProducts(prev => prev.map(p => p.id === id ? { ...p, soldOut: newSoldOut } : p))
    } catch { showToast(t('common.saveFailed')) }
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
          <CategorySidebar
            cats={cats}
            products={products}
            selectedSubId={selectedSubId}
            expandedCats={expandedCats}
            sidebarOpen={sidebarOpen}
            onSelectAll={() => { setSelectedSubId(null); setSidebarOpen(false); }}
            onSelectSub={(subId) => { setSelectedSubId(subId); setSidebarOpen(false); }}
            onToggleCat={(catId) => setExpandedCats(prev => ({ ...prev, [catId]: !prev[catId] }))}
            setModal={setModal}
          />

          {/* 右：商品一覧 */}
          <ProductList
            cats={cats}
            visibleProducts={visibleProducts}
            selectedLabel={selectedLabel}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(prev => !prev)}
            onCollapseSidebar={() => { if (sidebarOpen) setSidebarOpen(false); }}
            setModal={setModal}
          />
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
          placeholder={t('productSettings.categoryNamePlaceholder')}
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
