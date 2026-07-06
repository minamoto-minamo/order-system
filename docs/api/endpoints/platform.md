---
type: API Endpoint Group
id: E013
title: Platform (マルチテナント管理)
description: プラットフォーム運営側が店舗（テナント）を作成・管理するための API。テナント向け API とは別軸の PlatformAdmin が使う。
resource: backend/src/routes/customer.ts
tags: [platform, multitenant, api, admin]
---

# Platform (マルチテナント管理)

プラットフォーム運営側が店舗（テナント）を作成・管理するための API。テナント向け API（`/api/*`）とは別軸の管理者（`PlatformAdmin`）が使う。プラットフォーム管理 UI 実装者・バックエンド実装者向け。

- Base: `/api/platform/auth`（認証）、`/api/platform/stores`（店舗管理）
- Auth: 専用 httpOnly cookie `platform_token`（テナント向け `token` cookie とは別物）。`/login` 以外は `PlatformAdmin` 認証必須

## サブドメインとルーティング

Host ヘッダーから店舗を解決する（`backend/src/lib/store.ts` の `resolveStoreContext`）:

| Host の種類 | 判定 | `/api/*` へのアクセス制限 |
| --- | --- | --- |
| `<subdomain>.<BASE_DOMAIN>`（登録済み・有効な店舗） | `kind: 'store'` | `/api/platform/*` は 404。それ以外はテナント API として `storeId` 付きで通過 |
| `admin.<BASE_DOMAIN>`（予約ラベル） | `kind: 'platform'` | `/api/platform/*` のみ許可。それ以外は 404 |
| `<BASE_DOMAIN>` 自身 | `kind: 'apex'` | `/api/health` のみ許可。それ以外は 404 |
| 未登録・無効化された店舗・解決不能なホスト | `kind: 'unknown'` | すべて 404 |

`admin` はどの店舗の `subdomain` としても予約済みで使用できない（`POST /api/platform/stores` で 422）。

テナントホスト（`kind: 'store'`）から `/api/platform/*` へのアクセスは 404。`admin` サブドメインホストからテナント API（`/api/settings` 等）へのアクセスも 404。プラットフォーム管理者以外は `/api/platform/*` にアクセスできない（401 または 404）。

## エンドポイント

- `POST /api/platform/auth/login` — プラットフォーム管理者ログイン
- `POST /api/platform/auth/logout` — ログアウト
- `GET /api/platform/auth/me` — ログイン中の管理者情報取得
- `GET /api/platform/stores` — 店舗一覧
- `GET /api/platform/stores/:id` — 店舗詳細
- `POST /api/platform/stores` — 店舗作成（店舗・初期設定・初期管理者スタッフを一括作成）
- `PUT /api/platform/stores/:id` — 店舗更新（`name` / `isActive` のみ）

## POST /api/platform/auth/login

Request:

```json
{ "username": "platform", "password": "secret" }
```

Response 200 — `platform_token` cookie（httpOnly, 有効期限 8 時間固定・リフレッシュなし）をセット:

```json
{ "id": "018f...", "username": "platform" }
```

Response 401:

```json
{
  "error": {
    "code": "auth.login.invalid_credentials",
    "message": "認証情報が正しくありません",
    "details": null
  }
}
```

ログイン試行はレート制限あり（本番: 1分あたり5回、開発: 1000回）。

## GET /api/platform/auth/me

Response 200:

```json
{ "id": "018f...", "username": "platform" }
```

未認証・cookie 失効時は 401。テナント向け `token` cookie のような透過リフレッシュは行わない（8時間で再ログインが必要）。

## POST /api/platform/auth/logout

Response 200: `{ "ok": true }`

## GET /api/platform/stores

Response 200:

```json
[
  {
    "id": 1,
    "subdomain": "store1",
    "name": "おいしい居酒屋 店1",
    "isActive": true,
    "createdAt": "2026-07-01T00:00:00.000Z"
  }
]
```

## POST /api/platform/stores

Request:

```json
{
  "subdomain": "store3",
  "name": "新規店舗",
  "adminUsername": "store3admin",
  "adminPassword": "store3admin1234"
}
```

- `subdomain`: 半角英数字・ハイフン（先頭・末尾は英数字）、1〜63文字。予約ラベル `admin` は使用不可（422）。既存店舗と重複する場合は 409
- `adminPassword`: 8文字以上、100文字以下
- 成功時、`Store` + 初期 `Setting`（デフォルト値）+ 初期管理者 `Staff`（role: admin）を単一トランザクションで作成する（一部失敗時は全体ロールバック）

Response 201:

```json
{
  "id": 3,
  "subdomain": "store3",
  "name": "新規店舗",
  "isActive": true,
  "createdAt": "2026-07-02T00:00:00.000Z"
}
```

作成直後から `adminUsername` / `adminPassword` で `https://store3.<BASE_DOMAIN>/api/auth/login`（[Auth](./auth.md) を参照）にログイン可能。

## PUT /api/platform/stores/:id

Request（全フィールド省略可）:

```json
{ "name": "新店舗名", "isActive": false }
```

`subdomain` は不変（このエンドポイントでは変更不可）。存在しない場合は 404。

## Notes

- テナント向け JWT（`token` cookie）とプラットフォーム管理者向け JWT（`platform_token` cookie）はペイロードの判別可能ユニオン型で区別される（`type: 'staff' | 'platform'`）。誤って相互に使い回すことはできない。
- テナント向けのようなリフレッシュトークン機構（[Auth](./auth.md) を参照）はプラットフォーム管理者には存在しない。固定 8 時間で失効し、以降は再ログインが必要。
- ローカル開発では `*.localhost` サブドメインを使う（例: `http://store1.localhost:5173`、`http://admin.localhost:5173`）。`BASE_DOMAIN` env（[env](../../ops/env.md) を参照）で基準ドメインを設定する。
