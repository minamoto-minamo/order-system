---
type: API Endpoint Group
id: E010
title: Settings
description: アプリケーション設定（店舗情報・税率・営業時間・リフレッシュトークン方式）の取得・更新 API。
resource: backend/src/routes/settings.ts
tags: [settings, api]
---

# Settings

アプリケーション設定（店舗情報、税率、営業時間）に関する API。管理 UI 実装者・バックエンド実装者向け。設定更新は admin ロールでのみ可能。

- Base: `/api/settings`
- Auth: JWT cookie（GET は全員、PUT は admin 限定）

設定レコードは店舗（`storeId`、`@unique`）ごとに1行管理。GET/PUT とも Host から解決された `request.storeId` にスコープされ、他店舗の設定には一切影響しない。レコードが存在しない場合はデフォルト値を返す。マルチテナントの詳細は [Platform](./platform.md) を参照。

## エンドポイント

- `GET /api/settings` — 設定取得（全員）
- `PUT /api/settings` — 設定更新（admin のみ）

## GET /api/settings

```json
{
  "storeName": "居酒屋",
  "closingTime": "23:00",
  "taxRateInHouse": 10.5,
  "taxRateTakeout": 8,
  "refreshTokenAutoExtend": true,
  "refreshTokenExpiresMinutes": 1440
}
```

- `closingTime`: `"HH:MM"` 形式
- `taxRateInHouse` / `taxRateTakeout`: 数値（%、小数点以下2桁まで対応）
- `refreshTokenAutoExtend`: リフレッシュトークンの有効期限方式。`true` = 自動延長（ローテーションのたびに now 起点で延長）、`false` = 固定期限（最初のログイン時刻起点で固定）
- `refreshTokenExpiresMinutes`: リフレッシュトークンの有効期限（分）。5〜43200（30日）

## PUT /api/settings

Request body（全フィールド省略可）:

```json
{
  "storeName": "居酒屋 新宿店",
  "closingTime": "00:00",
  "taxRateInHouse": 10,
  "taxRateTakeout": 8,
  "refreshTokenAutoExtend": false,
  "refreshTokenExpiresMinutes": 60
}
```

- 指定したフィールドのみ更新（upsert）
- 更新後に `settings:updated` Socket イベントを全クライアントに emit

Response: 更新後の設定オブジェクト（GET と同形式）

アクセストークンの有効期限（`ACCESS_TOKEN_EXPIRES_IN`）は env 固定でありこの設定の対象外（[Auth](./auth.md) を参照）。

## Tips: `refreshTokenAutoExtend` / `refreshTokenExpiresMinutes` 変更時の既存トークンの扱い

各リフレッシュトークンの `expiresAt` は、発行（ログイン・ローテーション）時点の設定値で計算され、その値がスナップショットとして DB に保存される。設定変更時に既存の発行済みトークンの `expiresAt` を遡って書き換えることはしない。

- 変更は次回ローテーション時（アクセストークン失効による透過リフレッシュ発生時）に新しい設定値で発行される子トークンから適用される
- 既存トークンをすぐに切り替えたい場合は、staff 管理画面から該当セッションを個別に強制ログアウトする（[Staff](./staff.md) を参照）
