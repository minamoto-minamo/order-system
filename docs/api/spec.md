---
type: API Spec
title: API 全体仕様
description: REST API 全体の契約。バージョン・認証・エラー形式・共通規約を定める。
tags: [api, rest, contract, versioning]
---

本 API のバージョンは v1。すべてのエンドポイントは `/api` を基点とする。認証は Bearer token (JWT) による。

エラーは HTTP status と次の JSON body で返す。

```json
{ "error": { "code": "string", "message": "string", "details": null } }
```

`error.code` は HTTP status ではなく、発生箇所と原因を表す複合 ID とする。形式は原則 `domain.action.reason`。フロントエンドは通常 `message` を表示し、画面分岐やログ集計が必要な場合だけ `code` を参照する。追加情報がある場合は `details` に object として格納し、ない場合は `null` を返す。

例:

```json
{
  "error": {
    "code": "groups.save.seat_conflict",
    "message": "選択した席はすでに使用中です",
    "details": null
  }
}
```

```json
{
  "error": {
    "code": "sessions.close.active_groups_exist",
    "message": "active_groups_exist",
    "details": { "count": 3 }
  }
}
```

## 共通規約

時刻は ISO 8601 (UTC) で表す。リソース ID はプレフィックス付き（例: `g_1`, `m_1`）。ステータス変更を伴う操作は 200 または 204 を返し、body に最新リソースを含める。

ページネーションはクエリ `?page=1&perPage=50` で指定し、レスポンスに `meta: { total, page, perPage }` を含める。

## HTTP ステータス

- `400` — validation error
- `401` — unauthorized
- `403` — forbidden
- `404` — not found
- `409` — conflict
- `422` — semantic validation error
- `429` — rate limited
- `500` — internal server error

## バージョニング

破壊的変更は major version を増やす。新しいフィールドは後方互換性を保ちながら追加する。

## 関連

個々のエンドポイント仕様は [エンドポイント一覧](endpoints/index.md) を参照。状態同期の Socket.io イベントは [WebSocket イベント](websockets.md) を参照。
