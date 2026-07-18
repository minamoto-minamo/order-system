---
type: API Endpoint Group
id: E011
title: Reports
description: セッション単位の売上レポート出力 API。
resource: backend/src/routes/sessions.ts
tags: [reports, api]
---

# Reports

セッション単位の売上レポート出力 API。管理 UI 実装者・バックエンド実装者・経営向け。セッションの操作自体は [Sessions](./sessions.md) を参照。

- Base: `/api/sessions/:id/report`
- Auth: admin 限定（JWT cookie）

## GET /api/sessions/:id/report

指定セッションの売上集計を返す。

例: `GET /api/sessions/12/report`

Response 200:

```json
{
  "total": 48200,
  "groups": 9,
  "guests": 27,
  "seatUsageRate": 75,
  "categoryBreakdown": { "フード": 31000, "ドリンク": 17200 },
  "subBreakdown": { "前菜": 8200, "メイン": 22800, "ビール": 9000 },
  "taxBreakdown": {
    "10": { "subtotal": 40000, "tax": 4000 },
    "8":  { "subtotal": 8200,  "tax": 656  }
  },
  "hourly": [
    { "hour": 18, "フード": 12000, "ドリンク": 6000 },
    { "hour": 19, "フード": 19000, "ドリンク": 11200 }
  ],
  "ranking": [
    { "name": "生ビール", "qty": 42, "amount": 25200, "categoryName": "ドリンク", "subCategoryName": "ビール" }
  ]
}
```

- 集計対象は `status != 'cancelled'` の注文のみ。集計結果は対象セッションの注文・グループと一致し、キャンセル済み注文は含まれない。
- `seatUsageRate` は全席数に対する利用席数の割合（%）。
- `taxBreakdown`: 税率（%、文字列キー）ごとの税抜合計（`subtotal`）と税額（`tax`）。税額は切り捨て。
  - 会計確定時点で税込モードだった明細は `"inclusive"` キーに集計される（`subtotal` は税込金額の合計、`tax` は常に 0）。税率は会計確定時点のグループ単位スナップショット（`Group.billedTaxRateInHouse` / `billedTaxRateTakeout` / `billedTaxInclusive`。未確定の場合は店舗設定 `Setting` の値）で判定する。
- 削除済みメニューの注文は `categoryName: "削除済みメニュー"` として集計に含まれる（集計から欠落しない）。コース・飲み放題の定額課金明細は `categoryName: "コース・飲み放題料金"` として集計される。
- 存在しないセッション ID は 404。
- セッションが `closed` でない場合は 409。
- 店舗設定（`Setting`）が見つからない場合は 500（`common.setting_not_found`）。
