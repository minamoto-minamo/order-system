import { extractSubdomainLabel, getBaseDomain } from './config.js'
import { prisma } from './prisma.js'

export type StoreContext =
  | { kind: 'store'; storeId: number }
  | { kind: 'platform' }
  | { kind: 'apex' }
  | { kind: 'unknown' }

export async function resolveStoreContext(host: string | undefined): Promise<StoreContext> {
  const hostname = host?.split(':')[0]?.toLowerCase()
  if (!hostname) return { kind: 'unknown' }
  if (hostname === getBaseDomain()) return { kind: 'apex' }

  const label = extractSubdomainLabel(hostname)
  if (label === null) return { kind: 'unknown' }
  if (label === 'admin') return { kind: 'platform' }

  const store = await prisma.store.findUnique({ where: { subdomain: label } })
  if (!store?.isActive) return { kind: 'unknown' }
  return { kind: 'store', storeId: store.id }
}
