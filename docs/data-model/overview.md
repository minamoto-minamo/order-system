---
type: Data Model
title: データモデル概要
description: order-system のドメインモデル全体像。主要モデル・リレーション・マルチテナンシー方針を示す。
resource: ../../backend/prisma/schema.prisma
tags: [data-model, prisma, multi-tenancy, er-diagram]
---

# データモデル概要

order-system のドメインモデル全体像。実装は [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma) を一次ソースとする。外部キー・制約・インデックスは schema ファイルを優先する。API 仕様（[endpoints](../api/endpoints/index.md)）と整合させること。

## 主要モデル

Prisma schema 準拠。

- **Store**: 店舗（テナント）。`subdomain` でサブドメイン識別。マルチテナンシーは pool 型（共有 DB・共有アプリ、`storeId` 列による行レベル分離）。
- **PlatformAdmin**: プラットフォーム運営側の管理者。`Store` に紐づかない独立したアカウント（予約サブドメイン `admin` 配下で運用）。
- **Session**: 営業セッション（開始/終了）。`storeId` を持つ。
- **SeatTable / Seat**: 座席レイアウトと席。`storeId` を持つ。
- **Category / SubCategory / MenuItem**: メニュー構成。`storeId` を持つ。
- **DrinkPlan / DrinkPlanItem**: ドリンクプランと対象メニュー。`DrinkPlanItem` は中間テーブルのため `storeId` なし、親経由でスコープする。
- **Course / CourseFoodItem**: コースメニューと含まれる料理。`CourseFoodItem` も同様に `storeId` なし。
- **Group / GroupSeat**: 来店グループと席割当て。`GroupSeat` は複合 PK の中間テーブルのため `storeId` なし。
- **OrderItem**: 注文明細。Order モデルは存在せず、明細が直接 Group に紐づく。`storeId` を持つ。
- **Staff**: スタッフ、権限。`storeId` を持つ。`username` は店舗ごとにユニーク（`@@unique([storeId, username])`）。
- **RefreshToken**: リフレッシュトークン（使い捨てローテーション、親子チェーンで再利用検知）。`staffId` 経由で常に一意のため `storeId` なし。
- **Setting**: アプリ設定（税率・店舗情報・リフレッシュトークン方式）。`storeId Int @unique` で店舗ごとに 1 行（one-to-one）。

モデル別のフィールド・カスケード・インデックスは [prisma-summary.md](prisma-summary.md) を参照する。

## マルチテナンシー

- **アーキテクチャ**: pool 型。`Store`/`PlatformAdmin` を除く主要モデルに `storeId` 列を追加し、行レベルで論理分離する。
- **店舗の識別**: サブドメイン（`store1.example.com` 等）。予約サブドメイン `admin` はプラットフォーム管理者専用。
- **解決ロジック**: 詳細は [platform エンドポイント](../api/endpoints/platform.md) および [`backend/src/lib/store.ts`](../../backend/src/lib/store.ts) を参照する。

## ER 図

```mermaid
erDiagram
    STORE ||--o{ SESSION : has
    STORE ||--o{ STAFF : has
    STORE ||--o| SETTING : has
    STAFF ||--o{ REFRESH_TOKEN : has
    REFRESH_TOKEN |o--o{ REFRESH_TOKEN : rotates_to
    SESSION ||--o{ GROUP : has
    GROUP ||--o{ ORDER_ITEM : contains
    GROUP ||--o{ GROUP_SEAT : assigns
    GROUP }o--o| COURSE : applies
    GROUP }o--o| DRINK_PLAN : applies
    ORDER_ITEM }o--o| COURSE : appliedCourse
    SEAT_TABLE ||--o{ SEAT : contains
    SEAT ||--o{ GROUP_SEAT : assigned_to
    CATEGORY ||--o{ SUB_CATEGORY : has
    CATEGORY ||--o{ MENU_ITEM : belongs_to
    SUB_CATEGORY ||--o{ MENU_ITEM : belongs_to
    MENU_ITEM ||--o{ ORDER_ITEM : ordered_as
    DRINK_PLAN ||--o{ DRINK_PLAN_ITEM : has
    MENU_ITEM ||--o{ DRINK_PLAN_ITEM : in
    COURSE ||--o{ COURSE_FOOD_ITEM : has
    MENU_ITEM ||--o{ COURSE_FOOD_ITEM : in
    COURSE }o--o| DRINK_PLAN : includes

    STORE {
      Int id PK
      string subdomain "unique"
      string name
      boolean isActive
      datetime createdAt
    }
    PLATFORM_ADMIN {
      String id PK "UUID"
      string username "unique"
      datetime createdAt
    }
    SESSION {
      Int id PK
      Int storeId FK
      string status
      datetime openedAt
      datetime closedAt
    }
    GROUP {
      String id PK "UUID"
      string name
      int guestCount
      string status
      Decimal billedTaxRateInHouse "nullable"
      Decimal billedTaxRateTakeout "nullable"
      boolean billedTaxInclusive "nullable"
      datetime createdAt
    }
    GROUP_SEAT {
      String groupId FK
      Int seatId FK
    }
    ORDER_ITEM {
      String id PK "UUID"
      String groupId FK
      int menuItemId FK "nullable"
      string menuItemName
      int price
      int qty
      string status
      boolean isTakeout
      datetime orderedAt
    }
    SEAT_TABLE {
      Int id PK
      string label
      int x
      int y
      int w
      int h
    }
    SEAT {
      Int id PK
      string label
      string type
      int x
      int y
    }
    CATEGORY {
      Int id PK
      string name
      int sort
    }
    SUB_CATEGORY {
      Int id PK
      string name
      int sort
    }
    MENU_ITEM {
      Int id PK
      string name
      int price
      boolean soldOut
      string takeout
    }
    COURSE {
      Int id PK
      string name
      int price
    }
    COURSE_FOOD_ITEM {
      Int courseId FK
      Int menuItemId FK
      int qty
    }
    DRINK_PLAN {
      Int id PK
      string name
    }
    DRINK_PLAN_ITEM {
      Int drinkPlanId FK
      Int menuItemId FK
    }
    STAFF {
      String id PK "UUID"
      Int storeId FK
      string username "storeId とのユニーク複合キー"
      StaffRole role
      datetime createdAt
    }
    REFRESH_TOKEN {
      String id PK "UUID"
      String staffId FK
      string tokenHash "unique, sha256"
      String parentId FK "nullable, 自身への自己参照でローテーションチェーンを表す"
      datetime familyIssuedAt "チェーン最初の発行時刻（固定期限方式の起点）"
      datetime issuedAt
      datetime expiresAt
      datetime revokedAt "nullable"
      string userAgent "nullable"
      string ipAddress "nullable"
    }
    SETTING {
      Int id PK
      Int storeId FK "unique"
      string storeName
      string closingTime
      Decimal taxRateInHouse
      Decimal taxRateTakeout
      int canvasCols
      int canvasRows
      int gridSize
      boolean refreshTokenAutoExtend
      int refreshTokenExpiresMinutes
    }
```

詳細なフィールド、制約、インデックスは [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma) を参照する。
