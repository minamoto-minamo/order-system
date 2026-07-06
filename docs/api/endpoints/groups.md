---
type: API Endpoint Group
id: E003
title: Groups
description: 来店グループ（テーブル割当て・状態遷移）の作成・更新・削除を扱う API。
resource: backend/src/routes/groups.ts
tags: [groups, api]
---

# Groups

テーブルやグループ（来店グループ）に関する操作。フロント実装者・バックエンド実装者向け。

- Base: `/api/groups`
- Auth: bearer

## エンドポイント

- `GET /api/groups/:id` — グループ詳細
- `POST /api/groups` — グループ作成
- `PUT /api/groups/:id` — グループ更新（席割当て、状態変更）
- `DELETE /api/groups/:id` — グループ削除（キャンセル）

## POST /api/groups

```json
{
  "guestCount": 2,
  "seatIds": [1, 2],
  "name": "A1テーブル"
}
```

- `seatIds`: integer 配列
- `name`: オプション（省略時はサーバーが席ラベルから生成）

Response 201: group object

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
  "createdAt": "2024-06-01T10:00:00.000Z"
}
```

- `id` は UUID string

グループ作成時に seatIds の競合が検出される。席占有はサーバ側での排他制御を要求する。

## PUT /api/groups/:id

- `:id` は UUID string

```json
{
  "status": "bill_requested",
  "courseId": 1,
  "drinkPlanId": 2,
  "guestCount": 3,
  "seatIds": [1, 2, 3]
}
```

Response 200: group object（POST と同形式）

Response 409 — 営業セッションが closed の場合:

```json
{
  "error": {
    "code": "groups.save.no_open_session",
    "message": "営業中のセッションがありません",
    "details": null
  }
}
```

Response 409 — 無効な状態遷移の場合:

```json
{
  "error": {
    "code": "groups.update.invalid_transition",
    "message": "active から closed への遷移は許可されていません",
    "details": { "from": "active", "to": "closed" }
  }
}
```

有効な状態遷移:

| from | to |
|------|-----|
| `active` | `bill_requested` |
| `bill_requested` | `active` |
| `bill_requested` | `closed` |
| `closed` | （遷移不可） |

更新で状態遷移が正しく反映される。closed セッション中はグループ更新を拒否する。無効な状態遷移（`active` → `closed` 等）は 409 を返す。
