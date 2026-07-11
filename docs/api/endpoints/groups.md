---
type: API Endpoint Group
id: E003
title: Groups
description: 来店グループ（テーブル割当て・状態遷移）の作成・更新・コース適用を扱う API。
resource: backend/src/routes/groups.ts
tags: [groups, api]
---

# Groups

テーブルやグループ（来店グループ）に関する操作。フロント実装者・バックエンド実装者向け。

- Base: `/api/groups`
- Auth: JWT cookie

## エンドポイント

- `GET /api/groups` — グループ一覧（`sessionId` / `status` でフィルタ可）
- `GET /api/groups/:id` — グループ詳細
- `POST /api/groups` — グループ作成
- `PUT /api/groups/:id` — グループ更新（席割当て、状態変更）
- `POST /api/groups/:id/course` — コース（＋飲み放題）を適用
- `PUT /api/groups/:id/course` — 適用中コースの人数（qty）を変更
- `DELETE /api/groups/:id/course` — コース適用を解除

グループのキャンセル・削除エンドポイントは存在しない。会計不要のグループは通常フローに乗せずホール側で無視するか、`status` を進めずに運用する。

## GET /api/groups

Query: `sessionId`（number）, `status`（`active` / `bill_requested` / `closed`。カンマ区切りまたは `?status=a&status=b` の配列で複数指定可）

Response 200: group object の配列（下記 group object 参照）
Response 400: `groups.list.invalid_status` — status に無効な値が含まれる場合

## POST /api/groups

```json
{
  "guestCount": 2,
  "seatIds": [1, 2],
  "name": "A1テーブル"
}
```

- `seatIds`: integer 配列（1件以上）
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
  "effectiveTaxRateInHouse": 10,
  "effectiveTaxRateTakeout": 8,
  "effectiveTaxInclusive": false,
  "createdAt": "2024-06-01T10:00:00.000Z"
}
```

- `id` は UUID string
- `effectiveTaxRateInHouse` / `effectiveTaxRateTakeout` / `effectiveTaxInclusive`: このグループに適用される税率・税込モード。`closed` になる前は店舗設定（`Setting`）の現在値、`closed` 確定後はその時点でスナップショットされた値（`billedTaxRateInHouse` 等）を返す。詳細は [Sessions](./sessions.md) のレポート仕様を参照

Response 409: `groups.save.no_open_session` — 営業中のセッションがない場合
Response 409: `groups.save.seat_conflict` — seatIds が他の `active` / `bill_requested` グループと競合する場合
Response 422: `groups.save.invalid_seats` — 存在しない席が含まれる場合

グループ作成時に seatIds の競合が検出される。席占有はサーバ側での排他制御を要求する。

## PUT /api/groups/:id

- `:id` は UUID string

```json
{
  "status": "bill_requested",
  "guestCount": 3,
  "seatIds": [1, 2, 3]
}
```

- `status` / `name` / `guestCount` / `seatIds` はすべて省略可。ただし `bill_requested` / `closed` のグループは `status` 以外のフィールドを同時に更新できない（下記参照）
- コースと飲み放題プランの割当ては本エンドポイントではなく `POST /api/groups/:id/course` で行う（`courseId` / `drinkPlanId` はこの body では受け付けない）

Response 200: group object（POST と同形式）

Response 404: `groups.detail.not_found`

Response 409 — 営業セッションが closed の場合:

```json
{
  "error": {
    "code": "groups.save.no_open_session",
    "message": "営業中のセッションがありません",
    "details": null
  }
}
```

Response 409 — 無効な状態遷移の場合:

```json
{
  "error": {
    "code": "groups.update.invalid_transition",
    "message": "active から closed への遷移は許可されていません",
    "details": { "from": "active", "to": "closed" }
  }
}
```

Response 409 — `bill_requested` / `closed` のグループに `status` 以外のフィールドを変更しようとした場合:

```json
{
  "error": {
    "code": "groups.update.closed_or_bill_requested",
    "message": "会計済み・会計待ちのグループは変更できません",
    "details": null
  }
}
```

Response 409: `groups.save.seat_conflict` — seatIds が他グループと競合する場合
Response 422: `groups.save.invalid_seats` — 存在しない席が含まれる場合

有効な状態遷移:

| from | to |
|------|-----|
| `active` | `bill_requested` |
| `bill_requested` | `active` |
| `bill_requested` | `closed` |
| `closed` | （遷移不可） |

`status` を `closed` に遷移させると、その時点の店舗設定（税率・税込モード）がグループにスナップショットされ（`billedTaxRateInHouse` / `billedTaxRateTakeout` / `billedTaxInclusive`）、以後の税率変更の影響を受けなくなる。更新で状態遷移が正しく反映される。closed セッション中はグループ更新を拒否する。無効な状態遷移（`active` → `closed` 等）は 409 を返す。

## POST /api/groups/:id/course

コース（および紐づく飲み放題プランがあればそれも含めて）をグループへ適用する。すでにコースが適用中の場合、旧コースの明細を取り消してから新コースを適用する（二重課金防止）。

```json
{
  "courseId": 1,
  "qty": 2
}
```

- `courseId`: 適用するコース ID
- `qty`: コース人数（1〜99）

Response 200: group object

Response 404: `groups.detail.not_found`
Response 404: `groups.course.not_found` — コースが存在しない場合
Response 409: `groups.course.not_applicable` — グループが `active` でない場合
Response 409: `groups.course.sold_out` — コース内に品切れの商品が含まれる場合
Response 409: `groups.course.conflict` — Serializable 分離レベルでの書き込み競合を検知した場合。もう一度リクエストすると解決する
Response 500: `groups.course.setting_not_found` — 店舗設定が見つからない場合

## PUT /api/groups/:id/course

適用中コースの人数（qty）を変更する。コース料金明細と、コース適用時に自動生成された食事明細の数量を人数に応じて再計算する。

```json
{
  "qty": 3
}
```

Response 200: 更新されたコース料金明細（order item）。コース料金が0円（無料コース）の場合は Response 204: No Content
Response 404: `groups.detail.not_found`
Response 409: `groups.course_qty.not_editable` — グループが `active` でない場合
Response 409: `groups.course.not_applied` — コースが適用されていない場合
Response 409: `groups.course.conflict` — Serializable 分離レベルでの書き込み競合を検知した場合。もう一度リクエストすると解決する

## DELETE /api/groups/:id/course

コース適用を解除する。飲み放題対象商品の価格を元に戻し、コース・飲み放題の定額課金明細を取消済みにする。

Response 200: group object（`courseId` / `drinkPlanId` が `null` に戻る）
Response 404: `groups.detail.not_found`
Response 409: `groups.course.remove_not_allowed` — グループが `active` でない場合（`bill_requested` / `closed` では解除不可）
Response 409: `groups.course.conflict` — Serializable 分離レベルでの書き込み競合を検知した場合。もう一度リクエストすると解決する
