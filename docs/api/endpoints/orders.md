---
type: API Endpoint Group
id: E004
title: Orders
description: 注文の作成・更新・取消を扱う API。書き込みは主に Socket.io 経由だが、作成・取消は REST でも扱う。
resource: backend/src/routes/orders.ts
tags: [orders, api]
---

# Orders

注文作成・更新・取消に関する API。書き込みは主に Socket.io 経由だが、作成/取消は REST でも扱う。主要な状態遷移は Socket イベントで同期される。フロント実装者・バックエンド実装者向け。

- Base: `/api/orders`
- Auth: JWT cookie

## エンドポイント

- `GET /api/orders` — 注文一覧（クエリ: groupId, status, sessionId）
- `POST /api/orders` — 注文作成（複数アイテムを一括）
- `PUT /api/orders/:id/cancel` — 注文キャンセル（数量指定）

## GET /api/orders

クエリパラメータ:

- `groupId`: string（UUID）
- `status`: string または string[]（`pending` / `ready` / `served` / `cancelled` のみ有効。カンマ区切り文字列にも対応）
- `sessionId`: string（数値文字列。内部では数値化して照合）

Response 200: order object の配列（`orderedAt` 昇順）
Response 400: `orders.list.invalid_status` — `status` に無効な値が含まれる場合

## POST /api/orders

```json
{
  "groupId": "018f1234-5678-7abc-def0-123456789abc",
  "items": [
    { "menuItemId": 3, "qty": 2, "isTakeout": false },
    { "menuItemId": 8, "qty": 1, "selectedChoiceIds": [12] },
    { "menuItemId": 20, "qty": 1, "selectedFrameChoiceIds": [101, 205] }
  ],
  "courseId": null
}
```

- `groupId` は UUID string
- `qty`: 1〜99（maximum: 99）
- `courseId` を指定した場合、事前に存在確認し、さらにトランザクション内でグループの適用中コースと一致することを再確認する
- `selectedChoiceIds`（省略可）: 商品オプション（`ProductOptionChoice`）の選択。分類（`ProductOptionGroup`）ごとに1つの choiceId のみ指定できる（複数分類がある場合は複数要素）
- `selectedFrameChoiceIds`（省略可）: セットメニュー（`menuItemId` が `isSet: true` の商品）の枠選択。対象商品の全 `SetFrame` について、対応する `SetFrameChoice` のidをちょうど1つずつ指定する

Response 201: order object の配列。セット商品（`isSet: true`）を含む場合、親明細と内訳の子明細が両方フラットに含まれる（後述）

```json
[
  {
    "id": "018f5678-abcd-7abc-def0-000000000001",
    "groupId": "018f1234-5678-7abc-def0-123456789abc",
    "menuItemId": 3,
    "menuItemName": "生ビール",
    "price": 500,
    "originalPrice": 500,
    "qty": 2,
    "status": "pending",
    "isTakeout": false,
    "courseId": null,
    "isCourseCharge": false,
    "isDrinkPlanCharge": false,
    "isSetCharge": false,
    "setOrderItemId": null,
    "orderedAt": "2024-06-01T10:00:00.000Z",
    "options": []
  }
]
```

- `id` は UUID string
- `price`: 実際の請求単価。飲み放題プラン対象商品を店内注文した場合は 0 になる（テイクアウトはプラン対象外）
- `originalPrice`: 注文時点のメニュー単価のスナップショット。飲み放題適用で `price` が 0 の場合でも保持され、後でプラン解除時の価格復元に使う
- レスポンス例には `originalPrice` を含めているが、現行実装の `toOrderItem` mapper はこのフィールドを返していない。DB には保存される
- `options`: `selectedChoiceIds` で選択されたオプションのスナップショット配列（`{ id, choiceId, groupName, choiceName, extraPrice }[]`）。選択なしなら空配列
- `isSetCharge` / `setOrderItemId`: セットメニュー（004-set-menu）関連フィールド。詳細は後述の「セットメニューの注文」を参照
- 作成される明細の返却順は、リクエストの `items` 配列の順序に従う
- GET 一覧は `orderedAt` 昇順で返す

Response 404: `orders.create.group_not_found`
Response 409: `orders.create.group_not_accepting` — グループが `active` でない場合
Response 422: `orders.create.menu_items_not_found` — `menuItemId` が存在しない場合。`details: { menuItemIds: number[] }` に未検出 ID を返す
Response 409: `orders.create.sold_out` — 品切れの商品が含まれる場合
Response 422: `orders.create.takeout_mismatch` — `takeout` 設定（`dine_in`/`takeout`）と `isTakeout` が矛盾する場合
Response 422: `orders.create.course_not_found` — `courseId` が存在しない場合
Response 422: `orders.create.course_food_item_conflict` — `courseId` を指定し、かつ `items` のいずれかの `menuItemId` が対象コースの `foodItems`（コース内商品）に含まれる場合。`details: { courseId: number, conflictingMenuItemIds: number[] }`。コース由来の自動生成明細と衝突する追加注文を防ぐため
Response 422: `orders.create.course_mismatch` — トランザクション開始時点で `courseId` がグループの適用中コースと一致しない場合
Response 409: `orders.create.menu_item_deleted` — トランザクション中に対象 `menuItemId` が削除された場合
Response 409: `orders.cancel.conflict` — Serializable 分離レベルでの書き込み競合を検知した場合（作成処理でも同じエラーコードを使い回している）。会計依頼やコース変更などの同時更新とぶつかったケースを含む。もう一度リクエストすると解決する
Response 400: `orders.create.invalid_option_choice` — `selectedChoiceIds` に、対象商品に属さない・実在しない choiceId が含まれる場合
Response 400: `orders.create.duplicate_option_group_selection` — 同一オプション分類から複数の選択肢が指定された場合
Response 400: `orders.create.missing_required_option` — `required: true` のオプション分類が未選択の場合
Response 400: `orders.create.invalid_set_frame_choice` — `selectedFrameChoiceIds` に、対象商品に属さない・実在しない choiceId が含まれる場合
Response 400: `orders.create.missing_set_frame_selection` — セット商品の `SetFrame` に選択の過不足・重複がある場合（全枠ちょうど1つずつでない）
Response 409: `orders.create.set_frame_choice_sold_out` — 選択された `SetFrameChoice` の参照先商品が品切れの場合
Response 400: `orders.create.set_frame_selection_not_applicable` — `isSet: false` の商品に `selectedFrameChoiceIds` が指定された場合

作成処理では、グループ状態をトランザクション内で再取得して `active` を再確認してから `OrderItem` を作成する。これにより、事前チェック通過後に会計依頼やコース変更が入った場合でも不整合な作成を防ぐ。

### セットメニューの注文（004-set-menu）

`menuItemId` が `isSet: true` の商品を指す場合、通常の1明細ではなく親子構造で作成される（`backend/src/routes/orders.ts` の該当ブロック参照）。

- **親明細**: `menuItemId` はセットの `MenuItem.id`、`price`/`originalPrice` はセット価格そのまま（内訳商品の価格は加算しない）、`qty` はリクエストの数量、`isSetCharge: true`、`status: 'served'`（厨房調理を要さないため作成時点で確定済み扱い）
- **子明細**（`SetFrame` の数だけ作成）: `menuItemId` は選択された商品のid、`price: 0`、`originalPrice` は選択商品の現在単価、`qty` は親と同じ、`setOrderItemId` に親明細の `id` を設定、`status` はデフォルトの `pending`（通常の厨房ワークフローに乗る）
- レスポンス配列には親・子の両方が含まれる（`items` 配列とは1:Nの対応になる）
- 同じグループが同じセットを別の内訳で複数回注文しても、`setOrderItemId` は各注文インスタンス（親明細）の `id` を指すため混ざらない

## PUT /api/orders/:id/cancel

- `:id` は UUID string

```json
{ "qty": 1 }
```

Response 200: 更新後の order object（POST と同形式。対象明細のみ。子明細への連動結果はレスポンスボディには含まれず、Socket イベントで個別に通知される）
Response 404: `orders.cancel.not_found`
Response 409: `orders.cancel.invalid_status` — 既に `cancelled`、またはグループ・セッションが `closed` の場合
Response 409: `orders.cancel.course_charge_not_cancellable` — コース/飲み放題の定額課金明細（`isCourseCharge: true`）は、このAPIでは取消できない。コース解除は `PUT`/`DELETE /groups/:id/course`（[Groups](./groups.md) を参照）を使う
Response 409: `orders.cancel.set_child_not_cancellable` — セットの内訳（子明細、`setOrderItemId != null` かつ `isSetCharge: false`）は単独で取消できない。セット単位（親明細）でキャンセルする
Response 409: `orders.cancel.conflict` — Serializable 分離レベルでの書き込み競合を検知した場合、もう一度リクエストすると解決する

キャンセルは状態遷移と在庫・キッチンキューへの通知を行う。`qty` が明細の残数以上なら `status: cancelled` に、それ未満なら数量を減算して `pending` のまま更新する。前者は Socket `order:cancelled`（キャンセルした注文 ID のみ）、後者は `order:updated`（更新後の order オブジェクト）を emit する。

対象が `isSetCharge: true`（セットの親明細）の場合、同一トランザクション内で `setOrderItemId` が一致する全子明細にも同じ `qty` 変更（全キャンセルまたは同数量分の減算）をカスケードする。子明細それぞれについても `order:cancelled`/`order:updated` の Socket イベントが個別に emit される。
