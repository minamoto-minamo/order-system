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
- **Category / SubCategory / MenuItem**: メニュー構成。`storeId` を持つ。`isSet` はセットメニュー（親商品）かどうかを表す（後述の `SetFrame` を参照）。
- **ProductOptionGroup / ProductOptionChoice**: 商品オプション（例:「氷の状態」分類と「ロック」「ソーダ」選択肢）。`MenuItem` に専属で紐づく（商品間で共有しない）。`storeId` を持つ。
- **SetFrame / SetFrameChoice**: セットメニューの内訳分類（例:「ラーメン」枠）と、枠に登録された既存商品への参照（選択肢）。`isSet: true` の `MenuItem` に紐づく。`storeId` を持つ。`SetFrameChoice.menuItemId` は他モデルの中間テーブル（`CourseFoodItem`/`DrinkPlanItem`）と異なり `onDelete: Cascade`（参照先商品が削除されると選択肢も自動的に消える。削除自体はブロックしない）。
- **DrinkPlan / DrinkPlanItem**: ドリンクプランと対象メニュー。`DrinkPlanItem` は中間テーブルのため `storeId` なし、親経由でスコープする。
- **Course / CourseFoodItem**: コースメニューと含まれる料理。`CourseFoodItem` も同様に `storeId` なし。
- **Group / GroupSeat**: 来店グループと席割当て。`GroupSeat` は複合 PK の中間テーブルのため `storeId` なし。`status` が `closed` に遷移する時点（会計確定時）の税率・税込設定を `billedTaxRateInHouse` / `billedTaxRateTakeout` / `billedTaxInclusive` にスナップショットする（注文作成時点ではまだ未確定）。
- **OrderItem**: 注文明細。Order モデルは存在せず、明細が直接 Group に紐づく。`storeId` を持つ。`menuItemId` を持つ明細は注文作成時点の `MenuItem.price` を `originalPrice` に常時スナップショットする（コース/飲み放題のゼロ化解除時の価格復元に使用）。`isCourseCharge` / `isDrinkPlanCharge` はコース・飲み放題の定額課金明細かどうかを表す。`isSetCharge` はセット注文の親明細（セット価格で課金、作成時点で `status: 'served'`）かどうかを表す。`setOrderItemId` は自己参照 FK で、セットの内訳（子明細、`price: 0`）が親明細の `id` を指す（`courseId` のようなテンプレートID方式ではなく、注文インスタンス単位の紐付け。同じセットを何度も別の内訳で注文しても混ざらない）。
- **OrderItemOption**: 注文明細に紐づく、選択されたオプションのスナップショット（`groupName`/`choiceName`/`extraPrice`を選択当時の値で保持）。`ProductOptionChoice` への参照は `onDelete: SetNull`（選択肢が後から削除されても過去の注文明細は不変）。
- **Staff**: スタッフ、権限。`storeId` を持つ。`username` は店舗ごとにユニーク（`@@unique([storeId, username])`）。
- **RefreshToken**: リフレッシュトークン（使い捨てローテーション、親子チェーンで再利用検知）。`staffId` 経由で常に一意のため `storeId` なし。
- **Setting**: アプリ設定（税率・税込/税別モード・店舗情報・リフレッシュトークン方式）。`storeId Int @unique` で店舗ごとに 1 行（one-to-one）。`taxInclusive` で消費税の税込表示モードを切り替える。

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
    MENU_ITEM ||--o{ PRODUCT_OPTION_GROUP : has
    PRODUCT_OPTION_GROUP ||--o{ PRODUCT_OPTION_CHOICE : has
    ORDER_ITEM ||--o{ ORDER_ITEM_OPTION : has
    PRODUCT_OPTION_CHOICE ||--o{ ORDER_ITEM_OPTION : selected_as
    MENU_ITEM ||--o{ SET_FRAME : "has (isSet=true)"
    SET_FRAME ||--o{ SET_FRAME_CHOICE : has
    MENU_ITEM ||--o{ SET_FRAME_CHOICE : "referenced by"
    ORDER_ITEM |o--o{ ORDER_ITEM : "set parent/children (setOrderItemId)"

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
      int seatUsageRate "nullable、close時に座席使用率をスナップショット保存"
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
      int originalPrice "nullable、注文時点のMenuItem単価スナップショット"
      int qty
      string status
      boolean isTakeout
      Int courseId FK "nullable"
      boolean isCourseCharge
      boolean isDrinkPlanCharge
      boolean isSetCharge "セット注文の親明細か"
      String setOrderItemId FK "nullable、自己参照。子明細が親のidを指す"
      datetime orderedAt
    }
    ORDER_ITEM_OPTION {
      String id PK "UUID"
      String orderItemId FK
      Int choiceId FK "nullable"
      string groupName "選択当時の分類名スナップショット"
      string choiceName "選択当時の選択肢名スナップショット"
      int extraPrice "選択当時の追加金額スナップショット"
    }
    PRODUCT_OPTION_GROUP {
      Int id PK
      Int menuItemId FK
      string name
      boolean required
      int sort
    }
    PRODUCT_OPTION_CHOICE {
      Int id PK
      Int groupId FK
      string name
      int extraPrice "正・0・負のいずれも可"
      int sort
    }
    SET_FRAME {
      Int id PK
      Int menuItemId FK "isSet=trueの商品"
      string name
      int sort
    }
    SET_FRAME_CHOICE {
      Int id PK
      Int frameId FK
      Int menuItemId FK "参照先の通常商品。onDelete:Cascade"
      int sort
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
      boolean isSet "セットメニュー（親商品）かどうか"
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
      int price "定額課金時の一人あたり料金"
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
      boolean taxInclusive
      int canvasCols
      int canvasRows
      int gridSize
      boolean refreshTokenAutoExtend
      int refreshTokenExpiresMinutes
    }
```

詳細なフィールド、制約、インデックスは [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma) を参照する。
