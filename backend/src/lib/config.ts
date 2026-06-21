function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Required env var "${key}" is not set`)
  return value
}

export function parseCorsOrigins(): string | string[] {
  const raw = requireEnv('CORS_ORIGIN')
  const origins = raw.split(',').map(s => s.trim()).filter(Boolean)
  return origins.length === 1 ? origins[0] : origins
}
