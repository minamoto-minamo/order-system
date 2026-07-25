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
| GET | `/api/menus` | staff+ | メニュー一覧（sort 昇順） |
| GET | `/api/menus/:id` | staff+ | メニュー詳細 |
| POST | `/api/menus` | admin | メニュー作成 |
| PUT | `/api/menus/:id` | admin | メニュー更新 |
| PATCH | `/api/menus/sort` | admin | メニュー並び替え |
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
  "takeout": "dine_in",
  "sort": 0,
  "optionGroups": [
    {
      "id": 1,
      "name": "辛さ",
      "required": false,
      "sort": 0,
      "choices": [{ "id": 1, "name": "ピリ辛", "extraPrice": 0, "sort": 0 }]
    }
  ],
  "isSet": false,
  "setFrames": []
}
```

- `takeout`: `"dine_in"` | `"both"` | `"takeout"`
- `optionGroups`: 商品オプション（分類・選択肢）。分類ごとに択一選択、`required: true` は注文時必須。`extraPrice` は正・0・負のいずれも可
- `isSet`: セットメニュー（親商品）かどうか
- `setFrames`: `isSet: true` の場合のみ意味を持つ、内訳の枠と選択肢。`choices[].name`/`price`/`soldOut` は参照先商品の**現在値**（スナップショットではなく都度JOIN）

```json
{
  "setFrames": [
    {
      "id": 1,
      "name": "ラーメン",
      "sort": 0,
      "choices": [
        { "id": 1, "menuItemId": 10, "name": "味噌ラーメン", "price": 800, "soldOut": false, "sort": 0 }
      ]
    }
  ]
}
```

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
  "takeout": "dine_in",
  "optionGroups": [
    { "name": "辛さ", "required": false, "sort": 0, "choices": [{ "name": "ピリ辛", "extraPrice": 0, "sort": 0 }] }
  ],
  "isSet": false,
  "setFrames": [
    { "name": "ラーメン", "sort": 0, "choices": [{ "menuItemId": 10, "sort": 0 }] }
  ]
}
```

- `optionGroups`/`setFrames` はいずれも省略可。両方同時に指定・保存することはできない（`isSet: true` かつ `optionGroups` が空でない場合はエラー）
- `setFrames[].choices[].menuItemId` は同一店舗の実在する商品を指す必要がある

Response 201: 作成した MenuItem オブジェクト
Response 422: `menus.save.subcategory_not_found` — `subCategoryId` が存在しない場合
Response 422: `menus.save.subcategory_mismatch` — `subCategoryId` の親カテゴリが `categoryId` と異なる場合
Response 422: `menus.save.set_with_options_not_allowed` — `isSet: true` かつ `optionGroups` が空でない場合
Response 422: `menus.save.set_frame_choice_menu_item_not_found` — `setFrames[].choices[].menuItemId` が同一店舗に存在しない場合
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

- `optionGroups`/`setFrames` を指定した場合、それぞれ既存の分類・選択肢／枠・選択肢を**全置換**する（差分更新ではなく `deleteMany` + `create`）
- `isSet` を `true` → `false` に変更して保存すると、既存の `setFrames` は削除される（フロントエンドは `isSet: false` の保存時に常に `setFrames: []` を送る）

Response 200: 更新後の MenuItem オブジェクト
Response 404: `menus.detail.not_found`
Response 422: `menus.save.subcategory_not_found` — `subCategoryId` が存在しない場合
Response 422: `menus.save.subcategory_mismatch` — `subCategoryId` の親カテゴリが `categoryId`（または既存の categoryId）と異なる場合
Response 422: `menus.save.set_with_options_not_allowed` — `isSet: true` かつ `optionGroups` が空でない場合（`isSet` 省略時は既存値を使う）
Response 422: `menus.save.set_frame_choice_menu_item_not_found` — `setFrames[].choices[].menuItemId` が同一店舗に存在しない、もしくは編集中の商品自身／他のセット商品を指す場合
Socket emit: `menu:soldout`（`soldOut` が変化した場合のみ、`(menuItemId, soldOut)` の2引数）
Socket emit: `menu:updated`（常に、更新後の MenuItem オブジェクト）

### PATCH /api/menus/sort — メニュー並び替え

Request body:

```json
{ "ids": [3, 1, 2] }
```

- `ids` の配列順（0始まりのインデックス）を `sort` として一括反映する
- 呼び出し元の店舗に属さない ID は無視する（エラーにはならない）

Response 204: No Content
Socket emit: `menu:updated`（並び替え対象の各 MenuItem オブジェクトについて1件ずつ）

### DELETE /api/menus/:id — メニュー削除

Response 204: No Content
Response 404: `menus.detail.not_found`
Response 409: `menus.delete.active_order_exists` — `pending` または `ready` の注文が存在する場合。`served`/`cancelled` のみなら削除可能。削除後、過去の `OrderItem` は `menuItemId: null`（`menuItemName`・`price` は保持）になる。
Response 409: `menus.delete.referenced_course` — コース（`CourseFoodItem`）に含まれている場合
Response 409: `menus.delete.referenced_drink_plan` — 飲み放題プラン（`DrinkPlanItem`）に含まれている場合
Response 409: `menus.delete.referenced_by_plan_or_course` — 上記チェックと書き込みが競合した場合の最終防衛線（FK制約違反時のフォールバック）
Socket emit: `menu:deleted`（削除した `menuItemId: number`）

- コース・飲み放題プランと異なり、他のセット（`SetFrameChoice`）の選択肢として登録されている商品の削除はブロックしない。削除すると当該 `SetFrameChoice` も自動的に削除される（`onDelete: Cascade`）。過去の注文明細（`OrderItem`）は `menuItemName`/`originalPrice` のスナップショットを保持するため表示は変化しない

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
Response 422: `subcategories.save.category_not_found` — `categoryId` が存在しない場合

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
Response 422: `subcategories.save.category_not_found` — `categoryId` を変更する場合に、その ID が存在しないとき

### DELETE /api/subcategories/:id — サブカテゴリ削除

Response 204: No Content
Response 404: `subcategories.detail.not_found`
Response 409: `subcategories.delete.in_use`
