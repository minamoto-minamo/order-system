import { useTranslation } from "react-i18next";
import type { OrderItem } from "@order-system/shared";
import { OrderSection } from "@/pages/group/GroupDetail/components/OrderHistory";
import { partitionOrderItems } from "@/lib/partitionOrderItems";
import { ActiveItemRow, ServedItemRow, type ItemGroup } from "./HistoryRows";
import { HistoryCourseBlock } from "./HistoryCourseBlock";
import { HistoryTotalsFooter } from "./HistoryTotalsFooter";

function groupItems(list: OrderItem[]): ItemGroup[] {
  return list.reduce<ItemGroup[]>((acc, item) => {
    const key = `${item.menuItemId}-${item.price}`;
    const existing = acc.find(g => g.key === key);
    if (existing) { existing.totalQty += item.qty; }
    else { acc.push({ key, menuItemName: item.menuItemName, price: item.price, totalQty: item.qty }); }
    return acc;
  }, []);
}

export function CustomerOrderHistory({ items }: { items: OrderItem[] }) {
  const { t } = useTranslation();

  const { active, served, courseCharges, courseDishes } = partitionOrderItems(items);
  const activeGroups = groupItems(active);
  const servedGroups = groupItems(served);
  const subtotal = items.filter(i => i.status !== 'cancelled').reduce((sum, i) => sum + i.price * i.qty, 0);
  const tax      = items.filter(i => i.status !== 'cancelled').reduce((sum, i) => sum + Math.floor(i.price * i.qty * i.taxRate / 100), 0);

  // キャンセル済みは表示しないため、キャンセル分しか無い場合も「注文なし」扱いにする
  if (items.every(i => i.status === 'cancelled')) {
    return (
      <div className="flex items-center justify-center h-32 text-muted text-note">
        {t('customerOrder.noOrders')}
      </div>
    );
  }

  return (
    <>
      {/* 固定フッターの合計に隠れないよう、下端にフッター高さ分の余白を確保する */}
      <div className="flex-1 overflow-y-auto pb-32">
        <OrderSection>
          {activeGroups.map(g => <ActiveItemRow key={g.key} group={g} />)}
        </OrderSection>

        {servedGroups.length > 0 && (
          <OrderSection title={t('group.served')}>
            {servedGroups.map(g => <ServedItemRow key={g.key} group={g} />)}
          </OrderSection>
        )}

        {courseCharges.length > 0 && (
          <OrderSection title={t('group.courseTab')}>
            {courseCharges.map(item => (
              <HistoryCourseBlock
                key={item.id}
                charge={item}
                // 飲み放題の課金明細もコース由来の courseId を持つため、付属料理はコース課金明細にだけ表示する
                dishes={item.isDrinkPlanCharge ? [] : courseDishes.filter(d => d.courseId === item.courseId)}
              />
            ))}
          </OrderSection>
        )}
      </div>

      <HistoryTotalsFooter subtotal={subtotal} tax={tax} />
    </>
  );
}
