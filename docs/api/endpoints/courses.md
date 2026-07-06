---
type: API Endpoint Group
id: E007
title: Courses
description: コース・セットメニューの参照・管理 API。
resource: backend/src/routes/courses.ts
tags: [courses, api]
---

# Courses

コース・セットメニューに関する API。Course と MenuItem の参照整合性を確認すること。コース注文時に展開されるアイテムが明確であること。フロント実装者・バックエンド実装者向け。

- Base: `/api/courses`
- Auth: JWT cookie（管理操作は admin 限定）

## エンドポイント

- `GET /api/courses` — コース一覧（全員）
- `POST /api/courses` — コース作成（admin のみ）
- `PUT /api/courses/:id` — コース更新（admin のみ）
- `DELETE /api/courses/:id` — コース削除（admin のみ）

## GET /api/courses

```json
[
  {
    "id": 1,
    "name": "ランチセット",
    "price": 1500,
    "drinkPlanId": null,
    "foodItems": [
      { "menuItemId": 3, "qty": 1 },
      { "menuItemId": 7, "qty": 2 }
    ]
  }
]
```

## POST /api/courses

```json
{
  "name": "ランチセット",
  "price": 1500,
  "drinkPlanId": 1,
  "foodItems": [
    { "menuItemId": 3, "qty": 1 },
    { "menuItemId": 7, "qty": 2 }
  ]
}
```

- `name`, `price`, `foodItems` は必須
- `drinkPlanId` は省略可（null で飲み放題なし。詳細は [Drink Plans](./drink-plans.md) を参照）

Response 201: 作成したコースオブジェクト

## PUT /api/courses/:id

Request body（全フィールド省略可）:

```json
{
  "name": "ディナーセット",
  "price": 2500,
  "drinkPlanId": null,
  "foodItems": [{ "menuItemId": 5, "qty": 1 }]
}
```

- `foodItems` を指定すると全件置き換え

## DELETE /api/courses/:id

Response 204: No Content
Response 404: `courses.detail.not_found`
Response 409: `courses.delete.in_use` — `active` または `bill_requested` のグループが使用中の場合
