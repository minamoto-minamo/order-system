---
type: API Endpoint Group
id: E001
title: Auth
description: ログイン・ログアウト・ログインユーザー取得を担う認証用 REST API。アクセストークンとリフレッシュトークンの発行・ローテーションを扱う。
resource: backend/src/routes/auth.ts
tags: [auth, api]
---

# Auth

認証に関する REST API。ログイン、ログアウト、ログイン中ユーザーの取得を担う。フロント実装者・バックエンド実装者向け。

- Base: `/api/auth`
- Auth: none（login / logout）、httpOnly cookie（その他）

マルチテナント: リクエストの Host ヘッダー（サブドメイン）から解決された `storeId` にスコープされる。`username` は店舗ごとにユニークであり、グローバルではない。詳細は [Platform](./platform.md) を参照。

## エンドポイント

- `POST /api/auth/login` — ログイン（username/password）
- `POST /api/auth/logout` — ログアウト（このデバイスの refresh token を無効化し cookie をクリア）
- `GET /api/auth/me` — ログイン中のユーザー情報取得

## POST /api/auth/login

Request (application/json):

```json
{
  "username": "admin",
  "password": "secret"
}
```

Response 200 — アクセストークンを httpOnly cookie `token`、リフレッシュトークンを httpOnly cookie `refresh_token` にセットする:

```json
{
  "id": 1,
  "username": "admin",
  "role": "admin"
}
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

ログイン試行はレート制限あり（本番: 1分あたり5回、開発: 1000回）。超過時は 429 で `auth.login.rate_limited` を返す。

ログイン成功で 200 を返し、アクセストークン（`token`）とリフレッシュトークン（`refresh_token`）を httpOnly cookie にセットし、`{ id, username, role }` を返す。認証失敗では 401 を返す。

## GET /api/auth/me

Response 200:

```json
{
  "id": 1,
  "username": "admin",
  "role": "admin"
}
```

`token` cookie が失効していても `refresh_token` cookie が有効なら、サーバー側で透過的にアクセストークンをリフレッシュしたうえで応答する（フロントは意識不要）。この際、有効な refresh token があれば自動的にローテーションされ、新しいトークンが cookie にセットされる。認証済みユーザーの情報を返し、未認証・両トークン失効時は 401 を返す。

## POST /api/auth/logout

Response 200:

```json
{ "ok": true }
```

`refresh_token` cookie があればそのデバイスのリフレッシュトークンのみ無効化する（他デバイスのセッションには影響しない）。ログアウトでこのデバイスの refresh token を無効化し、両 cookie をクリアする。

加えて、同一ユーザーに紐づく Socket.io 接続（room: `user:${userId}`）を強制切断する。`token` cookie が失効していても、`refresh_token` からユーザーを特定できる場合は切断を実行する。

## トークンの取り扱い

- アクセストークン（`token`）は JWT。有効期限は環境変数 `ACCESS_TOKEN_EXPIRES_IN`（デフォルト `15m`）で固定。
- リフレッシュトークン（`refresh_token`）は DB 管理（`RefreshToken` テーブル）の使い捨てトークン。ローテーション（再利用のたびに新しいトークンへ差し替え）と再利用検知を行う。有効期限方式（自動延長/固定期限）と長さは `/api/settings` の `refreshTokenAutoExtend` / `refreshTokenExpiresMinutes` で管理者が変更可能（[Settings](./settings.md) を参照）。
- リフレッシュトークンが失効済みトークンとして再提示され、かつ再利用の疑いがある場合（猶予期間超過後の重複提示）は、当該スタッフの全デバイスのセッションを無効化する。
- 管理者はスタッフ管理画面から個別デバイスのセッションを強制ログアウトできる（[Staff](./staff.md) を参照）。この場合は対象デバイスのみ無効化され、他デバイスには影響しない。
- Bearer トークンは使用しない。両トークンとも httpOnly cookie でのみやり取りする。
