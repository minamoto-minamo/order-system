# リファクタリング指示プロンプト

このファイルを Claude Code に渡してリファクタリングを実行させる。
変更は論理的変更ごとに分けてコミットすること（Conventional Commits）。
**挙動は変えない。** 各ステップ後に `pnpm typecheck` が通ることを確認してからコミットする。

---

## 1. 変数シャドウイング修正

**対象**: `frontend/src/pages/kitchen/Kitchen/Kitchen.tsx:68`

`useTranslation()` が返す `t` と `setInterval` の戻り値を受ける `const t` が同名。
`setInterval` 側の変数名を `tickTimer` に変更する。

```ts
// before
const t = setInterval(() => setTick(n => n + 1), 60000)
return () => clearInterval(t)

// after
const tickTimer = setInterval(() => setTick(n => n + 1), 60000)
return () => clearInterval(tickTimer)
```

---

## 2. バックエンドマッパー集約

**対象**: `backend/src/lib/mappers.ts` と各ルートファイル

`toOrderItem` だけ `lib/mappers.ts` に集約されているが、以下の inline 関数がルートファイルに残っている。
`lib/mappers.ts` に移動し、各ルートで import に切り替える。

- `backend/src/routes/groups.ts` — `toGroup()`
- `backend/src/routes/courses.ts` — `toCourse()`
- `backend/src/routes/drinkPlans.ts` — `toDrinkPlan()`

移動後、元ファイルの関数定義と型宣言を削除する。

---

## 3. GroupDetail のコンポーネント分割

**対象**: `frontend/src/pages/group/GroupDetail/GroupDetail.tsx`（411行）

以下の2つを同ディレクトリの別ファイルに切り出す。

### 3-1. `BillFooter.tsx`

`tab === "history"` のときに表示される会計フッター部分
（`<div className="px-4 pt-4 pb-5 ...">` 以下、小計/消費税の計算と会計ボタン類を含む）。

```ts
interface BillFooterProps {
  items: OrderItem[]
  taxRates: { inHouse: number; takeout: number }
  groupStatus: GroupStatus | undefined
  onBillRequest: () => void
  onBillCancel: () => void
  onCheckOut: () => void
}
```

### 3-2. `CourseTab.tsx`

`tab === "course"` のときに表示されるコース一覧部分
（`<div className="flex-1 overflow-y-auto">` 以下すべて）。

```ts
interface CourseTabProps {
  courses: Course[]
  drinkPlans: DrinkPlan[]
  menus: MenuItem[]
  appliedCourse: Course | null
  activeDrinkPlan: DrinkPlan | null
  groupGuestCount: number
  onApply: (course: Course) => void
  onRemove: () => void
}
```

コース選択モーダル（`showCourseConfirm` の `BottomSheetModal`）は
`GroupDetail.tsx` 側に残す（state を親が持つため）。

---

## 4. i18n fallback 文字列の整備

コンポーネントに直書きされている日本語 fallback 文字列を i18n に移す。

**変更箇所**:

- `frontend/src/pages/kitchen/Kitchen/Kitchen.tsx:27`
  `グループ${o.groupId}` → `t('common.unknownGroup', { id: o.groupId })`
- `frontend/src/pages/group/GroupDetail/GroupDetail.tsx:295, 380, 394`
  `商品${fi.menuItemId}` / `商品${mid}` → `t('common.unknownItem', { id: ... })`

`frontend/src/i18n/locales/ja.ts` の `common` 以下に追加:

```ts
unknownGroup: 'グループ{{id}}',
unknownItem: '商品{{id}}',
```

---

## 5. ステータスコード修正

**対象**: 400 を使っている2箇所。
400 Bad Request は構文エラーに使うコード。以下はリクエストの形式は正しく、意味的に処理不可なケースなので 422 Unprocessable Entity が正確。

| ファイル | 行 | 条件 | 現状 | 変更後 |
|---|---|---|---|---|
| `backend/src/routes/staff.ts` | :62 | 自分自身を削除しようとした | 400 | 422 |
| `backend/src/routes/orders.ts` | :75 | 存在しない menuItemId が含まれる | 400 | 422 |

**変更しないもの**（判定が適正な 409 群）:
- `sessions.ts:45` 既にオープンなセッション（同一リソース競合）
- `sessions.ts:147` アクティブグループ残存（閉店不可）
- `groups.ts:90` 席が使用中（席の現在状態との競合）
- `orders.ts:67` グループが active でない（グループ状態との競合）
- `orders.ts:80` 品切れ商品（メニュー状態との競合）
- `orders.ts:133` キャンセル済み注文のキャンセル（注文状態との競合）
- `seats.ts:83` 使用中の席を削除（占有状態との競合）
- `staff.ts:37,51` ユーザー名重複（一意制約との競合）
- P2003 系（categories/subcategories/menus/courses/drinkPlans）外部キー参照残存

---

## 6. エラーメッセージ整備

### 6-1. バックエンド：英語/日本語混在の統一

エラーメッセージを日本語に統一する。

| ファイル | 現状 | 変更後 |
|---|---|---|
| `backend/src/plugins/auth.ts` | `'Unauthorized'` | `'認証が必要です'` |
| `backend/src/plugins/auth.ts` | `'Forbidden'` | `'権限がありません'` |
| `backend/src/routes/categories.ts`（2箇所） | `'Not found'` | `'カテゴリが見つかりません'` |
| `backend/src/routes/subcategories.ts`（2箇所） | `'Not found'` | `'サブカテゴリが見つかりません'` |
| `backend/src/routes/menus.ts`（3箇所） | `'Not found'` | `'メニューが見つかりません'` |
| `backend/src/routes/groups.ts`（2箇所） | `'Not found'` | `'グループが見つかりません'` |
| `backend/src/routes/orders.ts`（2箇所） | `'Not found'` | `'注文が見つかりません'` |
| `backend/src/routes/seats.ts`（2箇所） | `'Not found'` | `'席が見つかりません'` |
| `backend/src/routes/seatTables.ts` | `'Not found'` | `'テーブルが見つかりません'` |
| `backend/src/routes/courses.ts`（2箇所） | `'Not found'` | `'コースが見つかりません'` |
| `backend/src/routes/drinkPlans.ts`（2箇所） | `'Not found'` | `'飲み放題プランが見つかりません'` |
| `backend/src/routes/sessions.ts`（2箇所） | `'Not found'` | `'セッションが見つかりません'` |

### 6-2. フロントエンド：空の catch ブロックにトースト追加

`frontend/src/pages/admin/Products/Products.tsx` の全 CRUD ハンドラ（10箇所）が
`catch {}` 空になっており、バックエンドがエラーを返してもユーザーに一切伝わらない。

`useToast()` フックを追加し、各 catch で `showToast` を呼ぶ。

```ts
const { showToast } = useToast()

// 通常操作（追加・編集・ソート）
} catch { showToast(t('common.saveFailed')) }

// 削除操作（409 が返る可能性あり）
} catch { showToast(t('common.deleteFailed')) }
```

対象ハンドラ:
- `addCat`, `editCat` → `saveFailed`
- `deleteCat` → `deleteFailed`
- `addSub`, `editSub` → `saveFailed`
- `deleteSub` → `deleteFailed`
- `addProduct`, `editProduct`, `toggleSoldOut` → `saveFailed`
- `deleteProduct` → `deleteFailed`

`frontend/src/i18n/locales/ja.ts` の `common` に追加:

```ts
saveFailed: '操作に失敗しました',
deleteFailed: '削除できませんでした',
```

---

## 7. ドキュメント最新化

### E003-groups.md（`docs/api/endpoints/E003-groups.md`）

`POST /api/groups` のリクエストボディを実装に合わせて修正する。

```json
{
  "guestCount": 2,
  "seatIds": [1, 2],
  "name": "A1テーブル"
}
```

- `seatIds` は integer 配列（文字列ではない）
- `openedBy` フィールドは存在しない（削除）
- `name` はオプション（省略時はサーバーが席ラベルから生成）

`PUT /api/groups/:id` のリクエストボディ例も追加:

```json
{
  "status": "bill_requested",
  "courseId": 1,
  "drinkPlanId": 2,
  "guestCount": 3,
  "seatIds": [1, 2, 3]
}
```

### E004-orders.md（`docs/api/endpoints/E004-orders.md`）

エンドポイント一覧を実装に合わせて修正する。

実際のエンドポイント:
```
GET  /api/orders            — 注文一覧（クエリ: groupId, status, sessionId）
POST /api/orders            — 注文作成（複数アイテムを一括）
PUT  /api/orders/:id/cancel — 注文キャンセル（数量指定）
```

以下は存在しないため削除:
- `PUT /api/orders/:id`
- `DELETE /api/orders/:id`
- `GET /api/orders/:id`

POST リクエストボディ例を修正:

```json
{
  "groupId": 1,
  "items": [{ "menuItemId": 3, "qty": 2, "isTakeout": false }],
  "courseId": null
}
```

PUT /api/orders/:id/cancel リクエストボディ例を追加:

```json
{ "qty": 1 }
```

### S200-hall.md（`docs/screens/S200-hall.md`）

API / Socket 一覧に不足している項目を追加:

```
API:
  GET /api/seat-tables          — テーブル枠の取得
  GET /api/orders?status=ready  — 提供待ち注文数の取得

Socket（購読）:
  group:updated     — グループ状態変更時
  order:created     — readyCnt 更新のため
  order:updated     — readyCnt 更新のため
  order:cancelled   — readyCnt 更新のため
```

---

## 実行上の制約

- 外部から見える挙動は変えない
- ルーティング、API エンドポイント、Socket イベント名は変更しない
- E2E テストは修正しない
- 各セクション完了後に `pnpm typecheck` を実行し、パスを確認してからコミット
- セクション 5・6 は独立しているため並列実行可
