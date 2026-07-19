import jwt from '@fastify/jwt'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals'
import Fastify from 'fastify'
import { ErrorCodes, errorBody } from '../lib/errors.js'

process.env.JWT_SECRET = 'test-secret'
process.env.ACCESS_TOKEN_EXPIRES_IN = '15m'
process.env.BASE_DOMAIN = 'localhost'

// socket.ts 内の非公開定数と同一文字列（ガード違反時の単一の汎用メッセージ）
const REJECTED_MESSAGE = '操作を反映できませんでした。画面を更新してください'

type FakeOrderItem = {
  id: string
  status: string
  group: { status: string; session: { status: string } }
}
type FakeGroup = { id: string; storeId: number }

const mockOrderItemFindFirst = jest.fn<(...args: unknown[]) => Promise<FakeOrderItem | null>>()
const mockOrderItemUpdate = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockStaffFindFirst = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockGroupFindFirst = jest.fn<(...args: unknown[]) => Promise<FakeGroup | null>>()
const mockVerifyRefreshToken = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockResolveStoreContext = jest.fn<(...args: unknown[]) => Promise<unknown>>()

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    orderItem: { findFirst: mockOrderItemFindFirst, update: mockOrderItemUpdate },
    staff: { findFirst: mockStaffFindFirst },
    group: { findFirst: mockGroupFindFirst },
  },
}))

jest.unstable_mockModule('../lib/refreshToken.js', () => ({
  verifyRefreshToken: mockVerifyRefreshToken,
}))

jest.unstable_mockModule('../lib/store.js', () => ({
  resolveStoreContext: mockResolveStoreContext,
}))

const { default: socketPlugin } = await import('../plugins/socket.js')

async function buildTestApp() {
  const app = Fastify({ logger: false })
  await app.register(jwt, {
    secret: process.env.JWT_SECRET!,
    cookie: { cookieName: 'token', signed: false },
  })
  await app.register(socketPlugin)
  await app.ready()
  return app
}

function fakeAuthSocket(headers: Record<string, string | undefined>) {
  return { handshake: { headers, address: '127.0.0.1' }, data: {} as Record<string, unknown> }
}

function runMiddleware(app: Awaited<ReturnType<typeof buildTestApp>>, socket: unknown) {
  return new Promise<Error | undefined>((resolve) => {
    // socket.io は io.use() で登録したミドルウェアを Namespace._fns に積む（型定義には出てこない内部実装）
    const fns = (
      app.io.sockets as unknown as { _fns: Array<(s: unknown, cb: (err?: Error) => void) => void> }
    )._fns
    fns[0](socket, (err?: Error) => resolve(err))
  })
}

function fakeSocket(data: {
  authenticated: boolean
  storeId: number
  expiresAt?: number
  userId?: string
}) {
  const handlers = new Map<string, (...args: unknown[]) => unknown>()
  return {
    id: 'test-socket',
    data,
    join: jest.fn(),
    on: jest.fn((event: string, cb: (...args: unknown[]) => unknown) => handlers.set(event, cb)),
    emit: jest.fn(),
    disconnect: jest.fn(),
    handlers,
  }
}

describe('Socket.io — io.use 認証ミドルウェア（refresh_token による再認証）', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  beforeAll(async () => {
    app = await buildTestApp()
  })
  afterAll(async () => {
    await app.close()
  })
  beforeEach(() => {
    jest.clearAllMocks()
    mockResolveStoreContext.mockResolvedValue({ kind: 'store', storeId: 1 })
  })

  const STAFF = { id: 'staff-1', username: 'taro', role: 'staff', storeId: 1 }

  it('有効なアクセストークンならそのまま認証済みにする', async () => {
    const token = app.jwt.sign({
      type: 'staff' as const,
      userId: STAFF.id,
      username: STAFF.username,
      role: STAFF.role,
      storeId: STAFF.storeId,
    })
    const socket = fakeAuthSocket({ host: 'store1.localhost', cookie: `token=${token}` })
    const err = await runMiddleware(app, socket)
    expect(err).toBeUndefined()
    expect(socket.data.authenticated).toBe(true)
    expect(socket.data.userId).toBe(STAFF.id)
    expect(mockVerifyRefreshToken).not.toHaveBeenCalled()
  })

  it('アクセストークンが失効しており refresh_token も無い場合は未認証のまま接続を許可する', async () => {
    const socket = fakeAuthSocket({ host: 'store1.localhost', cookie: 'token=invalid-or-expired' })
    const err = await runMiddleware(app, socket)
    expect(err).toBeUndefined()
    expect(socket.data.authenticated).toBe(false)
    expect(mockVerifyRefreshToken).not.toHaveBeenCalled()
  })

  it('アクセストークン失効かつ refresh_token が有効な場合は再認証する（再接続の取りこぼし対策）。トークンは消費（ローテーション）しない', async () => {
    mockVerifyRefreshToken.mockResolvedValue({ status: 'valid', staffId: STAFF.id })
    mockStaffFindFirst.mockResolvedValue(STAFF)
    const socket = fakeAuthSocket({
      host: 'store1.localhost',
      cookie: 'token=invalid-or-expired; refresh_token=old-raw-token',
    })
    const err = await runMiddleware(app, socket)
    expect(err).toBeUndefined()
    expect(socket.data.authenticated).toBe(true)
    expect(socket.data.expiresAt).toBeGreaterThan(Date.now())
    expect(socket.data.userId).toBe(STAFF.id)
  })

  it.each([
    'invalid',
    'expired',
  ] as const)('refresh_token が %s の場合は未認証のまま接続を許可する', async (status) => {
    mockVerifyRefreshToken.mockResolvedValue({ status, staffId: STAFF.id })
    const socket = fakeAuthSocket({
      host: 'store1.localhost',
      cookie: 'token=invalid-or-expired; refresh_token=bad-raw-token',
    })
    const err = await runMiddleware(app, socket)
    expect(err).toBeUndefined()
    expect(socket.data.authenticated).toBe(false)
  })
})

describe('Socket.io — 接続時の store ルーム join', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  beforeAll(async () => {
    app = await buildTestApp()
  })
  afterAll(async () => {
    await app.close()
  })

  it('未認証（客用画面）の接続では store ルームに join しない（group:join で自グループのみ join させる）', () => {
    const socket = fakeSocket({ authenticated: false, storeId: 1 })
    const [onConnection] = app.io.listeners('connection')
    onConnection(socket as never)
    expect(socket.join).not.toHaveBeenCalledWith('store:1')
  })

  it('認証済み（スタッフ）の接続では store ルームに join する', () => {
    const socket = fakeSocket({ authenticated: true, storeId: 1 })
    const [onConnection] = app.io.listeners('connection')
    onConnection(socket as never)
    expect(socket.join).toHaveBeenCalledWith('store:1')
  })

  it('認証済み（スタッフ）の接続では user ルームにも join する（ログアウト時の強制切断対象）', () => {
    const socket = fakeSocket({ authenticated: true, storeId: 1, userId: 'staff-1' })
    const [onConnection] = app.io.listeners('connection')
    onConnection(socket as never)
    expect(socket.join).toHaveBeenCalledWith('user:staff-1')
  })

  it('未認証（客用画面）の接続では user ルームに join しない', () => {
    const socket = fakeSocket({ authenticated: false, storeId: 1 })
    const [onConnection] = app.io.listeners('connection')
    onConnection(socket as never)
    expect(socket.join).not.toHaveBeenCalledWith(expect.stringMatching(/^user:/))
  })
})

describe('Socket.io — group:join（客用ゲスト接続の自グループルーム join）', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  beforeAll(async () => {
    app = await buildTestApp()
  })
  afterAll(async () => {
    await app.close()
  })
  beforeEach(() => {
    jest.clearAllMocks()
  })

  function connect(storeId = 1) {
    const socket = fakeSocket({ authenticated: false, storeId })
    const [onConnection] = app.io.listeners('connection')
    onConnection(socket as never)
    return socket
  }

  it('自ストアに属するグループなら group ルームに join する', async () => {
    const socket = connect(1)
    mockGroupFindFirst.mockResolvedValue({ id: 'group-1', storeId: 1 })
    await socket.handlers.get('group:join')!('group-1')
    expect(mockGroupFindFirst).toHaveBeenCalledWith({ where: { id: 'group-1', storeId: 1 } })
    expect(socket.join).toHaveBeenCalledWith('group:group-1')
  })

  it('自ストアに属するグループなら customer-store ルームにも join する', async () => {
    const socket = connect(1)
    mockGroupFindFirst.mockResolvedValue({ id: 'group-1', storeId: 1 })
    await socket.handlers.get('group:join')!('group-1')
    expect(socket.join).toHaveBeenCalledWith('customer-store:1')
  })

  it('存在しない、または他ストアのグループなら join しない', async () => {
    const socket = connect(1)
    mockGroupFindFirst.mockResolvedValue(null)
    await socket.handlers.get('group:join')!('other-store-group')
    expect(socket.join).not.toHaveBeenCalled()
  })

  it('存在しない、または他ストアのグループなら customer-store ルームにも join しない', async () => {
    const socket = connect(1)
    mockGroupFindFirst.mockResolvedValue(null)
    await socket.handlers.get('group:join')!('other-store-group')
    expect(socket.join).not.toHaveBeenCalledWith(expect.stringMatching(/^customer-store:/))
  })
})

describe('Socket.io — order:complete / order:serve の group/session 状態チェック', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  beforeAll(async () => {
    app = await buildTestApp()
  })
  afterAll(async () => {
    await app.close()
  })
  beforeEach(() => {
    jest.clearAllMocks()
  })

  function connect() {
    const socket = fakeSocket({ authenticated: true, storeId: 1 })
    const [onConnection] = app.io.listeners('connection')
    onConnection(socket as never)
    return socket
  }

  it('会計済み（closed）グループの注文は order:complete で更新せず、error を通知する', async () => {
    const socket = connect()
    mockOrderItemFindFirst.mockResolvedValue({
      id: 'item-1',
      status: 'pending',
      group: { status: 'closed', session: { status: 'open' } },
    })
    await socket.handlers.get('order:complete')!('item-1')
    expect(mockOrderItemUpdate).not.toHaveBeenCalled()
    expect(socket.emit).toHaveBeenCalledWith(
      'error',
      errorBody(ErrorCodes.Socket.OrderCompleteRejected, REJECTED_MESSAGE).error,
    )
  })

  it('セッションが closed の注文は order:complete で更新せず、error を通知する', async () => {
    const socket = connect()
    mockOrderItemFindFirst.mockResolvedValue({
      id: 'item-1',
      status: 'pending',
      group: { status: 'active', session: { status: 'closed' } },
    })
    await socket.handlers.get('order:complete')!('item-1')
    expect(mockOrderItemUpdate).not.toHaveBeenCalled()
    expect(socket.emit).toHaveBeenCalledWith(
      'error',
      errorBody(ErrorCodes.Socket.OrderCompleteRejected, REJECTED_MESSAGE).error,
    )
  })

  it('対象明細が pending 以外の場合は order:complete で更新せず、error を通知する', async () => {
    const socket = connect()
    mockOrderItemFindFirst.mockResolvedValue({
      id: 'item-1',
      status: 'ready',
      group: { status: 'active', session: { status: 'open' } },
    })
    await socket.handlers.get('order:complete')!('item-1')
    expect(mockOrderItemUpdate).not.toHaveBeenCalled()
    expect(socket.emit).toHaveBeenCalledWith(
      'error',
      errorBody(ErrorCodes.Socket.OrderCompleteRejected, REJECTED_MESSAGE).error,
    )
  })

  it('active なグループ・open なセッションの注文は order:complete で更新し、error は通知しない', async () => {
    const socket = connect()
    mockOrderItemFindFirst.mockResolvedValue({
      id: 'item-1',
      status: 'pending',
      group: { status: 'active', session: { status: 'open' } },
    })
    mockOrderItemUpdate.mockResolvedValue({
      id: 'item-1',
      groupId: 'g1',
      menuItemId: 1,
      menuItemName: 'test',
      price: 100,
      qty: 1,
      status: 'ready',
      isTakeout: false,
      taxRate: { toNumber: () => 10 },
      taxInclusive: false,
      courseId: null,
      isCourseCharge: false,
      isDrinkPlanCharge: false,
      orderedAt: new Date(),
    })
    await socket.handlers.get('order:complete')!('item-1')
    expect(mockOrderItemUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'item-1' }, data: { status: 'ready' } }),
    )
    expect(socket.emit).not.toHaveBeenCalledWith('error', expect.anything())
  })

  it('会計済み（closed）グループの注文は order:serve で更新せず、error を通知する', async () => {
    const socket = connect()
    mockOrderItemFindFirst.mockResolvedValue({
      id: 'item-1',
      status: 'ready',
      group: { status: 'closed', session: { status: 'open' } },
    })
    await socket.handlers.get('order:serve')!('item-1')
    expect(mockOrderItemUpdate).not.toHaveBeenCalled()
    expect(socket.emit).toHaveBeenCalledWith(
      'error',
      errorBody(ErrorCodes.Socket.OrderServeRejected, REJECTED_MESSAGE).error,
    )
  })

  it('セッションが closed の注文は order:serve で更新せず、error を通知する', async () => {
    const socket = connect()
    mockOrderItemFindFirst.mockResolvedValue({
      id: 'item-1',
      status: 'ready',
      group: { status: 'active', session: { status: 'closed' } },
    })
    await socket.handlers.get('order:serve')!('item-1')
    expect(mockOrderItemUpdate).not.toHaveBeenCalled()
    expect(socket.emit).toHaveBeenCalledWith(
      'error',
      errorBody(ErrorCodes.Socket.OrderServeRejected, REJECTED_MESSAGE).error,
    )
  })

  it('対象明細が ready 以外の場合は order:serve で更新せず、error を通知する', async () => {
    const socket = connect()
    mockOrderItemFindFirst.mockResolvedValue({
      id: 'item-1',
      status: 'pending',
      group: { status: 'active', session: { status: 'open' } },
    })
    await socket.handlers.get('order:serve')!('item-1')
    expect(mockOrderItemUpdate).not.toHaveBeenCalled()
    expect(socket.emit).toHaveBeenCalledWith(
      'error',
      errorBody(ErrorCodes.Socket.OrderServeRejected, REJECTED_MESSAGE).error,
    )
  })

  it('active なグループ・open なセッションの注文は order:serve で更新し、error は通知しない', async () => {
    const socket = connect()
    mockOrderItemFindFirst.mockResolvedValue({
      id: 'item-1',
      status: 'ready',
      group: { status: 'active', session: { status: 'open' } },
    })
    mockOrderItemUpdate.mockResolvedValue({
      id: 'item-1',
      groupId: 'g1',
      menuItemId: 1,
      menuItemName: 'test',
      price: 100,
      qty: 1,
      status: 'served',
      isTakeout: false,
      taxRate: { toNumber: () => 10 },
      taxInclusive: false,
      courseId: null,
      isCourseCharge: false,
      isDrinkPlanCharge: false,
      orderedAt: new Date(),
    })
    await socket.handlers.get('order:serve')!('item-1')
    expect(mockOrderItemUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'item-1' }, data: { status: 'served' } }),
    )
    expect(socket.emit).not.toHaveBeenCalledWith('error', expect.anything())
  })
})

describe('Socket.io — アクセストークン有効期限による強制再認証', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  beforeAll(async () => {
    app = await buildTestApp()
  })
  afterAll(async () => {
    await app.close()
  })
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('有効期限が来ると接続を切断する', () => {
    const socket = fakeSocket({ authenticated: true, storeId: 1, expiresAt: Date.now() + 1000 })
    const [onConnection] = app.io.listeners('connection')
    onConnection(socket as never)

    jest.advanceTimersByTime(999)
    expect(socket.disconnect).not.toHaveBeenCalled()

    jest.advanceTimersByTime(1)
    expect(socket.disconnect).toHaveBeenCalledWith(true)
  })

  it('未認証（客用画面）の接続はタイマーをセットしない', () => {
    const socket = fakeSocket({ authenticated: false, storeId: 1 })
    const [onConnection] = app.io.listeners('connection')
    onConnection(socket as never)

    jest.advanceTimersByTime(24 * 60 * 60 * 1000)
    expect(socket.disconnect).not.toHaveBeenCalled()
  })
})
