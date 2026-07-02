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
  - fields: id(Int), status, openedAt, closedAt
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
  - 来店グループ、席割当て（GroupSeat 中間テーブル）、滞在ステータス
  - Order モデルは存在しない。注文明細は OrderItem が直接 Group に紐づく
  - GroupSeat → Group/Seat は onDelete: Cascade
- **OrderItem**
  - id・groupId は UUID（String）
  - 注文明細。qty, price, status（pending/ready/served/cancelled）、isTakeout を持つ
  - courseId を任意で持つ（onDelete: SetNull）
- **Staff**
  - id は UUID（String）
  - username（unique）、passwordHash、role（StaffRole enum: admin | staff）、createdAt
- **Setting**
  - 1レコードのみ（id=1固定）
  - storeName, closingTime, taxRateInHouse/taxRateTakeout（Decimal(5,2)）
  - 席レイアウト設定: canvasCols/canvasRows/gridSize（値・最小・最大）

## インデックス

- SubCategory: categoryId
- Seat: tableId
- MenuItem: categoryId, subCategoryId
- Group: sessionId, status
- GroupSeat: seatId
- OrderItem: groupId, status, orderedAt
- Course: drinkPlanId

## カスケード規則

- **GroupSeat**: group/seat が削除されたら groupSeat レコードも削除
- **DrinkPlanItem**: drinkPlan が削除されたら items も削除
- **CourseFoodItem**: course が削除されたら foodItems も削除
- **OrderItem.course**: course が削除されたら courseId を NULL に設定（SetNull）

詳細なスキーマ定義は [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma) を参照する。モデル変更は [migrations.md](migrations.md) の手順に沿ってマイグレーション計画を立てて実施する。
