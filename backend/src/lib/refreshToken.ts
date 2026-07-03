import crypto from 'node:crypto'
import { prisma } from './prisma.js'

type PrismaOrTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0] | typeof prisma

interface SessionMeta {
  userAgent?: string | null
  ipAddress?: string | null
}

export interface IssuedToken {
  raw: string
  id: string
  expiresAt: Date
}

export type RotateOutcome =
  | { status: 'rotated'; staffId: string; token: IssuedToken }
  | { status: 'reused'; staffId: string }
  | { status: 'invalid' }
  | { status: 'expired' }
  | { status: 'reuse-detected'; staffId: string }

const DEFAULT_REFRESH_AUTO_EXTEND = true
const DEFAULT_REFRESH_EXPIRES_MINUTES = 1440

function reuseGraceMs(): number {
  const seconds = Number(process.env.REFRESH_TOKEN_REUSE_GRACE_SECONDS)
  return (Number.isFinite(seconds) && seconds > 0 ? seconds : 8) * 1000
}

export function generateRawToken(): string {
  return crypto.randomBytes(32).toString('base64url')
}

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

async function getRefreshSetting(client: PrismaOrTx, storeId: number): Promise<{ autoExtend: boolean; expiresMinutes: number }> {
  const setting = await client.setting.findUnique({ where: { storeId } })
  return {
    autoExtend: setting?.refreshTokenAutoExtend ?? DEFAULT_REFRESH_AUTO_EXTEND,
    expiresMinutes: setting?.refreshTokenExpiresMinutes ?? DEFAULT_REFRESH_EXPIRES_MINUTES,
  }
}

async function createToken(
  client: PrismaOrTx,
  storeId: number,
  staffId: string,
  opts: { parentId?: string; familyIssuedAt?: Date } & SessionMeta,
): Promise<IssuedToken> {
  const { autoExtend, expiresMinutes } = await getRefreshSetting(client, storeId)
  const now = new Date()
  const familyIssuedAt = opts.familyIssuedAt ?? now
  const expiresAt = autoExtend
    ? new Date(now.getTime() + expiresMinutes * 60_000)
    : new Date(familyIssuedAt.getTime() + expiresMinutes * 60_000)
  const raw = generateRawToken()
  const created = await client.refreshToken.create({
    data: {
      staffId,
      tokenHash: hashToken(raw),
      parentId: opts.parentId ?? null,
      familyIssuedAt,
      expiresAt,
      userAgent: opts.userAgent ?? null,
      ipAddress: opts.ipAddress ?? null,
    },
  })
  return { raw, id: created.id, expiresAt: created.expiresAt }
}

export async function issueRefreshToken(storeId: number, staffId: string, meta: SessionMeta = {}): Promise<IssuedToken> {
  return createToken(prisma, storeId, staffId, meta)
}

export async function rotateRefreshToken(storeId: number, rawToken: string, meta: SessionMeta = {}): Promise<RotateOutcome> {
  const hash = hashToken(rawToken)
  const now = new Date()

  return prisma.$transaction(async (tx) => {
    const row = await tx.refreshToken.findUnique({ where: { tokenHash: hash } })
    if (!row) return { status: 'invalid' }

    if (row.revokedAt === null) {
      if (row.expiresAt <= now) return { status: 'expired' }

      // 条件付き UPDATE で排他制御する。PostgreSQL の UPDATE 文自体が対象行をロックするため、
      // 同時に同じトークンを処理しようとしても count は片方だけ 1 になる
      const revoke = await tx.refreshToken.updateMany({
        where: { id: row.id, revokedAt: null },
        data: { revokedAt: now },
      })

      if (revoke.count === 1) {
        const token = await createToken(tx, storeId, row.staffId, {
          parentId: row.id,
          familyIssuedAt: row.familyIssuedAt,
          ...meta,
        })
        return { status: 'rotated', staffId: row.staffId, token }
      }
      // ここに到達するのは、他の並行リクエストが自分より先に同じ行を revoke した場合のみ。
      // 最新状態を読み直し、以降の「使用済みトークン提示」ロジックに合流させる
    }

    const current = row.revokedAt !== null ? row : await tx.refreshToken.findUnique({ where: { tokenHash: hash } })
    if (!current || current.revokedAt === null) return { status: 'invalid' }

    const child = await tx.refreshToken.findFirst({ where: { parentId: current.id } })
    if (!child) {
      // 子が存在しない revoked トークン = ローテーションを経ていない失効（admin による強制ログアウト等）。
      // reuse の証拠ではないため全端末を巻き込まず、単に無効なトークンとして扱う
      return { status: 'invalid' }
    }

    const elapsed = now.getTime() - current.revokedAt.getTime()
    if (elapsed <= reuseGraceMs()) {
      // raw トークンはハッシュ化して保存しているため子の raw は再現できない。
      // 猶予期間内の重複リクエストには新しい refresh cookie を発行せず、呼び出し側でアクセストークンのみ再発行させる
      return { status: 'reused', staffId: current.staffId }
    }

    // 猶予期間を超えてローテーション済みトークンが再提示された = reuse 攻撃の疑いがあるため全端末を失効させる
    await tx.refreshToken.updateMany({
      where: { staffId: current.staffId, revokedAt: null },
      data: { revokedAt: now },
    })
    return { status: 'reuse-detected', staffId: current.staffId }
  })
}

export type VerifyRefreshOutcome =
  | { status: 'valid'; staffId: string }
  | { status: 'invalid' }
  | { status: 'expired' }

// rotateRefreshToken と異なりトークンを消費・失効させない読み取り専用の検証。
// Socket.io再接続時の透過認証など、実際のトークンローテーションはHTTPの
// /api/auth系フローに委譲したい呼び出し元向け（ブラウザのcookieとDB状態がずれるのを防ぐ）
export async function verifyRefreshToken(rawToken: string): Promise<VerifyRefreshOutcome> {
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(rawToken) } })
  if (!row || row.revokedAt !== null) return { status: 'invalid' }
  if (row.expiresAt <= new Date()) return { status: 'expired' }
  return { status: 'valid', staffId: row.staffId }
}

export async function revokeTokenByRaw(rawToken: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export async function revokeTokenById(staffId: string, tokenId: string): Promise<boolean> {
  const result = await prisma.refreshToken.updateMany({
    where: { id: tokenId, staffId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  return result.count === 1
}

export async function listActiveSessions(staffId: string) {
  return prisma.refreshToken.findMany({
    where: { staffId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { issuedAt: 'desc' },
  })
}
