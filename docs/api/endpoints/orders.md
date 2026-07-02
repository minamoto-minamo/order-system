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
- Auth: bearer

## エンドポイント

- `GET /api/orders` — 注文一覧（クエリ: groupId, status, sessionId）
- `POST /api/orders` — 注文作成（複数アイテムを一括）
- `PUT /api/orders/:id/cancel` — 注文キャンセル（数量指定）

## GET /api/orders

クエリパラメータ:

- `groupId`: string（UUID）
- `status`: string または string[]
- `sessionId`: string

## POST /api/orders

```json
{
  "groupId": "018f1234-5678-7abc-def0-123456789abc",
  "items": [{ "menuItemId": 3, "qty": 2, "isTakeout": false }],
  "courseId": null
}
```

- `groupId` は UUID string
- `qty`: 1〜99（maximum: 99）
- `courseId` を指定した場合、存在しないと 422 を返す

Response 201: order object

```json
[
  {
    "id": "018f5678-abcd-7abc-def0-000000000001",
    "groupId": "018f1234-5678-7abc-def0-123456789abc",
    "menuItemId": 3,
    "menuItemName": "生ビール",
    "price": 500,
    "qty": 2,
    "status": "pending",
    "isTakeout": false,
    "taxRate": 10,
    "courseId": null,
    "orderedAt": "2024-06-01T10:00:00.000Z"
  }
]
```

- `id` は UUID string

作成で 201 を返す。

## PUT /api/orders/:id/cancel

- `:id` は UUID string

```json
{ "qty": 1 }
```

Response 200: 更新後の order object（POST と同形式）

キャンセルは状態遷移と在庫・キッチンキューへの通知を行う。
