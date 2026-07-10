import { request as playwrightRequest } from '@playwright/test'
import { CREDS } from './auth'

const PLATFORM_BASE_URL = 'http://admin.localhost:5173'
const PLATFORM_CREDS = { username: 'platform', password: 'platform1234' }

export interface TestStore {
  id: number
  subdomain: string
  baseURL: string
}

async function platformContext() {
  const ctx = await playwrightRequest.newContext({ baseURL: PLATFORM_BASE_URL })
  const res = await ctx.post('/api/platform/auth/login', { data: PLATFORM_CREDS })
  if (!res.ok()) {
    await ctx.dispose()
    throw new Error(`プラットフォーム管理者ログインに失敗しました: ${res.status()}`)
  }
  return ctx
}

export async function createTestStore(subdomain: string): Promise<TestStore> {
  const ctx = await platformContext()
  try {
    // 前回実行のクラッシュ等で同名店舗が残っている場合に備え、作成前に削除しておく
    const listRes = await ctx.get('/api/platform/stores')
    const stores = (await listRes.json()) as Array<{ id: number; subdomain: string }>
    const existing = stores.find((s) => s.subdomain === subdomain)
    if (existing) {
      await ctx.delete(`/api/platform/stores/${existing.id}`)
    }

    const createRes = await ctx.post('/api/platform/stores', {
      data: {
        subdomain,
        name: subdomain,
        adminUsername: CREDS.admin.username,
        adminPassword: CREDS.admin.password,
      },
    })
    if (!createRes.ok()) throw new Error(`テスト店舗の作成に失敗しました: ${createRes.status()}`)
    const store = (await createRes.json()) as { id: number; subdomain: string }

    return {
      id: store.id,
      subdomain: store.subdomain,
      baseURL: `http://${subdomain}.localhost:5173`,
    }
  } finally {
    await ctx.dispose()
  }
}

export async function deleteTestStore(id: number) {
  const ctx = await platformContext()
  try {
    await ctx.delete(`/api/platform/stores/${id}`)
  } finally {
    await ctx.dispose()
  }
}

export async function findStoreIdBySubdomain(subdomain: string): Promise<number | null> {
  const ctx = await platformContext()
  try {
    const listRes = await ctx.get('/api/platform/stores')
    const stores = (await listRes.json()) as Array<{ id: number; subdomain: string }>
    return stores.find((s) => s.subdomain === subdomain)?.id ?? null
  } finally {
    await ctx.dispose()
  }
}
