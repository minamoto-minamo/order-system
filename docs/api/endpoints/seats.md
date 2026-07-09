---
type: API Endpoint Group
id: E005
title: Seats
description: 席（Seat）の参照・管理 API。占有情報はクライアント側でグループから算出する。
resource: backend/src/routes/seats.ts
tags: [seats, api]
---

# Seats

席（Seat）に関する参照・管理 API。占有情報はクライアント側でグループから算出する。フロント実装者・バックエンド実装者向け。テーブル枠（SeatTable）は個別 CRUD エンドポイントを持たず、[Seat Layout](./seat-layout.md) の一括取得・保存 API でのみ管理する。

- Base: `/api/seats`
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
- GET /api/seats/:id, PUT /api/seats/:id, DELETE /api/seats/:id は対象 id が存在しない場合 404（`seats.detail.not_found`）

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
Response 422: `seats.save.table_not_found`（`tableId` に該当するテーブル枠が存在しない場合）
Socket emit: `seat:created`（Seat 全体）

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
Response 422: `seats.save.table_not_found`（`tableId` に該当するテーブル枠が存在しない場合）
Socket emit: `seat:updated`（Seat 全体）

### DELETE /api/seats/:id — 席削除

Response 204: No Content
Response 409: `seats.delete.in_use`（active/bill_requested グループが使用中）
