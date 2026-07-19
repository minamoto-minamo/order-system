# Phase 1 Data Model: コース人数変更時の手動追加注文保護

本機能はPrismaスキーマの変更を伴わない（clarifyで方式Bを採用したため）。既存エンティティのうち、本機能のバリデーションで参照するもののみ記載する。

## 参照するエンティティ（変更なし）

### OrderItem（`backend/prisma/schema.prisma`）

- `menuItemId: Int?` — 追加注文itemのメニューIDと、コースの `foodItems` の `menuItemId` を突き合わせる判定に使用。
- `courseId: Int?` — 追加注文リクエストの `body.courseId` として扱われる（作成時の入力値）。
- `isCourseCharge: Boolean` — 本機能の判定では対象外（定額課金明細は `menuItemId` を持たないため、突き合わせ対象に含まれない）。

本機能により新規カラム・新規モデル・新規リレーションは追加しない。

### Course / CourseFoodItem（`backend/prisma/schema.prisma`）

- `Course.foodItems: CourseFoodItem[]`（既存のinclude）— `POST /orders` のバリデーションで、コース内商品の `menuItemId` 一覧を取得するために参照する（既存の `PUT /:id/course` の実装と同じ取得パターン）。

## 状態遷移

該当なし（本機能はリクエストの作成可否を判定するバリデーションであり、既存エンティティのライフサイクル・状態遷移に変更はない）。

## バリデーションルール（新規）

- `POST /orders` の `body.courseId != null` のとき：
  - `body.items[].menuItemId` のいずれかが、`courseId` に紐づく `Course.foodItems[].menuItemId` に含まれる場合、リクエスト全体を拒否する（422、`ErrorCodes.Orders.CourseFoodItemConflict`）。
  - 含まれない場合は、既存の挙動（`currentGroup.courseId === body.courseId` の一致チェック等）に従う。
