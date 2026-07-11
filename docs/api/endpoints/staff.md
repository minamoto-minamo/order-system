---
type: API Endpoint Group
id: E009
title: Staff
description: スタッフ管理（ログインユーザ・権限・プロフィール）とログイン中デバイスの一覧・強制ログアウトを扱う admin 限定 API。
resource: backend/src/routes/staff.ts
tags: [staff, api, admin]
---

# Staff

スタッフ管理（ログインユーザ、権限、プロフィール）に関する API。役割（role）は `"admin"` と `"staff"` の2種類。管理 UI 実装者・バックエンド実装者向け。

- Base: `/api/staff`
- Auth: JWT cookie（admin 限定）

マルチテナント: 全操作は Host から解決された `request.storeId` にスコープされる。`username` は店舗ごとのユニーク（`@@unique([storeId, username])`）であり、別店舗であれば同じ username を重複登録できる。詳細は [Platform](./platform.md) を参照。

## エンドポイント

- `GET /api/staff` — スタッフ一覧（admin のみ）
- `POST /api/staff` — スタッフ作成（admin のみ）
- `PUT /api/staff/:id` — 更新（admin のみ）
- `DELETE /api/staff/:id` — 削除（admin のみ）
- `GET /api/staff/:id/sessions` — ログイン中デバイス（リフレッシュトークン）一覧（admin のみ）
- `DELETE /api/staff/:id/sessions/:sessionId` — 指定デバイスの強制ログアウト（admin のみ）

## GET /api/staff

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

## POST /api/staff

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

Response 201:

```json
{
  "id": "018f5678-abcd-7abc-def0-000000000001",
  "username": "hanako",
  "role": "staff",
  "createdAt": "2024-06-01T10:00:00.000Z"
}
```

## PUT /api/staff/:id

- `:id` は UUID string

Request body（全フィールド省略可）:

```json
{
  "username": "hanako2",
  "password": "newpassword",
  "role": "admin"
}
```

- `username` 変更時に重複する場合は 409
- `password` を省略すると変更しない
- `role` を変更した場合、対象スタッフに紐づく Socket.io 接続（room: `user:${id}`）を強制切断する（[Auth](./auth.md) のログアウト時と同じ仕組み）

## DELETE /api/staff/:id

- `:id` は UUID string
- 204 No Content
- 自分自身を削除しようとした場合は 422
- 削除に成功した場合、対象スタッフに紐づく Socket.io 接続（room: `user:${id}`）を強制切断する

## GET /api/staff/:id/sessions

- `:id` は UUID string。存在しない staff は 404
- 有効（未失効・未 revoke）なリフレッシュトークン、つまりログイン中デバイスの一覧を返す

```json
[
  {
    "id": "018f9abc-1234-7abc-def0-000000000002",
    "issuedAt": "2026-07-01T09:00:00.000Z",
    "expiresAt": "2026-07-02T09:00:00.000Z",
    "userAgent": "Mozilla/5.0 (...)",
    "ipAddress": "127.0.0.1"
  }
]
```

- `id` はリフレッシュトークンのレコード ID（トークン本体・ハッシュ値はレスポンスに含まない）

## DELETE /api/staff/:id/sessions/:sessionId

- `:id` は対象スタッフの UUID、`:sessionId` は GET で返る `id`
- 該当スタッフ・該当セッションが存在しない、または既に無効化済みの場合は 404
- 成功時 204 No Content
- 対象デバイスのみ無効化する（他デバイスのセッションには影響しない）

## セキュリティ要件

- 管理者権限で操作可能。
- パスワードや認証情報の取り扱いはセキュアであること（`passwordHash` はレスポンスに含まない）。
- セッション一覧・強制ログアウト API はリフレッシュトークンのハッシュ値・生値を一切レスポンスに含まない。

セッション管理（`/:id/sessions`）は [Auth](./auth.md) で導入したリフレッシュトークン機構のデバイス一覧・強制ログアウト用 API。詳細は [Auth](./auth.md) を参照。
