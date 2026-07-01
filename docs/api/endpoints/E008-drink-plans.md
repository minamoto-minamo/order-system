# E008 — Drink Plans

## Purpose

ドリンクプラン／飲み放題等に関する API。

## Audience

フロント実装者、バックエンド実装者

## ID / Paths / Auth

- ID: E008
- Base: `/api/drink-plans`
- Auth: JWT cookie（管理操作は admin 限定）

## Summary

- GET `/api/drink-plans` — プラン一覧（全員）
- POST `/api/drink-plans` — プラン作成（admin のみ）
- PUT `/api/drink-plans/:id` — プラン更新（admin のみ）
- DELETE `/api/drink-plans/:id` — プラン削除（admin のみ）

## Request / Response (例)

### GET /api/drink-plans

レスポンス:

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

### POST /api/drink-plans

リクエストボディ:

```json
{
  "name": "飲み放題プラン",
  "menuItemIds": [10, 11, 12]
}
```

- `name`, `menuItemIds` は必須

レスポンス: 201 Created、作成したプランオブジェクト

### PUT /api/drink-plans/:id

リクエストボディ（全フィールド省略可）:

```json
{
  "name": "プレミアム飲み放題",
  "menuItemIds": [10, 11, 12, 13]
}
```

- `menuItemIds` を指定すると全件置き換え

### DELETE /api/drink-plans/:id

Response 204: No Content  
Response 404: `{ "error": "飲み放題プランが見つかりません" }`  
Response 409: `{ "error": "コースから参照されているため削除できません" }` — いずれかのコースがこのプランを参照している場合  
Response 409: `{ "error": "使用中の飲み放題プランは削除できません" }` — `active` または `bill_requested` のグループが使用中の場合

## Acceptance Criteria

- プランに含まれるメニューアイテムが明確に管理されていること

## Notes

価格計算や割引ルールは別途仕様に記載すること。
