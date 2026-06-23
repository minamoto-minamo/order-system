# Data Model — Overview

## Purpose

ドメインモデルの要約。実装は backend/prisma/schema.prisma を一次ソースとして参照する。

## Audience

バックエンド実装者、フロント実装者、DB 管理者

## Summary

主要モデル（Prisma schema 準拠）:

- Session: 営業セッション（開始/終了）
- SeatTable / Seat: 座席レイアウトと席
- Category / SubCategory / MenuItem: メニュー構成
- DrinkPlan / DrinkPlanItem: ドリンクプランと対象メニュー
- Course / CourseFoodItem: コースメニューと含まれる料理
- Group / GroupSeat: 来店グループと席割当て
- OrderItem: 注文明細（Order モデルは存在しない。明細が直接 Group に紐づく）
- Staff: スタッフ、権限
- Setting: アプリ設定（税率・店舗情報）

## Notes

詳細は backend/prisma/schema.prisma を参照。API 仕様（docs/api）と整合させること。モデル間の外部キー／制約は schema ファイルを優先する。

## ER Diagram (Mermaid)

```mermaid
erDiagram
    SESSION ||--o{ GROUP : has
    GROUP ||--o{ ORDER_ITEM : contains
    GROUP ||--o{ GROUP_SEAT : assigns
    GROUP }o--o| COURSE : applies
    GROUP }o--o| DRINK_PLAN : applies
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

    SESSION {
      Int id PK
      string status
      datetime openedAt
      datetime closedAt
    }
    GROUP {
      Int id PK
      string name
      int guestCount
      string status
      datetime createdAt
    }
    GROUP_SEAT {
      Int groupId FK
      Int seatId FK
    }
    ORDER_ITEM {
      Int id PK
      int qty
      int price
      string status
      boolean isTakeout
      datetime orderedAt
    }
    SEAT_TABLE {
      Int id PK
      string label
    }
    SEAT {
      Int id PK
      string label
      string type
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
      Int id PK
      string username
      string role
      datetime createdAt
    }
    SETTING {
      Int id PK
      string storeName
      string closingTime
      float taxRateInHouse
      float taxRateTakeout
    }
```

Note: 詳細なフィールド、制約、インデックスは backend/prisma/schema.prisma を参照する。
