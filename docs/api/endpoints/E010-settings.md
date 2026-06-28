# E010 — Settings

## Purpose

アプリケーション設定（店舗情報、税率、営業時間）に関する API。

## Audience

管理 UI 実装者、バックエンド実装者

## ID / Paths / Auth

- ID: E010
- Base: `/api/settings`
- Auth: JWT cookie（GET は全員、PUT は admin 限定）

## Summary

- GET `/api/settings` — 設定取得（全員）
- PUT `/api/settings` — 設定更新（admin のみ）

## Request / Response (例)

### GET /api/settings

レスポンス:

```json
{
  "storeName": "居酒屋",
  "closingTime": "23:00",
  "taxRateInHouse": 10.5,
  "taxRateTakeout": 8
}
```

- `closingTime`: `"HH:MM"` 形式
- `taxRateInHouse` / `taxRateTakeout`: 数値（%、小数点以下2桁まで対応）

### PUT /api/settings

リクエストボディ（全フィールド省略可）:

```json
{
  "storeName": "居酒屋 新宿店",
  "closingTime": "00:00",
  "taxRateInHouse": 10,
  "taxRateTakeout": 8
}
```

- 指定したフィールドのみ更新（upsert）
- 更新後に `settings:updated` Socket イベントを全クライアントに emit

レスポンス: 更新後の設定オブジェクト（GET と同形式）

## Acceptance Criteria

- 設定更新は admin ロールでのみ可能

## Notes

設定レコードは id=1 の単一行のみ管理。レコードが存在しない場合はデフォルト値を返す。
