---
type: Notes
title: 会計・売上集計の設計ノート
description: 金額の保持方法・税率スナップショット・集計方針など会計まわりの設計上の注意点。
resource: ../../backend/prisma/schema.prisma
tags: [accounting, tax, reporting]
---

# 会計・売上集計の設計ノート

会計・売上集計に関する設計上の注意点をまとめる。データモデルの全体像は [overview.md](overview.md) を参照する。

## 金額と税率

- 金額は整数（最小通貨単位）で保存する（例: JPY は 円、USD は セント）。
- 会計確定（`Group.status === 'closed'`）時の税率（`taxRateInHouse` / `taxRateTakeout` / `taxInclusive`）を `Group.billedTaxRate*` / `billedTaxInclusive` にスナップショット保存する。未会計中は現在の `Setting` を反映する。
- 税額計算はフロントエンドで `Math.floor(price * qty * effectiveTaxRate / 100)` で実施する。
- `OrderItem` は `isTakeout` フラグを持ち、実効税率の選択（内食/テイクアウト）に使用する。
- `OrderItem.originalPrice` は `menuItemId != null` の明細が常に持つ注文作成時点の `MenuItem` 単価で、飲み放題ゼロ化時の復元にも使う。コース料金・飲み放題料金などの定額課金明細（`menuItemId == null`）は `null` のままにする。
- 日次クロージング（営業締め）処理の仕様を明示する（計算タイミング、集計窓）。

## 集計

- 日次/週次/月次での集計キーを定義（店舗ID, 決済種別, 支払ステータス など）。
- 集計は可能なら ETL / バッチで実行し、オンラインクエリ負荷を避ける。

複雑な会計処理は経理チームと要件を確定してから実装する。
