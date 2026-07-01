# E009 — Staff

## Purpose

スタッフ管理（ログインユーザ、権限、プロフィール）に関する API。

## Audience

管理 UI 実装者、バックエンド実装者

## ID / Paths / Auth

- ID: E009
- Base: `/api/staff`
- Auth: JWT cookie（admin 限定）

## Summary

- GET `/api/staff` — スタッフ一覧（admin のみ）
- POST `/api/staff` — スタッフ作成（admin のみ）
- PUT `/api/staff/:id` — 更新（admin のみ）
- DELETE `/api/staff/:id` — 削除（admin のみ）

## Request / Response (例)

### GET /api/staff

レスポンス:

```json
[
  {
    "id": "018f1234-5678-7abc-def0-123456789abc",
    "username": "admin",
    "role": "admin",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

- `id` は UUID string

### POST /api/staff

リクエストボディ:

```json
{
  "username": "hanako",
  "password": "secret123",
  "role": "staff"
}
```

- `username`, `password`, `role` は全て必須
- `role` は `"admin"` または `"staff"` のみ
- `password`: 8文字以上、100文字以下
- `username` が重複する場合は 409

レスポンス: 201 Created

```json
{
  "id": "018f5678-abcd-7abc-def0-000000000001",
  "username": "hanako",
  "role": "staff",
  "createdAt": "2024-06-01T10:00:00.000Z"
}
```

### PUT /api/staff/:id

- `:id` は UUID string

リクエストボディ（全フィールド省略可）:

```json
{
  "username": "hanako2",
  "password": "newpassword",
  "role": "admin"
}
```

- `username` 変更時に重複する場合は 409
- `password` を省略すると変更しない

### DELETE /api/staff/:id

- `:id` は UUID string
- 204 No Content
- 自分自身を削除しようとした場合は 422

## Acceptance Criteria

- 管理者権限で操作可能
- パスワードや認証情報の取り扱いはセキュアであること（passwordHash はレスポンスに含まない）

## Notes

役割(role) は `"admin"` と `"staff"` の2種類。
