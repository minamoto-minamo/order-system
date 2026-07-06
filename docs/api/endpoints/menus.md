---
type: API Endpoint Group
id: E006
title: Menus / Categories / SubCategories
description: メニュー項目（MenuItem）・カテゴリ（Category）・サブカテゴリ（SubCategory）の参照・管理 API。
resource: backend/src/routes/menus.ts
tags: [menus, categories, api]
---

# Menus / Categories / SubCategories

メニュー項目（MenuItem）・カテゴリ（Category）・サブカテゴリ（SubCategory）に関する参照・管理 API。フロント実装者・バックエンド実装者向け。

- Base: `/api/menus`, `/api/categories`, `/api/subcategories`
- Auth: JWT cookie（全エンドポイント要認証。POST/PUT/DELETE は admin 限定）

## Menus

| Method | Path | Auth | 説明 |
|---|---|---|---|
| GET | `/api/menus` | staff+ | メニュー一覧 |
| GET | `/api/menus/:id` | staff+ | メニュー詳細 |
| POST | `/api/menus` | admin | メニュー作成 |
| PUT | `/api/menus/:id` | admin | メニュー更新 |
| DELETE | `/api/menus/:id` | admin | メニュー削除 |

### Response Schema（MenuItem）

```json
{
  "id": 1,
  "name": "パスタ",
  "price": 1200,
  "categoryId": 1,
  "subCategoryId": 2,
  "soldOut": false,
  "takeout": "dine_in"
}
```

- `takeout`: `"dine_in"` | `"both"` | `"takeout"`

### GET /api/menus — メニュー一覧

Query parameters（全て省略可）:

| パラメータ | 型 | 説明 |
|---|---|---|
| `categoryId` | integer | カテゴリでフィルタ |
| `subCategoryId` | integer | サブカテゴリでフィルタ |
| `takeout` | string | `dine_in` / `both` / `takeout` でフィルタ |
| `soldOut` | boolean | `true` で品切れのみ / `false` で販売中のみ |

Response 200: MenuItem の配列

### POST /api/menus — メニュー作成

Request body（`name`, `price`, `categoryId`, `subCategoryId` は必須）:

```json
{
  "name": "パスタ",
  "price": 1200,
  "categoryId": 1,
  "subCategoryId": 2,
  "soldOut": false,
  "takeout": "dine_in"
}
```

Response 201: 作成した MenuItem オブジェクト
Response 422: `menus.save.subcategory_mismatch` — `subCategoryId` の親カテゴリが `categoryId` と異なる場合
Socket emit: `menu:created`（作成した MenuItem オブジェクト）

### PUT /api/menus/:id — メニュー更新

Request body（全フィールド省略可）:

```json
{
  "name": "パスタ（改）",
  "price": 1300,
  "soldOut": true
}
```

Response 200: 更新後の MenuItem オブジェクト
Response 422: `menus.save.subcategory_mismatch` — `subCategoryId` の親カテゴリが `categoryId`（または既存の categoryId）と異なる場合
Socket emit: `menu:soldout`（`soldOut` が変化した場合のみ、`(menuItemId, soldOut)` の2引数）
Socket emit: `menu:updated`（常に、更新後の MenuItem オブジェクト）

### DELETE /api/menus/:id — メニュー削除

Response 204: No Content
Response 404: `menus.detail.not_found`
Response 409: `menus.delete.active_order_exists` — `pending` または `ready` の注文が存在する場合。`served`/`cancelled` のみなら削除可能。削除後、過去の `OrderItem` は `menuItemId: null`（`menuItemName`・`price`・`taxRate` は保持）になる。
Socket emit: `menu:deleted`（削除した `menuItemId: number`）

## Categories

| Method | Path | Auth | 説明 |
|---|---|---|---|
| GET | `/api/categories` | staff+ | カテゴリ一覧（sort 昇順） |
| POST | `/api/categories` | admin | カテゴリ作成 |
| PUT | `/api/categories/:id` | admin | カテゴリ更新 |
| DELETE | `/api/categories/:id` | admin | カテゴリ削除 |

### Response Schema（Category）

```json
{
  "id": 1,
  "name": "フード",
  "sort": 0
}
```

### POST /api/categories — カテゴリ作成

Request body（`name` は必須、`sort` 省略時は 0）:

```json
{
  "name": "フード",
  "sort": 0
}
```

Response 201: 作成した Category オブジェクト

### PUT /api/categories/:id — カテゴリ更新

Request body（全フィールド省略可）:

```json
{
  "name": "ドリンク",
  "sort": 1
}
```

Response 200: 更新後の Category オブジェクト
Response 404: `categories.detail.not_found`

### DELETE /api/categories/:id — カテゴリ削除

Response 204: No Content
Response 404: `categories.detail.not_found`
Response 409: `categories.delete.in_use`

## SubCategories

| Method | Path | Auth | 説明 |
|---|---|---|---|
| GET | `/api/subcategories` | staff+ | サブカテゴリ一覧（sort 昇順） |
| POST | `/api/subcategories` | admin | サブカテゴリ作成 |
| PUT | `/api/subcategories/:id` | admin | サブカテゴリ更新 |
| DELETE | `/api/subcategories/:id` | admin | サブカテゴリ削除 |

### GET /api/subcategories — サブカテゴリ一覧

Query parameters:

| パラメータ | 型 | 説明 |
|---|---|---|
| `categoryId` | integer | 親カテゴリでフィルタ（省略可） |

### Response Schema（SubCategory）

```json
{
  "id": 1,
  "name": "パスタ",
  "categoryId": 1,
  "sort": 0
}
```

### POST /api/subcategories — サブカテゴリ作成

Request body（`name`, `categoryId` は必須、`sort` 省略時は 0）:

```json
{
  "name": "パスタ",
  "categoryId": 1,
  "sort": 0
}
```

Response 201: 作成した SubCategory オブジェクト

### PUT /api/subcategories/:id — サブカテゴリ更新

Request body（全フィールド省略可）:

```json
{
  "name": "ピザ",
  "sort": 1
}
```

Response 200: 更新後の SubCategory オブジェクト
Response 404: `subcategories.detail.not_found`

### DELETE /api/subcategories/:id — サブカテゴリ削除

Response 204: No Content
Response 404: `subcategories.detail.not_found`
Response 409: `subcategories.delete.in_use`
