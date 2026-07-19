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

// 削除対象店舗に営業中セッション・アクティブなグループが残っていると
// DELETE /api/platform/stores/:id が 409 を返すため、先にスタッフとしてログインし
// 未提供注文のキャンセル → グループを bill_requested → closed へ遷移 → セッションを closed に
// することで削除可能な状態まで畳んでおく。
async function forceCleanupStore(subdomain: string) {
  const ctx = await playwrightRequest.newContext({ baseURL: `http://${subdomain}.localhost:5173` })
  try {
    // CREDS.admin でログインできない店舗（テストが独自の管理者アカウントで作成した店舗等）は
    // API 経由でのクリーンアップを諦め、削除呼び出し自体の成否に判断を委ねる（ベストエフォート）
    const loginRes = await ctx.post('/api/auth/login', { data: CREDS.admin })
    if (!loginRes.ok()) return

    const groupsRes = await ctx.get('/api/groups?status=active,bill_requested')
    if (!groupsRes.ok()) {
      throw new Error(`テスト店舗のグループ取得に失敗しました: ${groupsRes.status()}`)
    }
    const groups = (await groupsRes.json()) as Array<{ id: string; status: string }>

    for (const group of groups) {
      if (group.status === 'active') {
        const ordersRes = await ctx.get(`/api/orders?groupId=${group.id}&status=pending,ready`)
        if (!ordersRes.ok()) {
          throw new Error(`テスト店舗の注文取得に失敗しました: ${ordersRes.status()}`)
        }
        const orders = (await ordersRes.json()) as Array<{ id: string; qty: number }>
        for (const order of orders) {
          const cancelRes = await ctx.put(`/api/orders/${order.id}/cancel`, {
            data: { qty: order.qty },
          })
          if (!cancelRes.ok()) {
            throw new Error(`テスト店舗の注文キャンセルに失敗しました: ${cancelRes.status()}`)
          }
        }

        const toBillRequestedRes = await ctx.put(`/api/groups/${group.id}`, {
          data: { status: 'bill_requested' },
        })
        if (!toBillRequestedRes.ok()) {
          throw new Error(
            `テスト店舗のグループ会計依頼への遷移に失敗しました: ${toBillRequestedRes.status()}`,
          )
        }
      }

      const toClosedRes = await ctx.put(`/api/groups/${group.id}`, { data: { status: 'closed' } })
      if (!toClosedRes.ok()) {
        throw new Error(`テスト店舗のグループクローズに失敗しました: ${toClosedRes.status()}`)
      }
    }

    const sessionRes = await ctx.get('/api/sessions/current')
    if (!sessionRes.ok()) {
      throw new Error(`テスト店舗のセッション取得に失敗しました: ${sessionRes.status()}`)
    }
    const session = (await sessionRes.json()) as { id: number } | null
    if (session) {
      const closeSessionRes = await ctx.put(`/api/sessions/${session.id}`, {
        data: { status: 'closed' },
      })
      if (!closeSessionRes.ok()) {
        throw new Error(`テスト店舗のセッションクローズに失敗しました: ${closeSessionRes.status()}`)
      }
    }
  } finally {
    await ctx.dispose()
  }
}

export async function createTestStore(subdomain: string): Promise<TestStore> {
  const ctx = await platformContext()
  try {
    // 前回実行のクラッシュ等で同名店舗が残っている場合に備え、作成前に削除しておく
    const listRes = await ctx.get('/api/platform/stores')
    const stores = (await listRes.json()) as Array<{ id: number; subdomain: string }>
    const existing = stores.find((s) => s.subdomain === subdomain)
    if (existing) {
      await forceCleanupStore(subdomain)
      const deleteRes = await ctx.delete(`/api/platform/stores/${existing.id}`)
      if (!deleteRes.ok()) {
        throw new Error(`残存テスト店舗の削除に失敗しました: ${deleteRes.status()}`)
      }
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
    const listRes = await ctx.get('/api/platform/stores')
    const stores = (await listRes.json()) as Array<{ id: number; subdomain: string }>
    const store = stores.find((s) => s.id === id)
    if (!store) return

    await forceCleanupStore(store.subdomain)
    const deleteRes = await ctx.delete(`/api/platform/stores/${id}`)
    if (!deleteRes.ok()) {
      throw new Error(`テスト店舗の削除に失敗しました: ${deleteRes.status()}`)
    }
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
