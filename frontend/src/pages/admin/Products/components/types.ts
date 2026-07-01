export const TO_OPTIONS = [
  { value: "both",     labelKey: "productSettings.toBoth" as const,    color: "var(--color-course)",  bg: "var(--color-course-bg)",  border: "var(--color-open-border)" },
  { value: "dine_in",  labelKey: "productSettings.toDineIn" as const,  color: "var(--color-muted)", bg: "var(--color-surface)", border: "var(--color-line)" },
  { value: "takeout",  labelKey: "productSettings.toTakeout" as const, color: "var(--color-amber)",   bg: "var(--color-amber-bg)",   border: "var(--color-amber-border)" },
];

export const toMeta = (v: string) => TO_OPTIONS.find(o => o.value === v) ?? TO_OPTIONS[0];

export interface Sub { id: number; label: string; }
export interface Cat { id: number; label: string; subs: Sub[]; }
export interface Product { id: number; name: string; price: number; catId: number | undefined; subId: number; soldOut: boolean; takeout: string; sort: number; }
export interface ProductFormData { name: string; price: number; subId: number; takeout: string; }

export type ModalState = null
  | { type: "addCat" }
  | { type: "editCat"; payload: Cat }
  | { type: "addSub"; payload: { catId: number } }
  | { type: "editSub"; payload: { cat: Cat; sub: Sub } }
  | { type: "addProduct" }
  | { type: "editProduct"; payload: Product };
