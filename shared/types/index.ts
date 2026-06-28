// ============================================================
// 共有型定義 - フロントエンド・バックエンド共通
// ============================================================

export type SeatType = 'counter' | 'table'

export interface SeatTable {
  id: number
  label: string
  x: number
  y: number
  w: number
  h: number
}

export interface Seat {
  id: number
  label: string
  type: SeatType
  x: number
  y: number
  tableId: number | null
}

export type GroupStatus = 'active' | 'bill_requested' | 'closed'

export interface Group {
  id: string
  name: string
  guestCount: number
  seatIds: number[]
  status: GroupStatus
  sessionId: number
  courseId: number | null
  drinkPlanId: number | null
  createdAt: string
}

export type OrderItemStatus = 'pending' | 'ready' | 'served' | 'cancelled'

export interface OrderItem {
  id: string
  groupId: string
  menuItemId: number
  menuItemName: string
  price: number
  qty: number
  status: OrderItemStatus
  isTakeout: boolean
  taxRate: number
  courseId: number | null
  orderedAt: string
}

export interface Category {
  id: number
  name: string
  sort: number
}

export interface SubCategory {
  id: number
  categoryId: number
  name: string
  sort: number
}

export type TakeoutType = 'dine_in' | 'both' | 'takeout'

export interface MenuItem {
  id: number
  name: string
  price: number
  categoryId: number
  subCategoryId: number
  soldOut: boolean
  takeout: TakeoutType
}

export interface DrinkPlan {
  id: number
  name: string
  menuItemIds: number[]
}

export interface Course {
  id: number
  name: string
  price: number
  foodItems: { menuItemId: number; qty: number }[]
  drinkPlanId: number | null
}

export type SessionStatus = 'open' | 'closed'

export interface Session {
  id: number
  status: SessionStatus
  openedAt: string
  closedAt: string | null
}

export interface Setting {
  storeName: string
  closingTime: string
  taxRateInHouse: number
  taxRateTakeout: number
}

export interface ServerToClientEvents {
  'order:created':    (item: OrderItem) => void
  'order:updated':    (item: OrderItem) => void
  'order:cancelled':  (itemId: string)  => void
  'group:created':    (group: Group)    => void
  'group:updated':    (group: Group)    => void
  'seat:created':     (seat: Seat)      => void
  'seat:updated':     (seat: Seat)      => void
  'menu:soldout':     (menuItemId: number, soldOut: boolean) => void
  'session:updated':  (session: Session) => void
  'settings:updated': (setting: Setting) => void
  'staff:called':     (groupId: string, groupName: string) => void
}

export interface ClientToServerEvents {
  'order:complete': (itemId: string) => void
  'order:serve':    (itemId: string) => void
}

// ============================================================
// API DTO 型
// ============================================================

// --- Sessions ---
export interface CreateSessionRequest {}

// --- Seats ---
export interface UpsertSeatRequest {
  label: string
  type: SeatType
  x: number
  y: number
  tableId: number | null
}

// --- Groups ---
export interface CreateGroupRequest {
  name: string
  guestCount: number
  seatIds: number[]
  sessionId: number
}

export interface UpdateGroupRequest {
  status?: GroupStatus
  courseId?: number | null
  drinkPlanId?: number | null
  name?: string
  guestCount?: number
  seatIds?: number[]
}

// --- Orders ---
export interface OrderItemInput {
  menuItemId: number
  qty: number
  isTakeout?: boolean
}

export interface CreateOrderBatchRequest {
  groupId: string
  items: OrderItemInput[]
  courseId?: number | null
}

export interface CancelOrderItemRequest {
  qty: number
}

// --- Menus ---
export interface UpsertMenuItemRequest {
  name: string
  price: number
  categoryId: number
  subCategoryId: number
  soldOut: boolean
  takeout: TakeoutType
}

export interface UpsertCategoryRequest {
  name: string
  sort: number
}

export interface UpsertSubCategoryRequest {
  categoryId: number
  name: string
  sort: number
}

// --- Settings ---
export interface UpdateSettingRequest {
  storeName?: string
  closingTime?: string
  taxRateInHouse?: number
  taxRateTakeout?: number
}

// --- Staff ---
export type StaffRole = 'admin' | 'staff'

export interface StaffMember {
  id: string
  username: string
  role: StaffRole
  createdAt: string
}

export interface AuthUser {
  id: string
  username: string
  role: StaffRole
}

export interface CreateStaffRequest {
  username: string
  password: string
  role: StaffRole
}

export interface UpdateStaffRequest {
  username?: string
  password?: string
  role?: StaffRole
}

// --- SeatTables ---
export interface UpsertSeatTableRequest {
  label: string
  x: number
  y: number
  w: number
  h: number
}

// --- SeatLayout ---
export interface SeatLayoutResponse {
  canvasCols: number
  canvasRows: number
  canvasColsMin: number
  canvasColsMax: number
  canvasRowsMin: number
  canvasRowsMax: number
  gridSize: number
  gridSizeMin: number
  gridSizeMax: number
  tables: SeatTable[]
  seats: Seat[]
}

export interface SeatLayoutSaveRequest {
  canvasCols: number
  canvasRows: number
  gridSize: number
  tables: Array<{ id: number; label: string; x: number; y: number; w: number; h: number }>
  seats: Array<{ id: number; label: string; x: number; y: number; tableId: number | null }>
}
