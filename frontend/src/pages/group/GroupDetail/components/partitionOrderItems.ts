import type { OrderItem } from "@order-system/shared";

// コース/飲み放題の定額課金明細（isCourseCharge:true）は調理・提供の対象外のため、
// 通常注文とは別枠で表示する。コース適用時に自動生成された付属料理
// （courseId あり・isCourseCharge:false）も個別注文としては扱わず、コース枠に名前のみ表示する
export function partitionOrderItems(items: OrderItem[]) {
  const isCourseDish = (i: OrderItem) => i.courseId != null && !i.isCourseCharge;
  const foodItems = items.filter(i => !i.isCourseCharge && !isCourseDish(i));
  return {
    active: foodItems.filter(i => i.status !== "cancelled" && i.status !== "served"),
    served: foodItems.filter(i => i.status === "served"),
    cancelled: [
      ...foodItems.filter(i => i.status === "cancelled"),
      ...items.filter(i => i.isCourseCharge && i.status === "cancelled"),
    ],
    courseCharges: items.filter(i => i.isCourseCharge && i.status !== "cancelled"),
    courseDishes: items.filter(i => isCourseDish(i) && i.status !== "cancelled"),
  };
}
