---
type: Schema Reference
title: Prisma スキーマ要約
description: 主要モデルのフィールド・インデックス・カスケード規則を短くまとめた schema.prisma のリファレンス。
resource: ../../backend/prisma/schema.prisma
tags: [prisma, schema, index, cascade]
---

# Prisma スキーマ要約

[`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma) を一次ソースとして、主要モデルとリレーションを短くまとめる。全体像は [overview.md](overview.md) を参照する。

## 主要モデル

- **Session**
  - fields: id(Int), storeId, status, openedAt, closedAt, seatUsageRate（nullable、close 時に座席使用率を%でスナップショット保存）
  - relation: Session → Group（1対多）
- **SeatTable / Seat**
  - レイアウト情報、座席とテーブルの関係
  - SeatTable.x/y/w/h と Seat.x/y は Int（グリッド座標）
- **Category / SubCategory / MenuItem**
  - メニュー構成、価格、在庫やオプション参照
  - MenuItem は Category と SubCategory の両方に属する（2本のリレーション）
- **DrinkPlan / DrinkPlanItem**
  - ドリンクプラン定義、対象メニュー明細（DrinkPlanItem で管理）
  - DrinkPlanItem → DrinkPlan は onDelete: Cascade
- **Course / CourseFoodItem**
  - コースメニュー定義、含まれる料理と数量（CourseFoodItem で管理）
  - Course は DrinkPlan を任意で紐づけ可能
  - CourseFoodItem → Course は onDelete: Cascade
- **Group / GroupSeat**
  - id は UUID（String）
  - 来店グループ、席割当て（GroupSeat 中間テーブル）、滞在ステータス（active/bill_requested/closed）
  - Order モデルは存在しない。注文明細は OrderItem が直接 Group に紐づく
  - status が closed に遷移する時点（会計確定時）の Setting をスナップショットして billedTaxRateInHouse/billedTaxRateTakeout/billedTaxInclusive に保存する（いずれも nullable、注文作成時点では未確定）
  - GroupSeat → Group/Seat は onDelete: Cascade
- **OrderItem**
  - id・groupId は UUID（String）
  - 注文明細。qty, price, status（pending/ready/served/cancelled）、isTakeout を持つ
  - originalPrice: menuItemId を持つ明細が常に持つ、注文時点の MenuItem 単価スナップショット（nullable。定額課金明細は null のまま）。飲み放題ゼロ化解除時の価格復元に使う
  - isCourseCharge: コース/飲み放題の定額課金明細かどうか
  - isDrinkPlanCharge: isCourseCharge な明細のうち飲み放題分の定額課金明細かどうか
  - courseId を任意で持つ（onDelete: SetNull）
- **Staff**
  - id は UUID（String）
  - username（unique）、passwordHash、role（StaffRole enum: admin | staff）、createdAt
- **Setting**
  - storeId でユニーク（店舗ごとに1行、one-to-one）
  - storeName, closingTime, taxRateInHouse/taxRateTakeout（Decimal(5,2)）, taxInclusive（税込/税別モード）
  - 席レイアウト設定: canvasCols/canvasRows/gridSize（値・最小・最大）

## インデックス

- `storeId` を持つモデル（Session, SeatTable, Seat, Category, SubCategory, MenuItem, DrinkPlan, Course, Group, OrderItem）は全て `@@index([storeId])` を持つ（テナント絞り込み用）
- Session: [storeId, status]（複合）
- SubCategory: categoryId
- Seat: tableId
- MenuItem: categoryId, subCategoryId
- Group: sessionId, status
- GroupSeat: seatId
- OrderItem: groupId, status, orderedAt
- Course: drinkPlanId
- Staff: [storeId, username]（ユニーク複合）
- RefreshToken: staffId, parentId

## カスケード規則

- **GroupSeat**: group/seat が削除されたら groupSeat レコードも削除（Cascade）
- **DrinkPlanItem**: drinkPlan が削除されたら items も削除（Cascade）。menuItem 側は Restrict（参照中の menuItem は削除不可）
- **CourseFoodItem**: course が削除されたら foodItems も削除（Cascade）。menuItem 側は Restrict（参照中の menuItem は削除不可）
- **OrderItem.menuItem**: menuItem が削除されたら menuItemId を NULL に設定（SetNull）。menuItemName/price は既にスナップショット済みのため表示は維持される
- **OrderItem.course**: course が削除されたら courseId を NULL に設定（SetNull）
- **Seat.table**: SeatTable が削除されたら tableId を NULL に設定（SetNull）
- **RefreshToken.staff**: staff が削除されたら refreshToken も削除（Cascade）
- **RefreshToken.parent**: 親トークンが削除されたら parentId を NULL に設定（SetNull）

詳細なスキーマ定義は [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma) を参照する。モデル変更は [migrations.md](migrations.md) の手順に沿ってマイグレーション計画を立てて実施する。
