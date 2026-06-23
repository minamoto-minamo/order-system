# Prisma Summary

## Purpose

backend/prisma/schema.prisma を一次ソースとして、主要モデルとリレーションを短くまとめる。

## Audience

バックエンド実装者、データベース管理者、レビュー担当

## Summary (主要モデル)

- Session
  - fields: id, status, openedAt, closedAt
  - relation: Session → Group（1対多）
- SeatTable / Seat
  - レイアウト情報、座席とテーブルの関係
- Category / SubCategory / MenuItem
  - メニュー構成、価格、在庫やオプション参照
  - MenuItem は Category と SubCategory の両方に属する（2本のリレーション）
- DrinkPlan / DrinkPlanItem
  - ドリンクプラン定義、対象メニュー明細（DrinkPlanItem で管理）
- Course / CourseFoodItem
  - コースメニュー定義、含まれる料理と数量（CourseFoodItem で管理）
  - Course は DrinkPlan を任意で紐づけ可能
- Group / GroupSeat
  - 来店グループ、席割当て（GroupSeat 中間テーブル）、滞在ステータス
  - Order モデルは存在しない。注文明細は OrderItem が直接 Group に紐づく
- OrderItem
  - 注文明細。qty, price, status（pending/ready/served/cancelled）、isTakeout を持つ
- Staff
  - username（unique）、passwordHash、role（"admin" | "staff"）、createdAt
- Setting
  - 1レコードのみ（id=1固定）。storeName, closingTime, taxRateInHouse, taxRateTakeout

## Indexes / Performance

- MenuItem: categoryId, subCategoryId にインデックス
- Group: sessionId, status にインデックス
- GroupSeat: seatId にインデックス
- OrderItem: groupId, status にインデックス

## Notes

詳細なスキーマ定義は backend/prisma/schema.prisma を参照。モデル変更はマイグレーション計画を立てて実施する。
