import { test as base } from '@playwright/test'
import { createTestStore, deleteTestStore, type TestStore } from './store'
import { seedStoreFixtures } from './storeFixtures'

// worker ごとに固定サブドメイン（e2e-workerN）でテスト専用店舗を作成し、baseURL フィクスチャを差し替える。
// spec ファイルは同一 worker 内で順番に実行されるため、worker 単位の名前を使い回しても
// ファイル間で衝突しない。worker 数を増やしても /etc/hosts に e2e-workerN を追加するだけで済む。
// 固定サブドメイン名にしているのは、Node 経由のリクエスト（page.request.*）が
// `*.localhost` を RFC 6761 のループバック解決に頼れず /etc/hosts の事前登録が必要なため
// （動的生成のサブドメインは事前登録できず使えない。docs/ops/runbook.md 参照）。
export function testWithStore() {
  // trace: 'on-first-retry' 設定により、Playwright は beforeAll 実行前に
  // トレース記録用の auto fixture の依存解決として baseURL フィクスチャを一度呼び出す
  // （store 未代入の状態）。このときの fixture インスタンスは beforeAll 完了後に破棄され、
  // 実際のテストでは改めて解決されるため、store 未代入時は undefined を返して素通りさせる。
  let store: TestStore | undefined

  const test = base.extend<{}, {}>({
    baseURL: async ({}, use) => {
      await use(store?.baseURL)
    },
  })

  test.beforeAll(async ({}, testInfo) => {
    store = await createTestStore(`e2e-worker${testInfo.parallelIndex}`)
    await seedStoreFixtures(store.id)
  })

  test.afterAll(async () => {
    await deleteTestStore(store!.id)
  })

  return { test, expect: base.expect, getStore: () => store! }
}
