---
type: API Endpoint Group
id: E008
title: Drink Plans
description: ドリンクプラン・飲み放題プランの参照・管理 API。
resource: backend/src/routes/drinkPlans.ts
tags: [drink-plans, api]
---

# Drink Plans

ドリンクプラン／飲み放題等に関する API。プランに含まれるメニューアイテムを明確に管理する。価格計算や割引ルールは別途仕様に記載すること。フロント実装者・バックエンド実装者向け。

- Base: `/api/drink-plans`
- Auth: JWT cookie（管理操作は admin 限定）

## エンドポイント

- `GET /api/drink-plans` — プラン一覧（全員）
- `POST /api/drink-plans` — プラン作成（admin のみ）
- `PUT /api/drink-plans/:id` — プラン更新（admin のみ）
- `DELETE /api/drink-plans/:id` — プラン削除（admin のみ）

## GET /api/drink-plans

```json
[
  {
    "id": 1,
    "name": "飲み放題プラン",
    "menuItemIds": [10, 11, 12]
  }
]
```

- `menuItemIds`: このプランで注文可能なメニューアイテムの ID 一覧

## POST /api/drink-plans

```json
{
  "name": "飲み放題プラン",
  "menuItemIds": [10, 11, 12]
}
```

- `name`, `menuItemIds` は必須

Response 201: 作成したプランオブジェクト

## PUT /api/drink-plans/:id

Request body（全フィールド省略可）:

```json
{
  "name": "プレミアム飲み放題",
  "menuItemIds": [10, 11, 12, 13]
}
```

- `menuItemIds` を指定すると全件置き換え

## DELETE /api/drink-plans/:id

Response 204: No Content
Response 404: `{ "error": "飲み放題プランが見つかりません" }`
Response 409: `{ "error": "コースから参照されているため削除できません" }` — いずれかのコース（[Courses](./courses.md) を参照）がこのプランを参照している場合
Response 409: `{ "error": "使用中の飲み放題プランは削除できません" }` — `active` または `bill_requested` のグループが使用中の場合
