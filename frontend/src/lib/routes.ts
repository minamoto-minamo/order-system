export const ROUTES = {
  root:              '/',
  login:             '/login',
  hall:              '/hall',
  hallGroup:         (id: number | string) => `/hall/group/${id}`,
  // React Router の <Route path> 用。関数版はパターン文字列を返せないため別途定義
  hallGroupPattern:  '/hall/group/:id',
  kitchen:           '/kitchen',
  kitchenGroup:      (id: number | string) => `/kitchen/group/${id}`,
  // 同上
  kitchenGroupPattern: '/kitchen/group/:id',
  admin:             '/admin',
  adminSeats:        '/admin/seats',
  adminProducts:     '/admin/products',
  adminReport:       '/admin/report',
  adminSettings:     '/admin/settings',
  adminStaff:        '/admin/staff',
  customerOrder:        (id: string) => `/order/${id}`,
  customerOrderPattern: '/order/:id',
} as const
