import type { Group, OrderItem } from '@order-system/shared'
import { useTranslation } from 'react-i18next'
import { OrderHistorySection } from '@/features/order/components'
import { partitionOrderItems } from '@/lib/partitionOrderItems'
import { calculateTaxTotals } from '@/lib/taxTotals'
import { HistoryCourseBlock } from './HistoryCourseBlock'
import { ActiveItemRow, type ItemGroup, ServedItemRow } from './HistoryRows'
import { HistoryTotalsFooter } from './HistoryTotalsFooter'

function groupItems(list: OrderItem[]): ItemGroup[] {
  return list.reduce<ItemGroup[]>((acc, item) => {
    const key = `${item.menuItemId}-${item.price}`
    const existing = acc.find((g) => g.key === key)
    if (existing) {
      existing.totalQty += item.qty
    } else {
      acc.push({ key, menuItemName: item.menuItemName, price: item.price, totalQty: item.qty })
    }
    return acc
  }, [])
}

export function CustomerOrderHistory({
  items,
  tax,
}: {
  items: OrderItem[]
  tax: Pick<Group, 'effectiveTaxRateInHouse' | 'effectiveTaxRateTakeout' | 'effectiveTaxInclusive'>
}) {
  const { t } = useTranslation()

  const { active, served, courseCharges, courseDishes } = partitionOrderItems(items)
  const activeGroups = groupItems(active)
  const servedGroups = groupItems(served)
  const { subtotal, tax: taxAmount } = calculateTaxTotals(items, tax)

  // キャンセル済みは表示しないため、キャンセル分しか無い場合も「注文なし」扱いにする
  if (items.every((i) => i.status === 'cancelled')) {
    return (
      <div className="flex items-center justify-center h-32 text-muted text-note">
        {t('customerOrder.noOrders')}
      </div>
    )
  }

  return (
    <>
      {/* 固定フッターの合計に隠れないよう、下端にフッター高さ分の余白を確保する */}
      <div className="flex-1 overflow-y-auto pb-32">
        <OrderHistorySection>
          {activeGroups.map((g) => (
            <ActiveItemRow key={g.key} group={g} />
          ))}
        </OrderHistorySection>

        {servedGroups.length > 0 && (
          <OrderHistorySection title={t('group.served')}>
            {servedGroups.map((g) => (
              <ServedItemRow key={g.key} group={g} />
            ))}
          </OrderHistorySection>
        )}

        {courseCharges.length > 0 && (
          <OrderHistorySection title={t('group.courseTab')}>
            {courseCharges.map((item) => (
              <HistoryCourseBlock
                key={item.id}
                charge={item}
                // 飲み放題の課金明細もコース由来の courseId を持つため、付属料理はコース課金明細にだけ表示する
                dishes={
                  item.isDrinkPlanCharge
                    ? []
                    : courseDishes.filter((d) => d.courseId === item.courseId)
                }
              />
            ))}
          </OrderHistorySection>
        )}
      </div>

      <HistoryTotalsFooter subtotal={subtotal} tax={taxAmount} />
    </>
  )
}
