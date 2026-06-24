export { type Seat as ApiSeat, type SeatTable as ApiTable } from '@order-system/shared'

export const G = 48;

export interface TableData { id: number; label: string; x: number; y: number; w: number; h: number; }
export interface SeatData  { id: number; label: string; x: number; y: number; tableId: number | null; }
export interface SelectedItem  { kind: "table" | "seat"; id: number; }
export interface SeatOffset    { id: number; dx: number; dy: number; }
export interface DragState {
  kind: "table" | "seat" | "resize";
  id: number;
  ox: number;
  oy: number;
  seatOffsets?: SeatOffset[];
  initW?: number;
  initH?: number;
}
