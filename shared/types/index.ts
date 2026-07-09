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

export interface ApiErrorPayload {
  code: string
  message: string
  details: unknown | null
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
  effectiveTaxRateInHouse: number
  effectiveTaxRateTakeout: number
  effectiveTaxInclusive: boolean
  createdAt: string
}

export type OrderItemStatus = 'pending' | 'ready' | 'served' | 'cancelled'

export interface OrderItem {
  id: string
  groupId: string
  menuItemId: number | null
  menuItemName: string
  price: number
  qty: number
  status: OrderItemStatus
  isTakeout: boolean
  courseId: number | null
  isCourseCharge: boolean
  isDrinkPlanCharge: boolean
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
  sort: number
}

export interface DrinkPlan {
  id: number
  name: string
  price: number
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
  taxInclusive: boolean
  refreshTokenAutoExtend: boolean
  refreshTokenExpiresMinutes: number
}

// settings:updated は未認証の客用ソケットにも配信されるため、内部設定値（税率・リフレッシュトークン設定）を含まない
export type PublicSetting = Pick<Setting, 'storeName' | 'closingTime'>

export interface ServerToClientEvents {
  'order:created':       (item: OrderItem) => void
  'order:updated':       (item: OrderItem) => void
  'order:cancelled':     (itemId: string)  => void
  'group:created':       (group: Group)    => void
  'group:updated':       (group: Group)    => void
  'seat:created':        (seat: Seat)      => void
  'seat:updated':        (seat: Seat)      => void
  'menu:soldout':        (menuItemId: number, soldOut: boolean) => void
  'menu:created':        (item: MenuItem)  => void
  'menu:updated':        (item: MenuItem)  => void
  'menu:deleted':        (menuItemId: number) => void
  'course:created':      (course: Course) => void
  'course:updated':      (course: Course) => void
  'course:deleted':      (courseId: number) => void
  'drinkPlan:created':   (drinkPlan: DrinkPlan) => void
  'drinkPlan:updated':   (drinkPlan: DrinkPlan) => void
  'drinkPlan:deleted':   (drinkPlanId: number) => void
  'seatLayout:updated':  (layout: SeatLayoutResponse) => void
  'session:updated':     (session: Session) => void
  'settings:updated':    (setting: PublicSetting) => void
  'staff:called':        (groupId: string, groupName: string) => void
  'error':               (payload: ApiErrorPayload) => void
}

export interface ClientToServerEvents {
  'order:complete': (itemId: string) => void
  'order:serve':    (itemId: string) => void
  'group:join':     (groupId: string) => void
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
  taxInclusive?: boolean
  refreshTokenAutoExtend?: boolean
  refreshTokenExpiresMinutes?: number
}

// --- Staff ---
export type StaffRole = 'admin' | 'staff'

export interface StaffMember {
  id: string
  username: string
  role: StaffRole
  createdAt: string
}

export interface StaffSession {
  id: string
  issuedAt: string
  expiresAt: string
  userAgent: string | null
  ipAddress: string | null
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

// --- Courses / DrinkPlans ---
export interface UpsertDrinkPlanRequest {
  name: string
  price: number
  menuItemIds: number[]
}

export interface UpsertCourseRequest {
  name: string
  price: number
  drinkPlanId?: number | null
  foodItems: { menuItemId: number; qty: number }[]
}

export interface ApplyCourseRequest {
  courseId: number
  qty: number
}

// --- Platform ---
export interface PlatformAdmin {
  id: string
  username: string
}

export interface Store {
  id: number
  subdomain: string
  name: string
  isActive: boolean
  createdAt: string
}

export interface CreateStoreRequest {
  subdomain: string
  name: string
  adminUsername: string
  adminPassword: string
}

export interface UpdateStoreRequest {
  name?: string
  isActive?: boolean
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
