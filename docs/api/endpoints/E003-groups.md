# E003 — Groups

## Purpose

テーブルやグループ（来店グループ）に関する操作。

## Audience

フロント実装者、バックエンド実装者

## ID / Paths / Auth

- ID: E003
- Base: `/api/groups`
- Auth: bearer

## Summary

- GET `/api/groups/:id` — グループ詳細
- POST `/api/groups` — グループ作成
- PUT `/api/groups/:id` — グループ更新（席割当て、状態変更）
- DELETE `/api/groups/:id` — グループ削除（キャンセル）

## Request / Response (例)

POST /api/groups

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

PUT /api/groups/:id

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

Response 200: group object（上記と同形式）

Response 409 — 営業セッションが closed の場合:

```json
{ "error": "営業中のセッションがありません" }
```

Response 409 — 無効な状態遷移の場合:

```json
{ "error": "active から closed への遷移は許可されていません" }
```

有効な状態遷移:

| from | to |
|------|-----|
| `active` | `bill_requested` |
| `bill_requested` | `active` |
| `bill_requested` | `closed` |
| `closed` | （遷移不可） |

## Acceptance Criteria

- グループ作成時に seatIds の競合が検出される
- 更新で状態遷移が正しく反映される
- closed セッション中はグループ更新を拒否する
- 無効な状態遷移（`active` → `closed` 等）は 409 を返す

## Notes

席占有はサーバ側での排他制御を要求する。
