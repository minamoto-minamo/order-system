# E007 — Courses

## Purpose

コース・セットメニューに関する API。

## Audience

フロント実装者、バックエンド実装者

## ID / Paths / Auth

- ID: E007
- Base: `/api/courses`
- Auth: JWT cookie（管理操作は admin 限定）

## Summary

- GET `/api/courses` — コース一覧（全員）
- POST `/api/courses` — コース作成（admin のみ）
- PUT `/api/courses/:id` — コース更新（admin のみ）
- DELETE `/api/courses/:id` — コース削除（admin のみ）

## Request / Response (例)

### GET /api/courses

レスポンス:

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

### POST /api/courses

リクエストボディ:

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
- `drinkPlanId` は省略可（null で飲み放題なし）

レスポンス: 201 Created、作成したコースオブジェクト

### PUT /api/courses/:id

リクエストボディ（全フィールド省略可）:

```json
{
  "name": "ディナーセット",
  "price": 2500,
  "drinkPlanId": null,
  "foodItems": [{ "menuItemId": 5, "qty": 1 }]
}
```

- `foodItems` を指定すると全件置き換え

### DELETE /api/courses/:id

Response 204: No Content  
Response 404: `{ "error": "コースが見つかりません" }`  
Response 409: `{ "error": "使用中のコースは削除できません" }` — `active` または `bill_requested` のグループが使用中の場合

## Acceptance Criteria

- コース注文時に展開されるアイテムが明確であること

## Notes

Course と MenuItem の参照整合性を確認すること。
