---
type: API Endpoint Group
id: E005
title: Seats / SeatTables
description: 席（Seat）とテーブル枠（SeatTable）の参照・管理 API。占有情報はクライアント側でグループから算出する。
resource: backend/src/routes/seats.ts
tags: [seats, api]
---

# Seats / SeatTables

席（Seat）とテーブル枠（SeatTable）に関する参照・管理 API。占有情報はクライアント側でグループから算出する。フロント実装者・バックエンド実装者向け。関連: [SeatTables 一括レイアウトは Seat Layout](./seat-layout.md) を参照。

- Base: `/api/seats`, `/api/seat-tables`
- Auth: JWT cookie（全エンドポイント要認証。POST/PUT/DELETE は admin 限定）

## Seats

| Method | Path | Auth | 説明 |
|---|---|---|---|
| GET | `/api/seats` | staff+ | 席一覧 |
| GET | `/api/seats/:id` | staff+ | 席詳細 |
| POST | `/api/seats` | admin | 席作成 |
| PUT | `/api/seats/:id` | admin | 席更新 |
| DELETE | `/api/seats/:id` | admin | 席削除 |

### Response Schema（Seat）

```json
{
  "id": 1,
  "label": "A1",
  "type": "table",
  "x": 0,
  "y": 0,
  "tableId": 1
}
```

- `type`: `"counter"` | `"table"`
- `tableId`: 所属するテーブル枠の ID（null の場合あり）

### POST /api/seats — 席作成

Request body（`label`, `type`, `x`, `y` は必須）:

```json
{
  "label": "A1",
  "type": "table",
  "x": 0,
  "y": 0,
  "tableId": 1
}
```

Response 201: 作成した Seat オブジェクト

### PUT /api/seats/:id — 席更新

Request body（全フィールド省略可）:

```json
{
  "label": "A2",
  "type": "counter",
  "x": 1,
  "y": 0,
  "tableId": null
}
```

Response 200: 更新後の Seat オブジェクト
Socket emit: `seat:updated`（Seat 全体）

### DELETE /api/seats/:id — 席削除

Response 204: No Content
Response 409: `{ "error": "使用中の席は削除できません" }`（active/bill_requested グループが使用中）

## SeatTables

テーブル枠（席をグルーピングする矩形領域）の管理。

| Method | Path | Auth | 説明 |
|---|---|---|---|
| GET | `/api/seat-tables` | staff+ | テーブル枠一覧 |
| POST | `/api/seat-tables` | admin | テーブル枠作成 |
| PUT | `/api/seat-tables/:id` | admin | テーブル枠更新 |
| DELETE | `/api/seat-tables/:id` | admin | テーブル枠削除 |

### Response Schema（SeatTable）

```json
{
  "id": 1,
  "label": "テーブルA",
  "x": 0,
  "y": 0,
  "w": 2,
  "h": 2
}
```

### POST /api/seat-tables — テーブル枠作成

Request body（全フィールド必須）:

```json
{
  "label": "テーブルA",
  "x": 0,
  "y": 0,
  "w": 2,
  "h": 2
}
```

Response 201: 作成した SeatTable オブジェクト

### PUT /api/seat-tables/:id — テーブル枠更新

Request body（全フィールド省略可）:

```json
{
  "label": "テーブルB",
  "w": 3
}
```

Response 200: 更新後の SeatTable オブジェクト
Response 404: `{ "error": "テーブルが見つかりません" }`

### DELETE /api/seat-tables/:id — テーブル枠削除

Response 204: No Content
