# 居酒屋注文システム — API 仕様ドラフト

> **Version**: 0.3 (DRAFT)
> **作成日**: 2026-06-16
> **更新**: 2026-06-16 — POST /api/orders バッチ形式確定、PUT /api/groups リクエストボディ拡張
> **更新**: 2026-06-16 — Socket 正経路確定、Setting/Group/Category 型反映、Seat 状態導出方針確定
> **対象リポジトリ**: `order-system` (モノレポ)

---

## 0. 前提

- このドキュメントは実装の出発点となる **ドラフト**。確定仕様ではない。
- 型は `shared/types/index.ts` を正とする。本書で参照する型名はすべてそこを指す。
- 未確定事項は **TBD** と記載。
- ベースURL: `/api`（Vite が `/api` を `localhost:3000` にプロキシ）
- 認証: 管理者系（`/api/admin/*` 相当）のみパスワード認証。ホール・キッチン系は認証不要（店内LAN前提）。詳細は §4。
- 日時はすべて ISO 8601 文字列（型側も `string`）。
- ID は整数（型側 `number`）。

### 共通レスポンス規約（TBD）

| 状況 | HTTPステータス | ボディ |
|---|---|---|
| 成功（取得） | 200 | リソース本体 |
| 成功（作成） | 201 | 作成されたリソース本体 |
| 成功（更新・本体返却なし） | 200 | 更新後リソース本体 |
| バリデーションエラー | 400 | `{ error: string }` |
| 認証エラー | 401 | `{ error: string }` |
| 未検出 | 404 | `{ error: string }` |
| 状態遷移違反等 | 409 | `{ error: string }` |

エラーボディの統一形は **TBD**（`{ error: string }` を暫定）。

---

## 1. セッション（営業）

`Session` 型: `{ id, status: 'open'|'closed', openedAt, closedAt|null }`

### `GET /api/sessions`
営業セッション一覧。レポート画面（S08）のセッション選択に使用。

- **クエリ**: `?status=open|closed`（任意・フィルタ）
- **レスポンス**: `Session[]`（`openedAt` 降順想定）

### `GET /api/sessions/current`
現在 `open` のセッション。S01 の営業状態バッジ・開始日時表示に使用。

- **レスポンス**: `Session | null`

### `POST /api/sessions`
新しい営業を開始（S01「新しい営業を開始する」）。

- **リクエストボディ**: なし（サーバが `openedAt` を採番）
- **レスポンス**: `Session`（`status: 'open'`）
- **備考**: 既に `open` セッションがある場合は 409（TBD: 二重オープン禁止か要確認）

### `PUT /api/sessions/:id`
営業を締める / 再開する（S01「営業を締める」「営業を再開する」）。

- **リクエストボディ**: `{ status: 'open' | 'closed' }`
- **レスポンス**: `Session`
- **備考**: `closed` 化で `closedAt` を採番。`open` 復帰時は `closedAt` を null に戻す（TBD）。

---

## 2. 席（Seat）

`Seat` 型: `{ id, label, type: 'counter'|'table', x, y, tableId|null }`

### `GET /api/seats`
全席のレイアウト。S02 席一覧／S07 レイアウト設定で使用。

- **レスポンス**: `Seat[]`
- **使用中/空席の判定（確定）**: レスポンスに `isOccupied` 等の状態フィールドは **含まない**。`Seat` 型をそのまま返す。クライアントが `GET /api/groups`（`status=active`）の `seatIds` と突合して使用中を導出する。提供待ち/お会計待ちのバッジ（S02）も、グループの注文状態・`status` から同様に算出する。

### `GET /api/seats/:id`
- **レスポンス**: `Seat`

### `POST /api/seats`
席を追加（S07）。

- **リクエストボディ**: `{ label, type, x, y, tableId? }`
- **レスポンス**: `Seat`

### `PUT /api/seats/:id`
席の編集・移動（S07）。

- **リクエストボディ**: `Partial<{ label, type, x, y, tableId }>`
- **レスポンス**: `Seat`
- **Socket**: `seat:updated` を全クライアントに送出

### `DELETE /api/seats/:id`
席削除（S07）。

- **備考**: 使用中の席は削除不可 → 409
- **レスポンス**: 204

### テーブル矩形について（TBD）
S07 の「テーブル矩形」は席の土台。`Seat.tableId` が紐づき先。テーブル自体を独立リソース（`/api/tables`）にするか、`type: 'table'` の Seat で代用するか **TBD**。

---

## 3. グループ（Group）

`Group` 型: `{ id, name, guestCount, seatIds, status, sessionId, courseId|null, drinkPlanId|null, createdAt }`

`courseId` / `drinkPlanId` でコース適用・飲み放題有効状態をグループに保持する（タスク#7 で追加）。

### `GET /api/groups`
在席グループ一覧。S02／S03 で使用。

- **クエリ**: `?sessionId=`（任意）, `?status=active|bill_requested|closed`（任意）
- **レスポンス**: `Group[]`

### `GET /api/groups/:id`
S04 グループ詳細の基本情報。

- **レスポンス**: `Group`
- **備考**: 注文一覧を同梱するか別エンドポイント（§5 `GET /api/orders?groupId=`）にするか **TBD**。暫定: 注文は別取得。

### `POST /api/groups`
グループ作成（S02 空席選択 → 人数入力）。

- **リクエストボディ**: `{ name?, guestCount, seatIds: number[] }`
  - `name` 省略時はサーバ採番（例: 席ラベル由来）。**TBD**
  - `sessionId` はサーバ側で現在の open セッションを自動付与
- **レスポンス**: `Group`（`status: 'active'`）
- **Socket**: `group:created` + 関連 `seat:updated`

### `PUT /api/groups/:id`
お会計フラグ・退店・人数変更（S04 ヘッダー）。

- **リクエストボディ**: 全フィールド任意（`Partial`）。送ったフィールドのみ更新。
  ```json
  {
    "status": "bill_requested",
    "courseId": 2,
    "drinkPlanId": 1,
    "name": "田中グループ",
    "guestCount": 4,
    "seatIds": [2, 3]
  }
  ```
  - お会計 → `{ "status": "bill_requested" }`
  - 退店 → `{ "status": "closed" }`（席を空きに戻す）
  - コース適用 → `{ "courseId": 2, "drinkPlanId": 1 }`（コースの料理一括注文は別途 §5 `POST /api/orders` で `courseId` を渡す）
- **レスポンス**: `Group`
- **Socket**: `group:updated` + 関連 `seat:updated`

---

## 4. 認証（管理者）TBD

S05 管理者ログイン。パスワード認証のみ（個人アカウントなし）。

### `POST /api/admin/login`
- **リクエストボディ**: `{ password: string }`
- **レスポンス**: `{ token: string }` または Set-Cookie セッション
- **エラー**: 401 `{ error }`
- **TBD**: トークン方式（JWT / セッションCookie）、保存先、有効期限、`/api/admin/*` の認可ミドルウェア要否。パスワードの格納場所（環境変数 or 設定）未確定。

---

## 5. 注文（OrderItem）

`OrderItem` 型: `{ id, groupId, menuItemId, menuItemName, price, qty, status, isTakeout, courseId|null, orderedAt }`

ステータス: `pending → ready → served`、`pending/ready → cancelled`

> **書き込み正経路（確定）**: 調理完了（pending→ready）・提供完了（ready→served）は **Socket イベントが正経路**（§9 `order:complete` / `order:serve`）。REST ではステータス遷移を提供しない。リアルタイム性が必須なため。REST の orders 書き込みは「追加」と「キャンセル」のみ。

### `GET /api/orders`
注文一覧。S04 注文履歴／S03 キッチン横断表示で使用。

- **クエリ**: `?groupId=`（S04）, `?status=`（S03 は pending/ready で絞り込み）, `?sessionId=`（レポート集計の元データ）
- **レスポンス**: `OrderItem[]`

### `POST /api/orders`
注文追加（S04 メニュータブ／コース一括注文）。

- **リクエストボディ**: バッチ形式。`items` に複数行をまとめて投入する。
  ```json
  {
    "groupId": 1,
    "items": [
      { "menuItemId": 3, "qty": 2, "isTakeout": false },
      { "menuItemId": 7, "qty": 1 }
    ],
    "courseId": null
  }
  ```
  - `items` は1件以上。各要素: `menuItemId`（必須）, `qty`（必須）, `isTakeout`（任意・既定 false）。
  - `menuItemName` `price` はサーバが MenuItem から解決。
  - `courseId`: 単品注文時は `null`。コース料理一括注文時は `Course.id` を付与し、`Course.foodItems` を展開して複数 OrderItem 化。**TBD**: コース料理の price 計上方法（コース価格に内包＝個別0円 か 個別計上か）。
- **レスポンス**: `OrderItem[]`（作成された行）
- **Socket**: 各行につき `order:created`

### `PUT /api/orders/:id/cancel`
キャンセル専用（全/一部）。S04 のキャンセルフロー。ホール操作でリアルタイム性が必須でないため REST に置く。

- **リクエストボディ**: `{ qty: number }`
  - `qty` は今回キャンセルする数量。
  - `qty >= 現qty` → 全キャンセル → `status: 'cancelled'`
  - `qty < 現qty` → 一部キャンセル → qty を減算、`status` は維持
- **レスポンス**: `OrderItem`
- **Socket**:
  - 全キャンセル（残0 → cancelled） → `order:cancelled`（payload は `itemId`）
  - 一部キャンセル（残>0） → `order:updated`
- **備考**: 既に `served` / `cancelled` の行へのキャンセルは 409。

> 調理完了（pending→ready）・提供完了（ready→served）の REST エンドポイントは **提供しない**。Socket `order:complete` / `order:serve` が正経路（§9）。

---

## 6. メニュー・カテゴリ・飲み放題・コース

### 6.1 カテゴリ（大分類・小分類）

`Category` 型: `{ id, name, sort }` / `SubCategory` 型: `{ id, categoryId, name, sort }`（`shared/types/index.ts` に追加済み）。`sort` は表示順。

#### `GET /api/categories`
- **レスポンス**: `Category[]`（小分類を含むツリー or フラット、**TBD**）

#### `POST /api/categories` / `PUT /api/categories/:id` / `DELETE /api/categories/:id`
大分類CRUD（S06）。ボディ: `{ name }`。

#### `GET/POST /api/subcategories` + `PUT/DELETE /api/subcategories/:id`
小分類CRUD（S06）。ボディ: `{ name, categoryId }`。

### 6.2 メニュー商品（MenuItem）

`MenuItem` 型: `{ id, name, price, categoryId, subCategoryId, soldOut, takeout }`
`takeout`: `'dine_in' | 'both' | 'takeout'`

#### `GET /api/menus`
- **クエリ**: `?categoryId=`, `?subCategoryId=`, `?takeout=`（S04 のテイクアウトトグル: `both`+`takeout` を表示）, `?soldOut=false`
- **レスポンス**: `MenuItem[]`

#### `GET /api/menus/:id`
- **レスポンス**: `MenuItem`

#### `POST /api/menus`
商品追加（S06）。

- **リクエストボディ**: `{ name, price, categoryId, subCategoryId, takeout, soldOut? }`
- **レスポンス**: `MenuItem`

#### `PUT /api/menus/:id`
商品編集・品切れトグル（S06／S03 品切れ登録）。

- **リクエストボディ**: `Partial<{ name, price, categoryId, subCategoryId, takeout, soldOut }>`
- **レスポンス**: `MenuItem`
- **Socket**: `soldOut` 変更時 `menu:soldout`（payload: `menuItemId`, `soldOut`）

#### `DELETE /api/menus/:id`
- **レスポンス**: 204

### 6.3 飲み放題プラン（DrinkPlan）

`DrinkPlan` 型: `{ id, name, menuItemIds }`

- `GET /api/drink-plans` → `DrinkPlan[]`
- `POST /api/drink-plans` → ボディ `{ name, menuItemIds }`
- `PUT /api/drink-plans/:id` → `Partial<{ name, menuItemIds }>`
- `DELETE /api/drink-plans/:id` → 204

### 6.4 コース（Course）

`Course` 型: `{ id, name, price, foodItems: {menuItemId, qty}[], drinkPlanId|null }`

- `GET /api/courses` → `Course[]`
- `POST /api/courses` → ボディ `{ name, price, foodItems, drinkPlanId? }`
- `PUT /api/courses/:id` → `Partial<{ name, price, foodItems, drinkPlanId }>`
- `DELETE /api/courses/:id` → 204
- **備考**: コース適用は `PUT /api/groups/:id` で `Group.courseId` / `Group.drinkPlanId` を設定。料理の一括注文は §5 `POST /api/orders` に `courseId` を渡す。飲み放題有効中は `Group.drinkPlanId` の `DrinkPlan.menuItemIds` に含まれるドリンクを何度でも注文可。

---

## 7. レポート（S08）

### `GET /api/reports/:sessionId`
セッション単位の売上集計。

- **レスポンス**（フィールドは集計値・**算出定義は TBD**）:
  ```
  {
    sessionId: number,
    summary: {
      totalSales: number,        // 売上合計（税込/税抜どちらか TBD）
      seatUtilization: number,   // 席利用率（算出定義 TBD）
      groupCount: number,
      avgPerGroup: number,       // グループ単価
      guestCount: number,
      avgPerGuest: number        // 客単価
    },
    byCategory: { categoryId, name, amount, count }[],   // 円グラフ用
    byHour: { hour: string, byCategory: {...} }[],        // 時間帯別積み上げ用
    ranking: { menuItemId, name, amount, count }[]        // 人気メニュー
  }
  ```
- **TBD**: 税率（店内10% / TO8%）の適用ロジック、cancelled 行の除外、コース価格の按分。

---

## 8. 設定（S09）

`Setting` 型は `shared/types/index.ts` に追加済み（タスク#7）。店舗全体で単一レコード（single-row）。

`Setting` 型: `{ storeName: string, closingTime: string, taxRateInHouse: number, taxRateTakeout: number }`

### `GET /api/settings`
- **レスポンス**: `Setting`

### `PUT /api/settings`
- **リクエストボディ**: `Partial<Setting>`
- **レスポンス**: `Setting`
- **フィールド**:
  - `storeName`: 店舗名。アプリタイトル・レポートに表示
  - `closingTime`: 営業終了予定時刻。深夜は `"25:00"` 等の文字列表現。全画面の警告バナー判定に使用
  - `taxRateInHouse`: 店内飲食税率（既定 10）
  - `taxRateTakeout`: テイクアウト税率（既定 8）

---

## 9. Socket.io イベント

`shared/types/index.ts` の `ServerToClientEvents` / `ClientToServerEvents` を正とする。
名前空間・パスはデフォルト（`/socket.io`、Vite プロキシ対象）。ルーム分割は **TBD**（現状は全クライアントブロードキャスト想定）。

### Server → Client

| イベント | ペイロード | 発火タイミング |
|---|---|---|
| `order:created` | `OrderItem` | `POST /api/orders` で行作成時（行ごと） |
| `order:updated` | `OrderItem` | `order:complete`/`order:serve` によるステータス変更、または一部キャンセル（残>0） |
| `order:cancelled` | `itemId: number` | 全キャンセル（残0 → cancelled） |
| `group:created` | `Group` | `POST /api/groups` |
| `group:updated` | `Group` | `PUT /api/groups/:id`（お会計・退店・編集） |
| `seat:updated` | `Seat` | 席編集、グループ作成/退店に伴う状態変化 |
| `menu:soldout` | `(menuItemId: number, soldOut: boolean)` | `PUT /api/menus/:id` の soldOut 変更 |

### Client → Server（調理完了・提供完了の正経路）

調理完了・提供完了は **Socket が唯一の書き込み経路**（REST では提供しない）。

| イベント | ペイロード | 効果 |
|---|---|---|
| `order:complete` | `itemId: number` | 注文を `pending → ready` に（調理完了） |
| `order:serve` | `itemId: number` | 注文を `ready → served` に（提供完了） |

**処理フロー**:

```
クライアント（S03 キッチン or S04）
  └─ emit order:complete(itemId) / order:serve(itemId)
        ↓
サーバー
  ├─ DB のステータスを更新（遷移違反なら無視 or エラー）
  └─ broadcast order:updated(更新後 OrderItem) を全クライアントへ
```

- 遷移違反（例: served に対する complete）はサーバ側で弾く。エラー通知方法は **TBD**（暫定: 無視）。

---

## 10. 未確定事項まとめ（TBD 一覧）

1. 共通エラーレスポンスの統一形
2. 認証方式（トークン/Cookie・保存先・パスワード格納場所・認可ミドルウェア）
3. テーブル矩形を独立リソース化するか
4. グループ詳細に注文を同梱するか別取得か
5. コース注文時の price 計上（コース価格内包＝個別0円 か 個別計上か）
6. レポート各指標の算出定義（税適用・cancelled 除外・コース按分）
7. Socket のルーム分割（席/グループ単位の絞り込み配信）
8. Socket の遷移違反時のエラー通知方法（暫定: 無視）

### 確定済み（旧 TBD から解消）

- ✅ 席の使用中/空席状態 → クライアントが `GET /api/groups`（active）の `seatIds` と突合して導出（§2）
- ✅ Category / SubCategory / Setting 型 → `shared/types/index.ts` に追加済み（タスク#7）
- ✅ 飲み放題有効状態の保持先 → `Group.courseId` / `Group.drinkPlanId`（タスク#7）
- ✅ 状態遷移の正経路 → 調理完了/提供完了は Socket、キャンセルは REST（§5・§9）

---

*このドキュメントは `docs/api-spec.md` として管理する。型の正は `shared/types/index.ts`。画面仕様は `docs/screen-spec.md`。*
