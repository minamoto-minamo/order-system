# Phase 1 Data Model: 商品オプション機能

## エンティティ

### ProductOptionGroup（オプション分類）

商品（MenuItem）に専属で紐づくオプションの分類。商品間で共有しない（[Clarifications](./spec.md#clarifications) Q1）。

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | Int（autoincrement） | PK |
| `storeId` | Int | FK → Store。既存パターン（`Course`等）に倣いマルチテナンシークエリの一貫性のため直接保持 |
| `menuItemId` | Int | FK → MenuItem、`onDelete: Cascade`（商品削除時に分類ごと削除） |
| `name` | String | 分類名（例：「氷の状態」「サイズ」） |
| `required` | Boolean（default: false） | 注文時に選択必須かどうか（FR-003） |
| `sort` | Int（default: 0） | 表示順 |

- インデックス: `@@index([menuItemId])`, `@@index([storeId])`

### ProductOptionChoice（オプション選択肢）

オプション分類に属する個々の選択肢。

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | Int（autoincrement） | PK |
| `groupId` | Int | FK → ProductOptionGroup、`onDelete: Cascade` |
| `name` | String | 選択肢名（例：「ロック」「メガサイズ」） |
| `extraPrice` | Int（default: 0） | 追加金額。正・0・負のいずれも可（[Clarifications](./spec.md#clarifications) Q2、FR-002） |
| `sort` | Int（default: 0） | 表示順 |

- インデックス: `@@index([groupId])`

### OrderItemOption（注文明細オプション選択スナップショット）

注文明細（OrderItem）に紐づき、選択された選択肢の内容を注文確定時点でスナップショット記録する。FR-006, FR-010を満たすため、選択肢自体が後から編集・削除されても本レコードの内容は不変。

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | String（uuid） | PK。既存の`OrderItem`/`Group`同様uuid |
| `orderItemId` | String | FK → OrderItem、`onDelete: Cascade`（親明細削除時に追従） |
| `choiceId` | Int? | FK → ProductOptionChoice、`onDelete: SetNull`（選択肢削除後もレコードは残る） |
| `groupName` | String | 選択当時のオプション分類名のスナップショット |
| `choiceName` | String | 選択当時の選択肢名のスナップショット |
| `extraPrice` | Int | 選択当時の追加金額のスナップショット |

- インデックス: `@@index([orderItemId])`, `@@index([choiceId])`

## 既存モデルへの変更

### OrderItem（変更なし・意味の確認のみ）

- `price`: 「MenuItem単価 + 選択されたOrderItemOption.extraPriceの合計」を格納する（0円未満はクランプ、FR-007）。フィールド追加はしない。
- `originalPrice`: 従来通りMenuItem単価のみを保持する（変更なし）。

### MenuItem（リレーション追加のみ）

- `optionGroups ProductOptionGroup[]` を追加（Prismaリレーションフィールド、DBカラム変更なし）。

## Prisma schema.prisma 追記イメージ

```prisma
model ProductOptionGroup {
  id         Int      @id @default(autoincrement())
  storeId    Int
  menuItemId Int
  name       String
  required   Boolean  @default(false)
  sort       Int      @default(0)

  store    Store    @relation(fields: [storeId], references: [id])
  menuItem MenuItem @relation(fields: [menuItemId], references: [id], onDelete: Cascade)
  choices  ProductOptionChoice[]

  @@index([menuItemId])
  @@index([storeId])
}

model ProductOptionChoice {
  id         Int    @id @default(autoincrement())
  groupId    Int
  name       String
  extraPrice Int    @default(0)
  sort       Int    @default(0)

  group           ProductOptionGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  orderItemOptions OrderItemOption[]

  @@index([groupId])
}

model OrderItemOption {
  id          String @id @default(uuid())
  orderItemId String
  choiceId    Int?
  groupName   String
  choiceName  String
  extraPrice  Int

  orderItem OrderItem            @relation(fields: [orderItemId], references: [id], onDelete: Cascade)
  choice    ProductOptionChoice? @relation(fields: [choiceId], references: [id], onDelete: SetNull)

  @@index([orderItemId])
  @@index([choiceId])
}
```

`Store`, `MenuItem`, `OrderItem` モデルにも逆リレーションフィールドを追加する（`optionGroups`, `options` 等）。

## バリデーションルール（データレベル）

- `ProductOptionGroup.name`, `ProductOptionChoice.name`: 空文字不可（既存の`MenuItem.name`等と同じ扱い）。
- `ProductOptionChoice.extraPrice`: 整数。上下限の技術的制約は設けない（spec Assumptions）。
- 同一`ProductOptionGroup`内での選択は択一（アプリケーションレベルで保証。DB制約は設けない — `OrderItemOption`は分類ごとに最大1件だが、これは注文作成時のリクエストバリデーションで担保する）。
- `required: true` の分類は、選択肢（`ProductOptionChoice`）が1件も無い状態になり得る（Edge Case: 管理者が全選択肢を削除した場合）。この場合、注文時にその商品は選択不能となり管理画面で警告表示する（UI側の責務、DB制約なし）。

## 状態遷移

本エンティティ群にステータス遷移はない（作成・更新・削除のCRUDのみ）。
