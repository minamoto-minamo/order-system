function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Required env var "${key}" is not set`)
  return value
}

export function getBaseDomain(): string {
  return requireEnv('BASE_DOMAIN')
}

// hostname が "<label>.<BASE_DOMAIN>" の形（単一ラベルのサブドメイン）の場合のみ label を返す
export function extractSubdomainLabel(hostname: string): string | null {
  const suffix = `.${getBaseDomain()}`
  if (!hostname.endsWith(suffix)) return null
  const label = hostname.slice(0, -suffix.length)
  if (!label || label.includes('.')) return null
  return label
}

// apex（BASE_DOMAIN 自身）とサブドメインラベルを区別するための一意な識別子
const APEX_TENANT = Symbol('apex-tenant')

// hostname が表すテナントの識別子を返す。BASE_DOMAIN と無関係な hostname は null
function tenantIdentity(hostname: string): string | typeof APEX_TENANT | null {
  if (hostname === getBaseDomain()) return APEX_TENANT
  return extractSubdomainLabel(hostname)
}

// Origin のテナントとリクエスト先 Host のテナントが一致する場合のみ許可する
export function corsOriginValidator(
  origin: string | undefined,
  host: string | undefined,
  callback: (err: Error | null, allow: boolean) => unknown,
) {
  if (!origin) {
    callback(null, true)
    return
  }
  let originHostname: string
  try {
    originHostname = new URL(origin).hostname
  } catch {
    callback(null, false)
    return
  }
  const hostHostname = host?.split(':')[0]?.toLowerCase()
  const originTenant = tenantIdentity(originHostname)
  const hostTenant = hostHostname ? tenantIdentity(hostHostname) : null
  callback(null, originTenant !== null && originTenant === hostTenant)
}

export function parseDurationSeconds(d: string): number {
  const m = d.match(/^(\d+)([smhd])$/)
  if (!m) return 60 * 60 * 24 * 7
  const n = Number(m[1])
  return { s: 1, m: 60, h: 3600, d: 86400 }[m[2] as 's' | 'm' | 'h' | 'd'] * n
}
