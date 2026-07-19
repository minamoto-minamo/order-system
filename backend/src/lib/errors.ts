import type { FastifyReply } from 'fastify'

export const ErrorCodes = {
  Common: {
    NotFound: 'common.request.not_found',
    ValidationFailed: 'common.request.validation_failed',
    InternalServerError: 'common.server.internal_error',
    DatabaseUnavailable: 'common.health.database_unavailable',
    UnknownStore: 'common.store.unknown',
    SettingNotFound: 'common.setting_not_found',
  },
  Auth: {
    Required: 'auth.session.required',
    Forbidden: 'auth.session.forbidden',
    InvalidCredentials: 'auth.login.invalid_credentials',
    RateLimited: 'auth.login.rate_limited',
  },
  PlatformStores: {
    NotFound: 'platform_stores.detail.not_found',
    ReservedSubdomain: 'platform_stores.save.reserved_subdomain',
    DuplicateSubdomain: 'platform_stores.save.duplicate_subdomain',
    ActiveDataExists: 'platform_stores.delete.active_data_exists',
  },
  Sessions: {
    AlreadyOpen: 'sessions.create.already_open',
    NotFound: 'sessions.detail.not_found',
    ActiveGroupsExist: 'sessions.close.active_groups_exist',
    ReportNotClosed: 'sessions.report.not_closed',
  },
  Groups: {
    InvalidStatus: 'groups.list.invalid_status',
    NotFound: 'groups.detail.not_found',
    InvalidSeats: 'groups.save.invalid_seats',
    NoOpenSession: 'groups.save.no_open_session',
    SeatConflict: 'groups.save.seat_conflict',
    InvalidTransition: 'groups.update.invalid_transition',
    ClosedOrBillRequested: 'groups.update.closed_or_bill_requested',
    CourseNotApplicable: 'groups.course.not_applicable',
    CourseAlreadyApplied: 'groups.course.already_applied',
    CourseNotFound: 'groups.course.not_found',
    SettingNotFound: 'groups.course.setting_not_found',
    CourseSoldOut: 'groups.course.sold_out',
    CourseQtyNotEditable: 'groups.course_qty.not_editable',
    CourseNotApplied: 'groups.course.not_applied',
    CourseRemovalNotAllowed: 'groups.course.remove_not_allowed',
    CourseConflict: 'groups.course.conflict',
  },
  Orders: {
    InvalidStatus: 'orders.list.invalid_status',
    GroupNotFound: 'orders.create.group_not_found',
    GroupNotAccepting: 'orders.create.group_not_accepting',
    MenuItemsNotFound: 'orders.create.menu_items_not_found',
    MenuItemDeleted: 'orders.create.menu_item_deleted',
    SoldOut: 'orders.create.sold_out',
    TakeoutMismatch: 'orders.create.takeout_mismatch',
    CourseNotFound: 'orders.create.course_not_found',
    CourseMismatch: 'orders.create.course_mismatch',
    CourseFoodItemConflict: 'orders.create.course_food_item_conflict',
    SettingNotFound: 'orders.create.setting_not_found',
    Conflict: 'orders.cancel.conflict',
    NotFound: 'orders.cancel.not_found',
    CourseChargeNotCancellable: 'orders.cancel.course_charge_not_cancellable',
    InvalidCancelStatus: 'orders.cancel.invalid_status',
  },
  Menus: {
    NotFound: 'menus.detail.not_found',
    SubCategoryNotFound: 'menus.save.subcategory_not_found',
    SubCategoryMismatch: 'menus.save.subcategory_mismatch',
    ActiveOrderExists: 'menus.delete.active_order_exists',
    ReferencedCourse: 'menus.delete.referenced_course',
    ReferencedDrinkPlan: 'menus.delete.referenced_drink_plan',
    ReferencedByPlanOrCourse: 'menus.delete.referenced_by_plan_or_course',
  },
  Categories: {
    NotFound: 'categories.detail.not_found',
    InUse: 'categories.delete.in_use',
  },
  Subcategories: {
    NotFound: 'subcategories.detail.not_found',
    CategoryNotFound: 'subcategories.save.category_not_found',
    InUse: 'subcategories.delete.in_use',
  },
  Courses: {
    MenuNotFound: 'courses.save.menu_not_found',
    DrinkPlanNotFound: 'courses.save.drink_plan_not_found',
    NotFound: 'courses.detail.not_found',
    InUse: 'courses.delete.in_use',
  },
  DrinkPlans: {
    MenuNotFound: 'drink_plans.save.menu_not_found',
    NotFound: 'drink_plans.detail.not_found',
    ReferencedCourse: 'drink_plans.delete.referenced_course',
    InUse: 'drink_plans.delete.in_use',
  },
  Seats: {
    NotFound: 'seats.detail.not_found',
    InUse: 'seats.delete.in_use',
    TableNotFound: 'seats.save.table_not_found',
  },
  SeatLayout: {
    CanvasColsOutOfRange: 'seat_layout.update.canvas_cols_out_of_range',
    CanvasRowsOutOfRange: 'seat_layout.update.canvas_rows_out_of_range',
    GridSizeOutOfRange: 'seat_layout.update.grid_size_out_of_range',
    BusySeatsIncluded: 'seat_layout.update.busy_seats_included',
    InvalidTableId: 'seat_layout.update.invalid_table_id',
  },
  Staff: {
    DuplicateUsername: 'staff.save.duplicate_username',
    NotFound: 'staff.detail.not_found',
    CannotDeleteSelf: 'staff.delete.self',
    SessionNotFound: 'staff.sessions.not_found',
  },
  Customer: {
    GroupNotFound: 'customer.group.not_found',
    BillRequestNotAllowed: 'customer.bill.not_allowed',
    OrderingClosed: 'customer.orders.closed',
    MenuItemsNotFound: 'customer.orders.menu_items_not_found',
    MenuItemDeleted: 'customer.orders.menu_item_deleted',
    SoldOut: 'customer.orders.sold_out',
    TakeoutOnly: 'customer.orders.takeout_only',
    DrinkPlanMismatch: 'customer.orders.drink_plan_mismatch',
    Conflict: 'customer.orders.conflict',
  },
  Socket: {
    OrderCompleteFailed: 'socket.order.complete_failed',
    OrderServeFailed: 'socket.order.serve_failed',
    OrderCompleteRejected: 'socket.order.complete_rejected',
    OrderServeRejected: 'socket.order.serve_rejected',
  },
} as const

export type ErrorDetails = Record<string, unknown> | unknown[] | null

export type ApiErrorBody = {
  error: {
    code: string
    message: string
    details: ErrorDetails
  }
}

export function errorBody(
  code: string,
  message: string,
  details: ErrorDetails = null,
): ApiErrorBody {
  return { error: { code, message, details } }
}

export function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  details: ErrorDetails = null,
) {
  return reply.status(statusCode).send(errorBody(code, message, details))
}
