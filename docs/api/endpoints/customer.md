---
type: API Endpoint Group
id: E014
title: Customer
description: 客用（QR コード経由の未認証アクセス）の来店グループ閲覧・メニュー取得・注文作成・会計依頼・スタッフ呼出を扱う API。
resource: backend/src/routes/customer.ts
tags: [customer, api]
---

# Customer

客席の QR コードからアクセスする客用画面（`CustomerOrder` 等）が使う API。ホール/キッチン向けの通常 API とは異なり **認証不要**。フロント実装者・バックエンド実装者向け。

- Base: `/api/customer`
- Auth: none（`plugins/auth.ts` の JWT 検証 preHandler は `/api/customer/` 配下を対象外にしている）。マルチテナント分離は他の API と同様に Host ヘッダーから解決される `storeId` で行う
- Rate limit: `@fastify/rate-limit` を本ルート全体に登録（60 リクエスト/分、IP 単位のデフォルトキー）。超過時は 429 を返すが `errorResponseBuilder` を指定していないため、body は `@fastify/rate-limit` のデフォルト形式（`{ statusCode, error, message }`）であり、[spec.md](../spec.md) の共通エラー形式（`{ error: { code, message, details } }`）とは異なる

## エンドポイント

- `GET /api/customer/groups/:id` — グループ詳細取得
- `GET /api/customer/groups/:id/menus` — 注文可能なメニュー一覧取得
- `GET /api/customer/groups/:id/orders` — 自グループの注文一覧取得
- `POST /api/customer/groups/:id/bill` — 会計依頼
- `GET /api/customer/settings` — 税率設定取得
- `POST /api/customer/groups/:id/call-staff` — スタッフ呼出
- `POST /api/customer/orders` — 注文作成

いずれも `:id` は Group の UUID string。`storeId` が一致しない、または存在しない `groupId` を指定した場合はすべて 404 `customer.group.not_found` を返す（テナント間の推測アクセスを遮断するため、権限エラーではなく not found を返す）。

## GET /api/customer/groups/:id

Response 200: group object（[Groups](./groups.md) の POST/PUT と同形式。`effectiveTaxRateInHouse` / `effectiveTaxRateTakeout` / `effectiveTaxInclusive` を含む）

```json
{
  "id": "018f1234-5678-7abc-def0-123456789abc",
  "name": "A1テーブル",
  "guestCount": 2,
  "seatIds": [1, 2],
  "status": "active",
  "sessionId": 1,
  "courseId": null,
  "drinkPlanId": null,
  "effectiveTaxRateInHouse": 10,
  "effectiveTaxRateTakeout": 8,
  "effectiveTaxInclusive": false,
  "createdAt": "2024-06-01T10:00:00.000Z"
}
```

Response 404: `customer.group.not_found`
Response 500: `common.setting_not_found` — 店舗の税率設定（`Setting`）が存在しない場合

## GET /api/customer/groups/:id/menus

品切れ（`soldOut: true`）の商品は結果から除外される。

Response 200:

```json
{
  "menus": [
    {
      "id": 3,
      "name": "生ビール",
      "price": 500,
      "categoryId": 1,
      "subCategoryId": null,
      "takeout": "both",
      "soldOut": false,
      "sort": 0,
      "isSet": false,
      "optionGroups": [
        {
          "id": 1,
          "name": "氷の状態",
          "required": true,
          "sort": 0,
          "choices": [{ "id": 1, "name": "ロック", "extraPrice": 0, "sort": 0 }]
        }
      ],
      "setFrames": []
    }
  ],
  "categories": [{ "id": 1, "name": "ドリンク", "sort": 0 }],
  "subCategories": [{ "id": 1, "name": "ビール", "sort": 0, "categoryId": 1 }]
}
```

- `takeout`: `MenuItem.takeout` の値（`both` / `takeout` など）。`takeout` 専用商品は `POST /orders` で 422 になる（下記参照）
- `optionGroups`: 商品オプション（[Menus](./menus.md) の `MenuItem` レスポンスと同形式）。003-product-options
- `isSet` / `setFrames`: セットメニュー関連フィールド（[Menus](./menus.md) の `MenuItem` レスポンスと同形式。`setFrames[].choices[].name`/`price`/`soldOut` は参照先商品の現在値）。004-set-menu。このエンドポイントは `backend/src/lib/mappers.ts` の `toMenuItem` を使わず独自にinlineマッピングしているが、返す内容は `GET /menus` と同じ形

Response 404: `customer.group.not_found`

## GET /api/customer/groups/:id/orders

`groupId` に紐づく `OrderItem` を `orderedAt` 昇順で全件返す（ステータス絞り込みなし。キャンセル済み・完了済みも含む）。

Response 200: order item の配列（[Orders](./orders.md) の POST と同形式）

Response 404: `customer.group.not_found`

## POST /api/customer/groups/:id/bill

会計を依頼する（グループのステータスを `bill_requested` に変更）。

会計依頼の可否は check-then-act ではなく、Serializable トランザクション内でグループ状態と未提供明細を再検証してから確定する。

Response 204: No Content
Response 404: `customer.group.not_found`
Response 400: `customer.bill.not_allowed` — グループが `active` でない場合（既に `bill_requested` / `closed`）
Response 409: `customer.bill.unserved_items_exist` — 未提供（`pending` / `ready`）の `OrderItem` が残っている場合。`details: { count: number }`（未提供明細数）
Response 500: `common.setting_not_found` — 店舗の税率設定が存在しない場合

成功時は Socket.io `group:updated`（payload: 更新後の group object）を `store:${storeId}` と `group:${id}` の両ルームへ emit する。

## GET /api/customer/settings

客用画面が税率表示に使う簡易設定取得。`Setting` レコードが存在しない場合はデフォルト値（10 / 8）を返す。管理用の `GET /api/settings`（[Settings](./settings.md)）とは異なるレスポンス形状で、`taxRateInHouse` / `taxRateTakeout` の2フィールドのみ返す（`taxInclusive` は含まれない）。

Response 200:

```json
{ "taxRateInHouse": 10, "taxRateTakeout": 8 }
```

## POST /api/customer/groups/:id/call-staff

Response 204: No Content
Response 404: `customer.group.not_found`

成功時は Socket.io `staff:called`（payload: `(groupId: string, groupName: string)`）を `store:${storeId}` ルームのみへ emit する（客側には配信しない）。

## POST /api/customer/orders

Request body（JSON Schema でバリデーション。`additionalProperties: false`）:

```json
{
  "groupId": "018f1234-5678-7abc-def0-123456789abc",
  "items": [
    { "menuItemId": 3, "qty": 2 },
    { "menuItemId": 8, "qty": 1, "selectedChoiceIds": [12] },
    { "menuItemId": 20, "qty": 1, "selectedFrameChoiceIds": [101, 205] }
  ]
}
```

- `groupId`: string、必須
- `items`: 1件以上の配列、必須
  - `menuItemId`: integer（`minimum: 1`）、必須
  - `qty`: integer（`minimum: 1, maximum: 99`）、必須
  - `selectedChoiceIds`（省略可）: 商品オプション（`ProductOptionChoice`）の選択。分類ごとに1つの choiceId のみ指定できる。003-product-options
  - `selectedFrameChoiceIds`（省略可）: セットメニュー（`isSet: true` の商品）の枠選択。対象商品の全 `SetFrame` について、対応する `SetFrameChoice` のidをちょうど1つずつ指定する。004-set-menu
- `POST /api/orders`（スタッフ用、[Orders](./orders.md)）と異なり `isTakeout` / `courseId` は受け付けない。作成される `OrderItem` は常に `isTakeout: false`、`courseId: null`、`isCourseCharge: false`、`isDrinkPlanCharge: false` 固定（客用画面はテイクアウト・コース注文を扱わない）。セット商品の親明細も同様に `isTakeout: false` で作成される
- `price` は `menuItemMap` から取得した注文時点の `MenuItem.price`。グループにドリンクプラン（`drinkPlanId`）が適用されている場合、`items` の各行ごとにプラン対象商品かどうかを個別に判定する。プラン対象商品は `price: 0`、プラン対象外の商品は通常どおり `originalPrice`（注文時点の `MenuItem.price`）で課金され、両者が混在する1リクエストも全体拒否せずそのまま部分受理する（プラン対象外の商品だけを理由に注文全体が拒否されることはない）。`originalPrice` には常に注文時点の `MenuItem.price` を保持する（飲み放題解除時の復元用）。`selectedChoiceIds` を指定した場合は `price = Math.max(0, originalPrice + Σ選択オプションのextraPrice)`（0円未満はクランプ）。セット商品（`selectedFrameChoiceIds`）の価格計算は後述の「セットメニューの注文」を参照

バリデーション順序と対応エラー:

1. Response 404: `customer.group.not_found` — `groupId` が自 storeId に存在しない
2. Response 400: `customer.orders.closed` — グループが `active` でない（注文受付停止中）
3. Response 422: `customer.orders.menu_items_not_found` — 存在しない `menuItemId` を含む。`details: { menuItemIds: number[] }`（見つからなかった ID の配列）
4. Response 409: `customer.orders.sold_out` — 品切れ商品を含む。`details: { menuItemIds: number[], menuItemNames: string[] }`
5. Response 422: `customer.orders.takeout_only` — `takeout: 'takeout'`（テイクアウト専用）の商品を含む
6. Response 400: `customer.orders.invalid_option_choice` — `selectedChoiceIds` に、対象商品に属さない・実在しない choiceId が含まれる場合。003-product-options
7. Response 400: `customer.orders.duplicate_option_group_selection` — 同一オプション分類から複数の選択肢が指定された場合
8. Response 400: `customer.orders.missing_required_option` — `required: true` のオプション分類が未選択の場合
9. Response 400: `customer.orders.set_frame_selection_not_applicable` — `isSet: false` の商品に `selectedFrameChoiceIds` が指定された場合。004-set-menu
10. Response 400: `customer.orders.invalid_set_frame_choice` — `selectedFrameChoiceIds` に、対象商品に属さない・実在しない choiceId が含まれる場合
11. Response 400: `customer.orders.missing_set_frame_selection` — セット商品の `SetFrame` に選択の過不足・重複がある場合
12. Response 409: `customer.orders.set_frame_choice_sold_out` — 選択された `SetFrameChoice` の参照先商品が品切れの場合

上記チェックを通過した後、DB トランザクション内でグループの現在ステータスを再取得して `active` であることを再確認してから `OrderItem` を作成する。会計依頼（`bill_requested`）等による同時更新との競合を防ぐためで、再確認時点で `active` でなくなっていた場合も Response 400: `customer.orders.closed` を返す（トランザクションはロールバックされ、作成は行われない）。トランザクションは Serializable 分離レベルで実行される。

Response 409: `customer.orders.menu_item_deleted` — トランザクション中に対象 `menuItemId` が削除された場合
Response 409: `customer.orders.conflict` — Serializable 分離レベルでの書き込み競合を検知した場合。もう一度リクエストすると解決する

Response 201: 作成された order item の配列（[Orders](./orders.md) の POST と同形式。`options` / `isSetCharge` / `setOrderItemId` フィールドを含む）

成功時は作成された各 order item について Socket.io `order:created`（payload: OrderItem）を `store:${storeId}` と `group:${groupId}` の両ルームへ emit する。セット商品を含む場合、親明細・子明細それぞれについて個別に emit される。

### セットメニューの注文（004-set-menu）

挙動は [Orders](./orders.md) の「セットメニューの注文」と同じ（親明細＝セット価格・`isSetCharge: true`・`status: 'served'`、子明細＝`price: 0`・`setOrderItemId`で紐付け・`status: 'pending'`）。客用にはキャンセルAPIが存在しないため、セット注文の取消はスタッフ用 `PUT /api/orders/:id/cancel` を使う。
