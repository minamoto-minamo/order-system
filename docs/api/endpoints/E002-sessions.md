# E002 — Sessions

## Purpose

営業セッション（営業開始 / 終了 / 現在セッション取得）に関する API

## Audience

フロント実装者、バックエンド実装者

## ID / Paths / Auth

- ID: E002
- Base: `/api/sessions`
- Auth: 要認証（全エンドポイント）、POST / PUT は admin 限定

## Summary

- GET `/api/sessions` — セッション一覧（`?status=open|closed`）
- GET `/api/sessions/current` — 現在の営業セッション（open のもの、なければ null）
- POST `/api/sessions` — 新しいセッション開始（admin）
- PUT `/api/sessions/:id` — セッション更新（status 変更、admin）
- GET `/api/sessions/:id/report` — セッションの日次レポート取得

## Request / Response (例)

GET /api/sessions

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

---

GET /api/sessions/current

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

---

POST /api/sessions（admin）

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
{ "error": "既に営業中のセッションがあります" }
```

Socket emit: `session:updated`（作成した Session オブジェクト）  
Note: 既存 open セッションチェックはトランザクション内で行うため、同時リクエストによる二重作成を防止する。

---

PUT /api/sessions/:id（admin）

Request:

```json
{ "status": "closed" }
```

Response 200: updated session object

Response 409 — `closed` への遷移でアクティブなグループが残っている場合:

```json
{ "error": "active_groups_exist", "count": 3 }
```

Response 404:

```json
{ "error": "セッションが見つかりません" }
```

Socket emit: `session:updated`（更新後の Session オブジェクト）  
Note: グループ数チェックとセッション更新はトランザクション内で行う。

## Acceptance Criteria

- GET /current が常に現在の open セッション（存在する場合）を返す
- POST でセッション開始可能、PUT で閉じられる
- 既に open なセッションがある場合は 409
- 同時リクエストで二重開始しない

## Notes

クライアント側はローカルキャッシュを持たず都度 GET で取得してよい。
