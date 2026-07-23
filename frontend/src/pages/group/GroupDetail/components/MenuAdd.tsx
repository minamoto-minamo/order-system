import type { Category, DrinkPlan, MenuItem, SubCategory } from '@order-system/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MenuConfirmModal, SlideUpFooter } from '@/components/composite'
import { BaseButton, Icon, ZeroStartStepper } from '@/components/primitives'
import { SubCategorySidebar } from '@/features/menu/components'
import {
  type OptionedOrderLine,
  OptionSelectSheet,
} from '@/features/order/components/OptionSelectSheet'
import { SYMBOL_ICONS } from '@/lib/icons'

export function MenuAdd({
  menus,
  categories,
  subCategories,
  activeDrinkPlan,
  onAdd,
}: {
  menus: MenuItem[]
  categories: Category[]
  subCategories: SubCategory[]
  activeDrinkPlan: DrinkPlan | null
  onAdd: (
    items: ({
      item: MenuItem
      qty: number
      selectedChoiceIds?: number[]
    } & Partial<OptionedOrderLine>)[],
    isTakeout: boolean,
  ) => Promise<void>
}) {
  const { t } = useTranslation()
  const [orderType, setOrderType] = useState<'dine_in' | 'takeout'>('dine_in')
  const [activeCatId, setActiveCatId] = useState<number | null>(null)
  const [activeSubId, setActiveSubId] = useState<number | null>(null)
  const [qtys, setQtys] = useState<Record<number, number>>({})
  const [optionedLines, setOptionedLines] = useState<OptionedOrderLine[]>([])
  const [optionTarget, setOptionTarget] = useState<MenuItem | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const visibleItems = menus.filter((item) =>
    orderType === 'dine_in'
      ? item.takeout === 'dine_in' || item.takeout === 'both'
      : item.takeout === 'takeout' || item.takeout === 'both',
  )

  const activeCats = categories.filter((c) => visibleItems.some((i) => i.categoryId === c.id))
  const safeCatId = activeCats.find((c) => c.id === activeCatId)?.id ?? activeCats[0]?.id ?? null

  const catSubs = subCategories
    .filter((s) => s.categoryId === safeCatId && visibleItems.some((i) => i.subCategoryId === s.id))
    .sort((a, b) => a.sort - b.sort)

  const safeSubId = catSubs.find((s) => s.id === activeSubId)?.id ?? null

  const filteredItems = visibleItems
    .filter((i) => i.categoryId === safeCatId)
    .filter((i) => safeSubId === null || i.subCategoryId === safeSubId)

  const getQty = (id: number) => qtys[id] ?? 0
  const setQty = (id: number, val: number) =>
    setQtys((prev) => ({ ...prev, [id]: Math.max(0, val) }))
  const totalCount =
    Object.values(qtys).reduce((s, v) => s + v, 0) +
    optionedLines.reduce((s, line) => s + line.qty, 0)

  const handleCatChange = (id: number) => {
    setActiveCatId(id)
    setActiveSubId(null)
  }

  const handleAdd = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await onAdd(orderItems, orderType === 'takeout')
      setQtys({})
      setOptionedLines([])
      setConfirmOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  const orderItems: ({
    item: MenuItem
    qty: number
    selectedChoiceIds?: number[]
  } & Partial<OptionedOrderLine>)[] = [
    ...Object.entries(qtys)
      .filter(([, qty]) => qty > 0)
      .flatMap(([id, qty]) => {
        const item = menus.find((menu) => menu.id === Number(id))
        return item ? [{ item, qty }] : []
      }),
    ...optionedLines,
  ]

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex border-b border-divider bg-white shrink-0 items-center">
        <div className="flex overflow-x-auto flex-1">
          {activeCats.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`px-4 py-2.5 text-note border-none bg-none cursor-pointer whitespace-nowrap border-b-2 ${
                safeCatId === c.id
                  ? `font-medium ${orderType === 'takeout' ? 'text-amber border-amber' : 'text-brand border-brand'}`
                  : 'text-muted border-transparent'
              }`}
              onClick={() => handleCatChange(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`shrink-0 mx-3 px-2.5 py-1 text-label rounded-full border whitespace-nowrap ${
            orderType === 'takeout'
              ? 'bg-amber-bg border-amber-border text-amber-fg font-medium'
              : 'bg-transparent border-line text-muted'
          }`}
          onClick={() => {
            setOrderType((prev) => (prev === 'takeout' ? 'dine_in' : 'takeout'))
            setQtys({})
            setOptionedLines([])
          }}
        >
          {t('group.takeout')}
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <SubCategorySidebar subs={catSubs} activeSubId={safeSubId} onSelect={setActiveSubId} />

        <div className="flex-1 overflow-y-auto" style={{ paddingBottom: totalCount > 0 ? 80 : 0 }}>
          {filteredItems.map((item) => {
            const qty = getQty(item.id)
            const isTOOnly = item.takeout === 'takeout'
            const isDrinkPlanTarget =
              orderType === 'dine_in' && activeDrinkPlan?.menuItemIds.includes(item.id)
            return (
              <div
                key={item.id}
                className="px-5 py-3 border-b border-surface flex items-center gap-3 bg-white"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm text-ink">{item.name}</span>
                    {isTOOnly && (
                      <span className="text-micro text-amber bg-amber-bg border border-amber-border px-1.25 py-px rounded-full">
                        {t('productSettings.toTakeout')}
                      </span>
                    )}
                    {item.soldOut && (
                      <span className="text-micro text-danger bg-danger-bg border border-danger-border px-1.25 py-px rounded-full">
                        {t('productSettings.soldOut')}
                      </span>
                    )}
                    {isDrinkPlanTarget && (
                      <span className="text-micro text-info bg-info-bg border border-info-border px-1.25 py-px rounded-full">
                        <Icon src={SYMBOL_ICONS.beer} className="mr-1 align-[-0.1em]" />
                        {t('group.drinkPlanTarget')}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted">
                    ¥{isDrinkPlanTarget ? '0' : item.price.toLocaleString()}
                  </div>
                </div>
                {item.optionGroups.length > 0 ? (
                  <BaseButton
                    variant="secondary"
                    className="shrink-0 py-2 px-3 text-xs"
                    disabled={item.soldOut}
                    onClick={() => setOptionTarget(item)}
                  >
                    {t('orderOption.selectButton')}
                  </BaseButton>
                ) : (
                  <ZeroStartStepper
                    qty={qty}
                    onChange={(val) => setQty(item.id, val)}
                    disabled={item.soldOut}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {totalCount > 0 && (
        <SlideUpFooter>
          <BaseButton
            className={`w-full border-none rounded-[10px] p-3.5 text-sm font-medium text-white ${orderType === 'takeout' ? 'bg-amber' : 'bg-brand'}`}
            onClick={() => setConfirmOpen(true)}
          >
            {t('group.reviewOrder')}
          </BaseButton>
        </SlideUpFooter>
      )}
      <MenuConfirmModal
        open={confirmOpen}
        items={orderItems}
        orderType={orderType}
        submitting={submitting}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleAdd}
      />
      <OptionSelectSheet
        key={optionTarget?.id ?? 'empty'}
        item={optionTarget}
        open={optionTarget != null}
        onClose={() => setOptionTarget(null)}
        onAdd={(line) => {
          setOptionedLines((prev) => [...prev, line])
          setOptionTarget(null)
        }}
      />
    </div>
  )
}
