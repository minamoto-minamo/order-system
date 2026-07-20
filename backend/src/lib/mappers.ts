import type { GroupStatus, OrderItemStatus } from '@order-system/shared'

type DecimalLike = { toNumber(): number }
type TaxSettingLike = {
  taxRateInHouse: DecimalLike
  taxRateTakeout: DecimalLike
  taxInclusive: boolean
}
type GroupTaxLike = {
  billedTaxRateInHouse: DecimalLike | null
  billedTaxRateTakeout: DecimalLike | null
  billedTaxInclusive: boolean | null
}

export function resolveGroupTax(g: GroupTaxLike, setting: TaxSettingLike) {
  return {
    effectiveTaxRateInHouse:
      g.billedTaxRateInHouse?.toNumber() ?? setting.taxRateInHouse.toNumber(),
    effectiveTaxRateTakeout:
      g.billedTaxRateTakeout?.toNumber() ?? setting.taxRateTakeout.toNumber(),
    effectiveTaxInclusive: g.billedTaxInclusive ?? setting.taxInclusive,
  }
}

export function toGroup(
  g: {
    id: string
    name: string
    guestCount: number
    status: string
    sessionId: number
    courseId: number | null
    drinkPlanId: number | null
    createdAt: Date
    billedTaxRateInHouse: DecimalLike | null
    billedTaxRateTakeout: DecimalLike | null
    billedTaxInclusive: boolean | null
    seats: { seatId: number }[]
  },
  setting: TaxSettingLike,
) {
  const effectiveTax = resolveGroupTax(g, setting)
  return {
    id: g.id,
    name: g.name,
    guestCount: g.guestCount,
    seatIds: g.seats.map((s) => s.seatId),
    // Prisma は string 型で返すが shared 型は union literal なのでキャストする
    status: g.status as GroupStatus,
    sessionId: g.sessionId,
    courseId: g.courseId,
    drinkPlanId: g.drinkPlanId,
    ...effectiveTax,
    createdAt: g.createdAt.toISOString(),
  }
}

export function toCourse(c: {
  id: number
  name: string
  price: number
  drinkPlanId: number | null
  foodItems: { menuItemId: number; qty: number }[]
}) {
  return {
    id: c.id,
    name: c.name,
    price: c.price,
    drinkPlanId: c.drinkPlanId,
    foodItems: c.foodItems.map((f) => ({ menuItemId: f.menuItemId, qty: f.qty })),
  }
}

export function toDrinkPlan(p: {
  id: number
  name: string
  price: number
  items: { menuItemId: number }[]
}) {
  return { id: p.id, name: p.name, price: p.price, menuItemIds: p.items.map((i) => i.menuItemId) }
}

export function toMenuItem(m: {
  id: number
  name: string
  price: number
  categoryId: number
  subCategoryId: number
  soldOut: boolean
  takeout: 'dine_in' | 'both' | 'takeout'
  sort: number
  optionGroups?: {
    id: number
    name: string
    required: boolean
    sort: number
    choices: { id: number; name: string; extraPrice: number; sort: number }[]
  }[]
}) {
  return {
    id: m.id,
    name: m.name,
    price: m.price,
    categoryId: m.categoryId,
    subCategoryId: m.subCategoryId,
    soldOut: m.soldOut,
    takeout: m.takeout,
    sort: m.sort,
    optionGroups: (m.optionGroups ?? []).map((group) => ({
      id: group.id,
      name: group.name,
      required: group.required,
      sort: group.sort,
      choices: group.choices.map((choice) => ({
        id: choice.id,
        name: choice.name,
        extraPrice: choice.extraPrice,
        sort: choice.sort,
      })),
    })),
  }
}

export function toStaffSession(t: {
  id: string
  issuedAt: Date
  expiresAt: Date
  userAgent: string | null
  ipAddress: string | null
}) {
  return {
    id: t.id,
    issuedAt: t.issuedAt.toISOString(),
    expiresAt: t.expiresAt.toISOString(),
    userAgent: t.userAgent,
    ipAddress: t.ipAddress,
  }
}

export function toOrderItem(o: {
  id: string
  groupId: string
  menuItemId: number | null
  menuItemName: string
  price: number
  qty: number
  status: string
  isTakeout: boolean
  courseId: number | null
  isCourseCharge: boolean
  isDrinkPlanCharge: boolean
  orderedAt: Date
  options?: {
    id: string
    choiceId: number | null
    groupName: string
    choiceName: string
    extraPrice: number
  }[]
}) {
  return {
    id: o.id,
    groupId: o.groupId,
    menuItemId: o.menuItemId,
    menuItemName: o.menuItemName,
    price: o.price,
    qty: o.qty,
    // toGroup と同様 — Prisma は string を返すが shared 型は union literal なのでキャストする
    status: o.status as OrderItemStatus,
    isTakeout: o.isTakeout,
    courseId: o.courseId,
    isCourseCharge: o.isCourseCharge,
    isDrinkPlanCharge: o.isDrinkPlanCharge,
    orderedAt: o.orderedAt.toISOString(),
    options: o.options ?? [],
  }
}
