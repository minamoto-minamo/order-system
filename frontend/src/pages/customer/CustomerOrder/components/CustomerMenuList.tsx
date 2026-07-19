import type { Category, MenuItem, SubCategory } from '@order-system/shared'
import { useTranslation } from 'react-i18next'
import { Icon, ZeroStartStepper } from '@/components/primitives'
import { SubCategorySidebar } from '@/features/menu/components'
import { SYMBOL_ICONS } from '@/lib/icons'

// メニュータブのカテゴリタブ・サブカテゴリサイドバー・商品リスト。
export function CustomerMenuList({
  categories,
  activeCatId,
  onSelectCategory,
  subs,
  activeSubId,
  onSelectSub,
  items,
  drinkPlanMenuItemIds,
  getQty,
  onQtyChange,
  footerVisible,
}: {
  categories: Category[]
  activeCatId: number | null
  onSelectCategory: (id: number) => void
  subs: SubCategory[]
  activeSubId: number | null
  onSelectSub: (id: number | null) => void
  items: MenuItem[]
  drinkPlanMenuItemIds: number[]
  getQty: (id: number) => number
  onQtyChange: (id: number, val: number) => void
  footerVisible: boolean
}) {
  const { t } = useTranslation()

  return (
    <>
      <div className="flex border-b border-divider bg-white shrink-0 overflow-x-auto">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`px-4 py-2.5 text-note border-none bg-none cursor-pointer whitespace-nowrap border-b-2 ${
              activeCatId === c.id
                ? 'text-brand font-medium border-brand'
                : 'text-muted border-transparent'
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
          {items.map((item) => {
            const qty = getQty(item.id)
            const isDrinkPlanTarget = drinkPlanMenuItemIds.includes(item.id)
            return (
              <div
                key={item.id}
                className="px-5 py-3 border-b border-surface flex items-center gap-3 bg-white"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div className="text-sm text-ink">{item.name}</div>
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
                <ZeroStartStepper
                  qty={qty}
                  onChange={(val) => onQtyChange(item.id, val)}
                  disabled={item.soldOut}
                />
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
