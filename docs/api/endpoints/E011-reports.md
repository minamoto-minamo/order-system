# E011 — Reports

## Purpose

セッション単位の売上レポート出力 API。

## Audience

管理 UI 実装者、バックエンド実装者、経営

## ID / Paths / Auth

- ID: E011
- Base: `/api/sessions/:id/report`
- Auth: login required（JWT cookie）

## Summary

- GET `/api/sessions/:id/report` — 指定セッションの売上集計を返す

## Request / Response (例)

GET /api/sessions/12/report

Response 200:

```json
{
  "total": 48200,
  "groups": 9,
  "guests": 27,
  "seatUsageRate": 75,
  "categoryBreakdown": { "フード": 31000, "ドリンク": 17200 },
  "subBreakdown": { "前菜": 8200, "メイン": 22800, "ビール": 9000 },
  "hourly": [
    { "hour": 18, "フード": 12000, "ドリンク": 6000 },
    { "hour": 19, "フード": 19000, "ドリンク": 11200 }
  ],
  "ranking": [
    { "name": "生ビール", "qty": 42, "amount": 25200, "categoryName": "ドリンク", "subCategoryName": "ビール" }
  ]
}
```

- 集計対象は `status != 'cancelled'` の注文のみ。
- `seatUsageRate` は全席数に対する利用席数の割合（%）。
- 存在しないセッション ID は 404。

## Acceptance Criteria

- 集計結果が対象セッションの注文・グループと一致する。
- キャンセル済み注文は集計に含まれない。
