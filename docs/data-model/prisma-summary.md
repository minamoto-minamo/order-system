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
  - isSet（default: false）: セットメニュー（親商品）かどうか。true の場合、商品オプション（optionGroups）は併用不可（API層でバリデーション、DB制約ではない）
- **ProductOptionGroup / ProductOptionChoice**
  - 商品オプション。Group は MenuItem に専属（商品間で共有しない）、required で注文時必須かを指定
  - Choice の extraPrice は正・0・負のいずれも可（割引選択肢を表現できる）
  - ProductOptionGroup → MenuItem は onDelete: Cascade、ProductOptionChoice → ProductOptionGroup も onDelete: Cascade
- **OrderItemOption**
  - 注文明細に選択されたオプションのスナップショット（groupName/choiceName/extraPrice）。分類・選択肢が事後編集・削除されても内容は不変
  - OrderItemOption → OrderItem は onDelete: Cascade、OrderItemOption → ProductOptionChoice（choiceId、nullable）は onDelete: SetNull
- **SetFrame / SetFrameChoice**
  - セットメニュー（MenuItem.isSet: true）の内訳分類（枠）と、枠に登録された既存商品への参照（選択肢）
  - 全ての枠が選択必須（ProductOptionGroup.required のような任意選択の概念はない）
  - SetFrame → MenuItem は onDelete: Cascade。SetFrameChoice → MenuItem（参照先の通常商品）は **onDelete: Cascade**（CourseFoodItem/DrinkPlanItem の onDelete: Restrict とは異なり、参照先商品の削除をブロックしない。削除されると選択肢が自動的に除外される）
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
  - isSetCharge: セット注文の親明細かどうか。true の場合 originalPrice = price = セットの MenuItem.price、作成時点で status: 'served'（厨房調理を要さないため）
  - setOrderItemId: 自己参照 FK（onDelete: Cascade）。セットの内訳（子明細、price: 0）が親明細の id を指す。courseId のようなテンプレートID方式ではなく注文インスタンス単位の紐付けのため、同じセットを複数回・別内訳で注文しても混ざらない
  - options: OrderItemOption[]（選択されたオプションのスナップショット一覧）
- **Staff**
  - id は UUID（String）
  - username（unique）、passwordHash、role（StaffRole enum: admin | staff）、createdAt
- **Setting**
  - storeId でユニーク（店舗ごとに1行、one-to-one）
  - storeName, closingTime, taxRateInHouse/taxRateTakeout（Decimal(5,2)）, taxInclusive（税込/税別モード）
  - 席レイアウト設定: canvasCols/canvasRows/gridSize（値・最小・最大）

## インデックス

- `storeId` を持つモデル（Session, SeatTable, Seat, Category, SubCategory, MenuItem, DrinkPlan, Course, Group, OrderItem, ProductOptionGroup, SetFrame）は全て `@@index([storeId])` を持つ（テナント絞り込み用）
- Session: [storeId, status]（複合）
- SubCategory: categoryId
- Seat: tableId
- MenuItem: categoryId, subCategoryId
- Group: sessionId, status
- GroupSeat: seatId
- OrderItem: groupId, status, orderedAt, setOrderItemId
- Course: drinkPlanId
- Staff: [storeId, username]（ユニーク複合）
- RefreshToken: staffId, parentId
- ProductOptionGroup: menuItemId
- ProductOptionChoice: groupId
- OrderItemOption: orderItemId, choiceId
- SetFrame: menuItemId
- SetFrameChoice: frameId, menuItemId

## カスケード規則

- **GroupSeat**: group/seat が削除されたら groupSeat レコードも削除（Cascade）
- **DrinkPlanItem**: drinkPlan が削除されたら items も削除（Cascade）。menuItem 側は Restrict（参照中の menuItem は削除不可）
- **CourseFoodItem**: course が削除されたら foodItems も削除（Cascade）。menuItem 側は Restrict（参照中の menuItem は削除不可）
- **OrderItem.menuItem**: menuItem が削除されたら menuItemId を NULL に設定（SetNull）。menuItemName/price は既にスナップショット済みのため表示は維持される
- **OrderItem.course**: course が削除されたら courseId を NULL に設定（SetNull）
- **Seat.table**: SeatTable が削除されたら tableId を NULL に設定（SetNull）
- **RefreshToken.staff**: staff が削除されたら refreshToken も削除（Cascade）
- **RefreshToken.parent**: 親トークンが削除されたら parentId を NULL に設定（SetNull）
- **ProductOptionGroup**: menuItem が削除されたら分類ごと削除（Cascade）
- **ProductOptionChoice**: group が削除されたら選択肢も削除（Cascade）
- **OrderItemOption**: orderItem が削除されたらスナップショットも削除（Cascade）。choice（ProductOptionChoice）が削除されたら choiceId を NULL に設定（SetNull、groupName/choiceName/extraPrice は既にスナップショット済みのため表示は維持される）
- **SetFrame**: menuItem（isSet:true の商品）が削除されたら枠ごと削除（Cascade）
- **SetFrameChoice**: frame が削除されたら選択肢も削除（Cascade）。参照先の menuItem（通常商品）が削除されても選択肢は削除される（Cascade。CourseFoodItem/DrinkPlanItem の Restrict とは異なり、削除をブロックしない）
- **OrderItem.setOrderItemId**（自己参照）: 親明細が削除されたら子明細も削除（Cascade。実運用では OrderItem は論理削除（status: 'cancelled'）のみで物理削除されないため、店舗削除時の一括 deleteMany 以外では発火しない）

詳細なスキーマ定義は [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma) を参照する。モデル変更は [migrations.md](migrations.md) の手順に沿ってマイグレーション計画を立てて実施する。
