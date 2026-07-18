---
type: API Endpoint Group
id: E002
title: Sessions
description: 営業セッション（営業開始・終了・現在セッション取得）を扱う API。
resource: backend/src/routes/sessions.ts
tags: [sessions, api]
---

# Sessions

営業セッション（営業開始 / 終了 / 現在セッション取得）に関する API。フロント実装者・バックエンド実装者向け。

- Base: `/api/sessions`
- Auth: 要認証（全エンドポイント）。POST / PUT / `GET /:id/report` は admin 限定

## エンドポイント

- `GET /api/sessions` — セッション一覧（`?status=open|closed`）
- `GET /api/sessions/current` — 現在の営業セッション（open のもの、なければ null）
- `POST /api/sessions` — 新しいセッション開始（admin）
- `PUT /api/sessions/:id` — セッション更新（status 変更、admin）
- `GET /api/sessions/:id/report` — セッションの日次レポート取得（詳細は [Reports](./reports.md) を参照）

## GET /api/sessions

Response 200:

```json
[
  {
    "id": 1,
    "status": "open",
    "openedAt": "2026-06-21T09:00:00.000Z",
    "closedAt": null
  }
]
```

## GET /api/sessions/current

現在の open セッションが存在すれば常にそれを返す。

Response 200 — open セッションが存在する場合:

```json
{
  "id": 1,
  "status": "open",
  "openedAt": "2026-06-21T09:00:00.000Z",
  "closedAt": null
}
```

Response 200 — open セッションが存在しない場合: `null`

## POST /api/sessions（admin）

Request: ボディなし

Response 201:

```json
{
  "id": 2,
  "status": "open",
  "openedAt": "2026-06-22T10:00:00.000Z",
  "closedAt": null
}
```

Response 409 — 既に open なセッションがある場合:

```json
{
  "error": {
    "code": "sessions.create.already_open",
    "message": "既に営業中のセッションがあります",
    "details": null
  }
}
```

Socket emit: `session:updated`（作成した Session オブジェクト）。既存 open セッションチェックはトランザクション内で行うため、同時リクエストによる二重作成を防止する。

## PUT /api/sessions/:id（admin）

`status` に `"closed"` を指定してセッションを締める他、締めたセッションを `"open"` に戻す（再開）用途でも使う。

Request（締める）:

```json
{ "status": "closed" }
```

Request（再開）:

```json
{ "status": "open" }
```

Response 200: 更新後の Session オブジェクト

Response 409 — `closed` への遷移でアクティブなグループが残っている場合:

```json
{
  "error": {
    "code": "sessions.close.active_groups_exist",
    "message": "active_groups_exist",
    "details": { "count": 3 }
  }
}
```

Response 409 — `open` への遷移で他に open なセッションが既にある場合:

```json
{
  "error": {
    "code": "sessions.create.already_open",
    "message": "既に営業中のセッションがあります",
    "details": null
  }
}
```

Response 404:

```json
{
  "error": {
    "code": "sessions.detail.not_found",
    "message": "セッションが見つかりません",
    "details": null
  }
}
```

Socket emit: `session:updated`（更新後の Session オブジェクト）。グループ数チェックとセッション更新はトランザクション内で行う。

POST でセッションを開始でき、PUT で締める・再開できる。既に open なセッションがある場合は 409 を返す。同時リクエストでも二重開始しない。クライアント側はローカルキャッシュを持たず都度 GET で取得してよい。
