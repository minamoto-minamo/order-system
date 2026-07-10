export interface DisplayCat {
  id: number
  label: string
  subs: { id: number; label: string }[]
}

export interface DisplayOrder {
  id: string
  groupId: string
  groupName: string
  seats: string
  item: string
  qty: number
  catId: number
  subId: number
  orderedAt: string
  status: string
}
