import { beforeEach, describe, expect, it, jest } from '@jest/globals'

const mockFindUniqueToken = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockUpdateManyToken = jest.fn<(...args: unknown[]) => Promise<{ count: number }>>()
const mockCreateToken = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockFindFirstToken = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockFindManyToken = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockFindUniqueSetting = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockFindUniqueStaff = jest.fn<(...args: unknown[]) => Promise<unknown>>()

const txClient = {
  refreshToken: {
    findUnique: mockFindUniqueToken,
    updateMany: mockUpdateManyToken,
    create: mockCreateToken,
    findFirst: mockFindFirstToken,
  },
  setting: {
    findUnique: mockFindUniqueSetting,
  },
  staff: {
    findUnique: mockFindUniqueStaff,
  },
}

const mockTransaction = jest.fn((cb: (tx: typeof txClient) => unknown) => cb(txClient))

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    $transaction: mockTransaction,
    refreshToken: {
      findUnique: mockFindUniqueToken,
      updateMany: mockUpdateManyToken,
      create: mockCreateToken,
      findFirst: mockFindFirstToken,
      findMany: mockFindManyToken,
    },
    setting: {
      findUnique: mockFindUniqueSetting,
    },
    staff: {
      findUnique: mockFindUniqueStaff,
    },
  },
}))

const {
  hashToken,
  rotateRefreshToken,
  verifyRefreshToken,
  issueRefreshToken,
  revokeTokenByRaw,
  revokeTokenById,
  listActiveSessions,
} = await import('../lib/refreshToken.js')

const STAFF_ID = 'staff-1'
const STORE_ID = 1

beforeEach(() => {
  jest.clearAllMocks()
  mockFindUniqueSetting.mockResolvedValue({
    refreshTokenAutoExtend: true,
    refreshTokenExpiresMinutes: 1440,
  })
  mockFindUniqueStaff.mockResolvedValue({ storeId: STORE_ID })
})

describe('hashToken', () => {
  it('同じ入力に対して決定的なハッシュを返す', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'))
  })

  it('異なる入力に対して異なるハッシュを返す', () => {
    expect(hashToken('abc')).not.toBe(hashToken('xyz'))
  })
})

describe('issueRefreshToken', () => {
  it('自動延長方式では now + expiresMinutes を expiresAt にする', async () => {
    mockFindUniqueSetting.mockResolvedValue({
      refreshTokenAutoExtend: true,
      refreshTokenExpiresMinutes: 60,
    })
    mockCreateToken.mockImplementation(async (args: unknown) => {
      const data = (args as { data: { expiresAt: Date; familyIssuedAt: Date } }).data
      return { id: 'new-id', expiresAt: data.expiresAt }
    })
    const before = Date.now()
    const result = await issueRefreshToken(STORE_ID, STAFF_ID)
    const diffMinutes = (result.expiresAt.getTime() - before) / 60_000
    expect(diffMinutes).toBeGreaterThan(59)
    expect(diffMinutes).toBeLessThan(61)
  })

  it('固定期限方式でもログイン発行時は familyIssuedAt = now のため now + expiresMinutes を expiresAt にする', async () => {
    mockFindUniqueSetting.mockResolvedValue({
      refreshTokenAutoExtend: false,
      refreshTokenExpiresMinutes: 60,
    })
    mockCreateToken.mockImplementation(async (args: unknown) => {
      const data = (args as { data: { expiresAt: Date; familyIssuedAt: Date } }).data
      return { id: 'new-id', expiresAt: data.expiresAt }
    })
    const before = Date.now()
    const result = await issueRefreshToken(STORE_ID, STAFF_ID)
    const diffMinutes = (result.expiresAt.getTime() - before) / 60_000
    expect(diffMinutes).toBeGreaterThan(59)
    expect(diffMinutes).toBeLessThan(61)
  })
})

describe('rotateRefreshToken', () => {
  it('該当トークンが存在しない場合は invalid を返す', async () => {
    mockFindUniqueToken.mockResolvedValue(null)
    const result = await rotateRefreshToken(STORE_ID, 'nonexistent')
    expect(result).toEqual({ status: 'invalid' })
  })

  it('トークンの所有 staff が別店舗に所属する場合は invalid を返す（storeId 不一致）', async () => {
    mockFindUniqueToken.mockResolvedValue({
      id: 'row-1',
      staffId: STAFF_ID,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      familyIssuedAt: new Date(),
    })
    mockFindUniqueStaff.mockResolvedValue({ storeId: STORE_ID + 1 })
    const result = await rotateRefreshToken(STORE_ID, 'raw')
    expect(result).toEqual({ status: 'invalid' })
    expect(mockUpdateManyToken).not.toHaveBeenCalled()
  })

  it('トークンの所有 staff が既に存在しない場合は invalid を返す', async () => {
    mockFindUniqueToken.mockResolvedValue({
      id: 'row-1',
      staffId: STAFF_ID,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      familyIssuedAt: new Date(),
    })
    mockFindUniqueStaff.mockResolvedValue(null)
    const result = await rotateRefreshToken(STORE_ID, 'raw')
    expect(result).toEqual({ status: 'invalid' })
  })

  it('未使用トークンが期限切れの場合は expired を返す', async () => {
    mockFindUniqueToken.mockResolvedValue({
      id: 'row-1',
      staffId: STAFF_ID,
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      familyIssuedAt: new Date(),
    })
    const result = await rotateRefreshToken(STORE_ID, 'raw')
    expect(result).toEqual({ status: 'expired' })
    expect(mockUpdateManyToken).not.toHaveBeenCalled()
  })

  it('未使用トークンが有効な場合は revoke して子トークンを発行し rotated を返す', async () => {
    const familyIssuedAt = new Date(Date.now() - 60_000)
    mockFindUniqueToken.mockResolvedValue({
      id: 'row-1',
      staffId: STAFF_ID,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      familyIssuedAt,
    })
    mockUpdateManyToken.mockResolvedValue({ count: 1 })
    mockCreateToken.mockResolvedValue({
      id: 'child-1',
      expiresAt: new Date(Date.now() + 1440 * 60_000),
    })

    const result = await rotateRefreshToken(STORE_ID, 'raw', {
      userAgent: 'UA',
      ipAddress: '127.0.0.1',
    })

    expect(result.status).toBe('rotated')
    if (result.status === 'rotated') {
      expect(result.staffId).toBe(STAFF_ID)
      expect(result.token.id).toBe('child-1')
    }
    expect(mockUpdateManyToken).toHaveBeenCalledWith({
      where: { id: 'row-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    })
    expect(mockCreateToken).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parentId: 'row-1',
          familyIssuedAt,
          userAgent: 'UA',
          ipAddress: '127.0.0.1',
        }),
      }),
    )
  })

  it('固定期限方式で rotate した場合、子の expiresAt は now ではなく familyIssuedAt（ログイン時刻）起点で計算される', async () => {
    mockFindUniqueSetting.mockResolvedValue({
      refreshTokenAutoExtend: false,
      refreshTokenExpiresMinutes: 60,
    })
    const familyIssuedAt = new Date(Date.now() - 30 * 60_000)
    mockFindUniqueToken.mockResolvedValue({
      id: 'row-1',
      staffId: STAFF_ID,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      familyIssuedAt,
    })
    mockUpdateManyToken.mockResolvedValue({ count: 1 })
    mockCreateToken.mockImplementation(async (args: unknown) => {
      const data = (args as { data: { expiresAt: Date; familyIssuedAt: Date } }).data
      return { id: 'child-1', expiresAt: data.expiresAt }
    })

    const result = await rotateRefreshToken(STORE_ID, 'raw')

    expect(result.status).toBe('rotated')
    if (result.status === 'rotated') {
      const diffMinutes = (result.token.expiresAt.getTime() - familyIssuedAt.getTime()) / 60_000
      expect(diffMinutes).toBeGreaterThan(59)
      expect(diffMinutes).toBeLessThan(61)
    }
  })

  it('猶予期間内に使用済みトークンが再提示され子が存在する場合は reused を返す（cookie 再発行なし）', async () => {
    const revokedAt = new Date(Date.now() - 1000)
    mockFindUniqueToken.mockResolvedValue({
      id: 'row-1',
      staffId: STAFF_ID,
      revokedAt,
      expiresAt: new Date(Date.now() + 60_000),
      familyIssuedAt: new Date(),
    })
    mockFindFirstToken.mockResolvedValue({ id: 'child-1' })

    const result = await rotateRefreshToken(STORE_ID, 'raw')

    expect(result).toEqual({ status: 'reused', staffId: STAFF_ID })
    expect(mockUpdateManyToken).not.toHaveBeenCalled()
  })

  it('子が存在し猶予期間を超えて再提示された場合は reuse-detected とし全トークンを無効化する', async () => {
    const revokedAt = new Date(Date.now() - 60_000)
    mockFindUniqueToken.mockResolvedValue({
      id: 'row-1',
      staffId: STAFF_ID,
      revokedAt,
      expiresAt: new Date(Date.now() + 60_000),
      familyIssuedAt: new Date(),
    })
    mockFindFirstToken.mockResolvedValue({ id: 'child-1' })

    const result = await rotateRefreshToken(STORE_ID, 'raw')

    expect(result).toEqual({ status: 'reuse-detected', staffId: STAFF_ID })
    expect(mockUpdateManyToken).toHaveBeenCalledWith({
      where: { staffId: STAFF_ID, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    })
  })

  it('子が存在しない revoked トークン（個別強制ログアウト済み等）が再提示された場合は他端末に影響せず invalid を返す', async () => {
    const revokedAt = new Date(Date.now() - 1000)
    mockFindUniqueToken.mockResolvedValue({
      id: 'row-1',
      staffId: STAFF_ID,
      revokedAt,
      expiresAt: new Date(Date.now() + 60_000),
      familyIssuedAt: new Date(),
    })
    mockFindFirstToken.mockResolvedValue(null)

    const result = await rotateRefreshToken(STORE_ID, 'raw')

    expect(result).toEqual({ status: 'invalid' })
    expect(mockUpdateManyToken).not.toHaveBeenCalled()
  })

  it('子が存在しない revoked トークンは猶予期間を超えていても invalid を返す（reuse-detected にならない）', async () => {
    const revokedAt = new Date(Date.now() - 60_000)
    mockFindUniqueToken.mockResolvedValue({
      id: 'row-1',
      staffId: STAFF_ID,
      revokedAt,
      expiresAt: new Date(Date.now() + 60_000),
      familyIssuedAt: new Date(),
    })
    mockFindFirstToken.mockResolvedValue(null)

    const result = await rotateRefreshToken(STORE_ID, 'raw')

    expect(result).toEqual({ status: 'invalid' })
    expect(mockUpdateManyToken).not.toHaveBeenCalled()
  })

  it('並行リクエストで revoke に負けた場合、最新状態を読み直して猶予期間ロジックに合流する', async () => {
    const revokedAt = new Date(Date.now() - 1000)
    mockFindUniqueToken
      .mockResolvedValueOnce({
        id: 'row-1',
        staffId: STAFF_ID,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        familyIssuedAt: new Date(),
      })
      .mockResolvedValueOnce({
        id: 'row-1',
        staffId: STAFF_ID,
        revokedAt,
        expiresAt: new Date(Date.now() + 60_000),
        familyIssuedAt: new Date(),
      })
    mockUpdateManyToken.mockResolvedValue({ count: 0 })
    mockFindFirstToken.mockResolvedValue({ id: 'child-1' })

    const result = await rotateRefreshToken(STORE_ID, 'raw')

    expect(result).toEqual({ status: 'reused', staffId: STAFF_ID })
    expect(mockFindUniqueToken).toHaveBeenCalledTimes(2)
  })
})

describe('verifyRefreshToken', () => {
  it('該当トークンが存在しない場合は invalid を返す', async () => {
    mockFindUniqueToken.mockResolvedValue(null)
    const result = await verifyRefreshToken('nonexistent')
    expect(result).toEqual({ status: 'invalid' })
  })

  it('既に revoke 済みの場合は invalid を返す', async () => {
    mockFindUniqueToken.mockResolvedValue({
      id: 'row-1',
      staffId: STAFF_ID,
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    })
    const result = await verifyRefreshToken('raw')
    expect(result).toEqual({ status: 'invalid' })
  })

  it('期限切れの場合は expired を返す', async () => {
    mockFindUniqueToken.mockResolvedValue({
      id: 'row-1',
      staffId: STAFF_ID,
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    })
    const result = await verifyRefreshToken('raw')
    expect(result).toEqual({ status: 'expired' })
  })

  it('未失効・未失効期限内の場合は valid を返し、DBを書き換えない', async () => {
    mockFindUniqueToken.mockResolvedValue({
      id: 'row-1',
      staffId: STAFF_ID,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    })
    const result = await verifyRefreshToken('raw')
    expect(result).toEqual({ status: 'valid', staffId: STAFF_ID })
    expect(mockUpdateManyToken).not.toHaveBeenCalled()
    expect(mockCreateToken).not.toHaveBeenCalled()
  })
})

describe('revokeTokenByRaw', () => {
  it('該当トークンを revoke する', async () => {
    mockUpdateManyToken.mockResolvedValue({ count: 1 })
    await revokeTokenByRaw('raw')
    expect(mockUpdateManyToken).toHaveBeenCalledWith({
      where: { tokenHash: hashToken('raw'), revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    })
  })
})

describe('revokeTokenById', () => {
  it('staffId が一致し revoke できた場合 true を返す', async () => {
    mockUpdateManyToken.mockResolvedValue({ count: 1 })
    const result = await revokeTokenById(STAFF_ID, 'token-1')
    expect(result).toBe(true)
  })

  it('staffId が一致しない・既に revoke 済みの場合 false を返す', async () => {
    mockUpdateManyToken.mockResolvedValue({ count: 0 })
    const result = await revokeTokenById(STAFF_ID, 'token-1')
    expect(result).toBe(false)
  })
})

describe('listActiveSessions', () => {
  it('staffId・未 revoke・未失効の条件で findMany を呼ぶ', async () => {
    mockFindManyToken.mockResolvedValue([])
    await listActiveSessions(STAFF_ID)
    expect(mockFindManyToken).toHaveBeenCalledWith({
      where: { staffId: STAFF_ID, revokedAt: null, expiresAt: { gt: expect.any(Date) } },
      orderBy: { issuedAt: 'desc' },
    })
  })
})
