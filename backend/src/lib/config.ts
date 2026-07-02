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

// Origin ヘッダーが BASE_DOMAIN 自身または BASE_DOMAIN のサブドメインかどうかを検証する
export function corsOriginValidator(
  origin: string | undefined,
  callback: (err: Error | null, allow: boolean) => void
): void {
  if (!origin) return callback(null, true)
  const baseDomain = getBaseDomain()
  let hostname: string
  try {
    hostname = new URL(origin).hostname
  } catch {
    return callback(null, false)
  }
  callback(null, hostname === baseDomain || hostname.endsWith(`.${baseDomain}`))
}

export function parseDurationSeconds(d: string): number {
  const m = d.match(/^(\d+)([smhd])$/)
  if (!m) return 60 * 60 * 24 * 7
  const n = Number(m[1])
  return { s: 1, m: 60, h: 3600, d: 86400 }[m[2] as 's'|'m'|'h'|'d'] * n
}
