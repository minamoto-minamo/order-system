import type { Category, MenuItem, SubCategory } from '@order-system/shared'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheetModal, InputModal } from '@/components/composite'
import { RetryableLoadError } from '@/components/feedback'
import { AppHeader } from '@/features/navigation/components'
import { api } from '@/lib/api'
import { apiErrorMessage } from '@/lib/apiError'
import { EP } from '@/lib/endpoints'
import { ROUTES } from '@/lib/routes'
import { useToastStore } from '@/stores/toast'
import { CategorySidebar } from './components/CategorySidebar'
import { ProductList } from './components/ProductList'
import { ProductModal } from './components/ProductModal'
import type { Cat, DeleteTarget, ModalState, Product, ProductFormData } from './components/types'

const toOptionGroupForms = (optionGroups: MenuItem['optionGroups']) =>
  optionGroups.map((group) => ({
    clientId: `group-${group.id}`,
    name: group.name,
    required: group.required,
    sort: group.sort,
    choices: group.choices.map((choice) => ({
      clientId: `choice-${choice.id}`,
      name: choice.name,
      extraPrice: choice.extraPrice,
      sort: choice.sort,
    })),
  }))

const toSetFrameForms = (setFrames: MenuItem['setFrames']) =>
  setFrames.map((frame) => ({
    clientId: `set-frame-${frame.id}`,
    name: frame.name,
    sort: frame.sort,
    choices: frame.choices.map((choice) => ({
      clientId: `set-frame-choice-${choice.id}`,
      menuItemId: choice.menuItemId,
      sort: choice.sort,
    })),
  }))

// ── メイン ───────────────────────────────────────────────────
export default function Products() {
  const { t } = useTranslation()
  const showToast = useToastStore((state) => state.showToast)
  const [cats, setCats] = useState<Cat[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedSubId, setSelectedSubId] = useState<number | null>(null)
  const [expandedCats, setExpandedCats] = useState<Record<number, boolean>>({})
  const [modal, setModal] = useState<ModalState>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loadError, setLoadError] = useState(false)

  // ── 初期ロード ─────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      api.get<Category[]>(EP.categories),
      api.get<SubCategory[]>(EP.subcategories),
      api.get<MenuItem[]>(EP.menus),
    ])
      .then(([apiCats, apiSubs, apiMenus]) => {
        setLoadError(false)
        const catList: Cat[] = apiCats.map((c) => ({
          id: c.id,
          label: c.name,
          subs: apiSubs
            .filter((s) => s.categoryId === c.id)
            .map((s) => ({ id: s.id, label: s.name })),
        }))
        setCats(catList)
        setExpandedCats(Object.fromEntries(catList.map((c) => [c.id, true])))
        setProducts(
          apiMenus.map((m) => ({
            id: m.id,
            name: m.name,
            price: m.price,
            catId: m.categoryId,
            subId: m.subCategoryId,
            soldOut: m.soldOut,
            takeout: m.takeout,
            sort: m.sort,
            optionGroups: toOptionGroupForms(m.optionGroups),
            isSet: m.isSet,
            setFrames: toSetFrameForms(m.setFrames),
          })),
        )
      })
      .catch(() => setLoadError(true))
  }, [])

  // ── カテゴリ操作 ───────────────────────────────────────────
  const addCat = async (label: string) => {
    try {
      const cat = await api.post<Category>(EP.categories, { name: label })
      setCats((prev) => [...prev, { id: cat.id, label: cat.name, subs: [] }])
      setExpandedCats((prev) => ({ ...prev, [cat.id]: true }))
      setModal(null)
    } catch (e) {
      showToast(apiErrorMessage(e, t('common.saveFailed')))
    }
  }

  const editCat = async (catId: number, label: string) => {
    try {
      await api.put(EP.category(catId), { name: label })
      setCats((prev) => prev.map((c) => (c.id === catId ? { ...c, label } : c)))
      setModal(null)
    } catch (e) {
      showToast(apiErrorMessage(e, t('common.saveFailed')))
    }
  }

  const deleteCat = async (catId: number) => {
    try {
      await api.delete(EP.category(catId))
      setCats((prev) => prev.filter((c) => c.id !== catId))
      setProducts((prev) => prev.filter((p) => p.catId !== catId))
      if (
        selectedSubId &&
        cats.find((c) => c.id === catId)?.subs.some((s) => s.id === selectedSubId)
      ) {
        setSelectedSubId(null)
      }
    } catch (e) {
      showToast(apiErrorMessage(e, t('common.deleteFailed')))
    }
  }

  const addSub = async (catId: number, label: string) => {
    try {
      const sub = await api.post<SubCategory>(EP.subcategories, { name: label, categoryId: catId })
      setCats((prev) =>
        prev.map((c) =>
          c.id === catId ? { ...c, subs: [...c.subs, { id: sub.id, label: sub.name }] } : c,
        ),
      )
      setModal(null)
    } catch (e) {
      showToast(apiErrorMessage(e, t('common.saveFailed')))
    }
  }

  const editSub = async (catId: number, subId: number, label: string) => {
    try {
      await api.put(EP.subcategory(subId), { name: label })
      setCats((prev) =>
        prev.map((c) =>
          c.id === catId
            ? { ...c, subs: c.subs.map((s) => (s.id === subId ? { ...s, label } : s)) }
            : c,
        ),
      )
      setModal(null)
    } catch (e) {
      showToast(apiErrorMessage(e, t('common.saveFailed')))
    }
  }

  const deleteSub = async (catId: number, subId: number) => {
    try {
      await api.delete(EP.subcategory(subId))
      setCats((prev) =>
        prev.map((c) =>
          c.id === catId ? { ...c, subs: c.subs.filter((s) => s.id !== subId) } : c,
        ),
      )
      setProducts((prev) => prev.filter((p) => p.subId !== subId))
      if (selectedSubId === subId) setSelectedSubId(null)
    } catch (e) {
      showToast(apiErrorMessage(e, t('common.deleteFailed')))
    }
  }

  // ── 商品操作 ───────────────────────────────────────────────
  const addProduct = async ({
    name,
    price,
    subId,
    takeout,
    optionGroups,
    isSet,
    setFrames,
  }: ProductFormData) => {
    const cat = cats.find((c) => c.subs.some((s) => s.id === subId))
    if (!cat) return
    try {
      const item = await api.post<MenuItem>(EP.menus, {
        name,
        price,
        categoryId: cat.id,
        subCategoryId: subId,
        soldOut: false,
        takeout,
        optionGroups,
        isSet,
        setFrames,
      })
      setProducts((prev) => [
        ...prev,
        {
          id: item.id,
          name: item.name,
          price: item.price,
          catId: item.categoryId,
          subId: item.subCategoryId,
          soldOut: item.soldOut,
          takeout: item.takeout,
          sort: item.sort,
          optionGroups: toOptionGroupForms(item.optionGroups),
          isSet: item.isSet,
          setFrames: toSetFrameForms(item.setFrames),
        },
      ])
      setModal(null)
    } catch (e) {
      showToast(apiErrorMessage(e, t('common.saveFailed')))
    }
  }

  const editProduct = async (
    id: number,
    { name, price, subId, takeout, optionGroups, isSet, setFrames }: ProductFormData,
  ) => {
    const cat = cats.find((c) => c.subs.some((s) => s.id === subId))
    if (!cat) return
    try {
      await api.put(EP.menu(id), {
        name,
        price,
        categoryId: cat.id,
        subCategoryId: subId,
        takeout,
        optionGroups,
        isSet,
        setFrames,
      })
      setProducts((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                name,
                price,
                catId: cat.id,
                subId,
                takeout,
                optionGroups: optionGroups.map((group, groupIndex) => ({
                  ...group,
                  clientId: `group-new-${groupIndex}`,
                  choices: group.choices.map((choice, choiceIndex) => ({
                    ...choice,
                    clientId: `choice-new-${groupIndex}-${choiceIndex}`,
                  })),
                })),
                isSet,
                setFrames: setFrames.map((frame, frameIndex) => ({
                  ...frame,
                  clientId: `set-frame-new-${frameIndex}`,
                  choices: frame.choices.map((choice, choiceIndex) => ({
                    ...choice,
                    clientId: `set-frame-choice-new-${frameIndex}-${choiceIndex}`,
                  })),
                })),
              }
            : p,
        ),
      )
      setModal(null)
    } catch (e) {
      showToast(apiErrorMessage(e, t('common.saveFailed')))
    }
  }

  const deleteProduct = async (id: number) => {
    try {
      await api.delete(EP.menu(id))
      setProducts((prev) => prev.filter((p) => p.id !== id))
    } catch (e) {
      showToast(apiErrorMessage(e, t('common.deleteFailed')))
    }
  }

  const reorderProducts = async (ids: number[]) => {
    setProducts((prev) =>
      prev.map((p) => {
        const idx = ids.indexOf(p.id)
        return idx !== -1 ? { ...p, sort: idx } : p
      }),
    )
    try {
      await api.patch(EP.menuSort, { ids })
    } catch (e) {
      showToast(apiErrorMessage(e, t('common.saveFailed')))
    }
  }

  const toggleSoldOut = async (id: number) => {
    const product = products.find((p) => p.id === id)
    if (!product) return
    const newSoldOut = !product.soldOut
    try {
      await api.put(EP.menu(id), { soldOut: newSoldOut })
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, soldOut: newSoldOut } : p)))
    } catch (e) {
      showToast(apiErrorMessage(e, t('common.saveFailed')))
    }
  }

  // ── 表示フィルタ ───────────────────────────────────────────
  const visibleProducts = selectedSubId
    ? [...products.filter((p) => p.subId === selectedSubId)].sort(
        (a, b) => a.sort - b.sort || a.id - b.id,
      )
    : products

  const selectedLabel = selectedSubId
    ? (() => {
        for (const c of cats) {
          const s = c.subs.find((s) => s.id === selectedSubId)
          if (s) return `${c.label} › ${s.label}`
        }
        return ''
      })()
    : t('productSettings.allProducts')

  if (loadError) return <RetryableLoadError />

  return (
    <>
      <AppHeader
        title={t('admin.products')}
        breadcrumb={{ label: t('admin.menuTitle'), to: ROUTES.admin }}
      />

      {/* ボディ：2カラム */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左：カテゴリツリー */}
        <CategorySidebar
          cats={cats}
          products={products}
          selectedSubId={selectedSubId}
          expandedCats={expandedCats}
          sidebarOpen={sidebarOpen}
          onSelectAll={() => {
            setSelectedSubId(null)
            setSidebarOpen(false)
          }}
          onSelectSub={(subId) => {
            setSelectedSubId(subId)
            setSidebarOpen(false)
          }}
          onToggleCat={(catId) => setExpandedCats((prev) => ({ ...prev, [catId]: !prev[catId] }))}
          setModal={setModal}
        />

        {/* 右：商品一覧 */}
        <ProductList
          cats={cats}
          visibleProducts={visibleProducts}
          selectedLabel={selectedLabel}
          selectedSubId={selectedSubId}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          onCollapseSidebar={() => {
            if (sidebarOpen) setSidebarOpen(false)
          }}
          onReorder={reorderProducts}
          setModal={setModal}
        />
      </div>

      {/* モーダル群 */}
      {modal?.type === 'addCat' && (
        <InputModal
          title={t('productSettings.addCategoryTitle')}
          placeholder={t('productSettings.categoryPlaceholder')}
          onConfirm={addCat}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'editCat' && (
        <InputModal
          title={t('productSettings.editCategoryTitle')}
          placeholder=""
          initialValue={modal.payload.label}
          onConfirm={(v) => editCat(modal.payload.id, v)}
          onClose={() => setModal(null)}
          onDelete={() => {
            setModal(null)
            setDeleteTarget({ type: 'cat', id: modal.payload.id, label: modal.payload.label })
          }}
        />
      )}
      {modal?.type === 'addSub' && (
        <InputModal
          title={t('productSettings.addSubCategoryTitle')}
          sub={cats.find((c) => c.id === modal.payload.catId)?.label}
          placeholder={t('productSettings.categoryNamePlaceholder')}
          onConfirm={(v) => addSub(modal.payload.catId, v)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'editSub' && (
        <InputModal
          title={t('productSettings.editSubCategoryTitle')}
          placeholder=""
          initialValue={modal.payload.sub.label}
          onConfirm={(v) => editSub(modal.payload.cat.id, modal.payload.sub.id, v)}
          onClose={() => setModal(null)}
          onDelete={() => {
            setModal(null)
            setDeleteTarget({
              type: 'sub',
              catId: modal.payload.cat.id,
              id: modal.payload.sub.id,
              label: modal.payload.sub.label,
            })
          }}
        />
      )}
      {modal?.type === 'addProduct' && (
        <ProductModal
          cats={cats}
          products={products}
          initialSubId={selectedSubId}
          onConfirm={addProduct}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'editProduct' && (
        <ProductModal
          cats={cats}
          products={products}
          product={modal.payload}
          onConfirm={(v) => editProduct(modal.payload.id, v)}
          onClose={() => setModal(null)}
          onToggleSoldOut={() => {
            toggleSoldOut(modal.payload.id)
            setModal(null)
          }}
          onDelete={() => {
            setModal(null)
            setDeleteTarget({ type: 'product', id: modal.payload.id, label: modal.payload.name })
          }}
        />
      )}

      {/* 削除確認 */}
      <BottomSheetModal
        show={!!deleteTarget}
        title={
          deleteTarget
            ? deleteTarget.type === 'product'
              ? t('productSettings.deleteProductConfirm', { name: deleteTarget.label })
              : deleteTarget.type === 'sub'
                ? t('productSettings.deleteSubCategoryConfirm', { name: deleteTarget.label })
                : t('productSettings.deleteCategoryConfirm', { name: deleteTarget.label })
            : ''
        }
        onClose={() => setDeleteTarget(null)}
        secondaryAction={{ label: t('common.cancel'), onClick: () => setDeleteTarget(null) }}
        primaryAction={{
          label: t('common.delete'),
          onClick: () => {
            if (!deleteTarget) return
            if (deleteTarget.type === 'cat') deleteCat(deleteTarget.id)
            else if (deleteTarget.type === 'sub') deleteSub(deleteTarget.catId, deleteTarget.id)
            else deleteProduct(deleteTarget.id)
            setDeleteTarget(null)
          },
        }}
      />
    </>
  )
}
