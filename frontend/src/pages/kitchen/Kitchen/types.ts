export interface DisplayCat {
  id: number;
  label: string;
  color: string;
  subs: { id: number; label: string }[];
}

export interface DisplayOrder {
  id: number;
  groupId: number;
  groupName: string;
  seats: string;
  item: string;
  qty: number;
  catId: number;
  subId: number;
  orderedAt: string;
  status: string;
}
