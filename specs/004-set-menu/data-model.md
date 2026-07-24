# Phase 1 Data Model: セットメニュー機能

## エンティティ

### MenuItem（変更：フィールド追加）

セットメニュー自体は既存`MenuItem`の特殊種別として表現する（[research.md](./research.md) Decision 1）。

| フィールド | 型 | 説明 |
|---|---|---|
| `isSet` | Boolean（default: false） | この商品がセットメニュー（親商品）かどうか |

- `isSet: true`のMenuItemは、既存の`optionGroups`（003-product-options）を同時に持たない（Assumptions：003機能はスコープ外）。API側で`isSet: true`かつ`optionGroups`が空でない場合は400エラーとする。

### SetFrame（セット枠）

セットメニューに属する内訳の分類（例：「ラーメン」枠）。

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | Int（autoincrement） | PK |
| `storeId` | Int | FK → Store。既存パターン（`ProductOptionGroup`等）に倣いマルチテナンシークエリの一貫性のため直接保持 |
| `menuItemId` | Int | FK → MenuItem（`isSet: true`の商品）、`onDelete: Cascade`（セット削除時に枠ごと削除） |
| `name` | String | 枠名（例：「ラーメン」「チャーハン」） |
| `sort` | Int（default: 0） | 表示順 |

- インデックス: `@@index([menuItemId])`, `@@index([storeId])`
- 全枠が選択必須（FR-004）。`ProductOptionGroup`と異なり`required`フィールドは持たない（Assumptions：各枠は択一・必須選択）。

### SetFrameChoice（セット枠の選択肢）

枠に属する既存商品への参照。

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | Int（autoincrement） | PK |
| `frameId` | Int | FK → SetFrame、`onDelete: Cascade` |
| `menuItemId` | Int | FK → MenuItem（既存の通常商品）、`onDelete: Cascade`（[research.md](./research.md) Decision 3：参照先商品の削除をブロックせず、選択肢を自動的に取り除く） |
| `sort` | Int（default: 0） | 表示順 |

- インデックス: `@@index([frameId])`, `@@index([menuItemId])`
- 参照先商品の名称・価格・品切れ状態はスナップショットしない（都度JOINで最新値を参照する。選択肢一覧表示・品切れ判定はこの現在値を使う）。

### OrderItem（変更：フィールド追加）

| フィールド | 型 | 説明 |
|---|---|---|
| `isSetCharge` | Boolean（default: false） | セット注文の親明細かどうか（`isCourseCharge`と同型） |
| `setOrderItemId` | String? | 自己参照FK → OrderItem.id。子（内訳）明細が親明細のidを指す。親明細・通常明細ではnull |

- 自己参照リレーション: `setParent OrderItem? @relation("SetBreakdown", fields: [setOrderItemId], references: [id], onDelete: Cascade)` / `setChildren OrderItem[] @relation("SetBreakdown")`
- インデックス: `@@index([setOrderItemId])`
- 親明細: `menuItemId`はセットのMenuItem.id、`price`/`originalPrice`はセット価格、`isSetCharge: true`、`status: 'served'`で作成時点から即時確定（[research.md](./research.md) Decision 4）。
- 子明細: `menuItemId`は選択された商品のid、`price: 0`、`originalPrice`は選択商品の単価スナップショット、`qty`は親と同じ数量、`setOrderItemId`に親のidを設定、`status`は通常どおり`pending`から開始し厨房ワークフローに乗る。

## Prisma schema.prisma 追記イメージ

```prisma
model MenuItem {
  // ...既存フィールド
  isSet Boolean @default(false)

  // ...既存リレーション
  setFrames SetFrame[]        @relation("SetFrames")
  setFrameChoices SetFrameChoice[] @relation("SetFrameChoiceProducts")
}

model SetFrame {
  id         Int    @id @default(autoincrement())
  storeId    Int
  menuItemId Int
  name       String
  sort       Int    @default(0)

  store    Store    @relation(fields: [storeId], references: [id])
  menuItem MenuItem @relation("SetFrames", fields: [menuItemId], references: [id], onDelete: Cascade)
  choices  SetFrameChoice[]

  @@index([menuItemId])
  @@index([storeId])
}

model SetFrameChoice {
  id         Int @id @default(autoincrement())
  frameId    Int
  menuItemId Int
  sort       Int @default(0)

  frame    SetFrame @relation(fields: [frameId], references: [id], onDelete: Cascade)
  menuItem MenuItem @relation("SetFrameChoiceProducts", fields: [menuItemId], references: [id], onDelete: Cascade)

  @@index([frameId])
  @@index([menuItemId])
}

model OrderItem {
  // ...既存フィールド
  isSetCharge    Boolean @default(false)
  setOrderItemId String?

  // ...既存リレーション
  setParent   OrderItem?  @relation("SetBreakdown", fields: [setOrderItemId], references: [id], onDelete: Cascade)
  setChildren OrderItem[] @relation("SetBreakdown")

  @@index([setOrderItemId])
}
```

`Store`モデルにも`setFrames SetFrame[]`の逆リレーションを追加する。

## バリデーションルール（データレベル）

- `SetFrame.name`: 空文字不可（既存の`ProductOptionGroup.name`等と同じ扱い）。
- `MenuItem.isSet: true`のとき`optionGroups`は空配列であること（API層で検証、DB制約は設けない）。
- 同一`SetFrame`内での選択は択一（アプリケーションレベルで保証。DB制約は設けない）。
- 全`SetFrame`が選択必須（`ProductOptionGroup.required`と異なり選択自体が任意になるケースはない）。
- `SetFrame`に選択肢（`SetFrameChoice`）が1件も無い、または全選択肢の参照先商品が品切れの状態になり得る（Edge Case）。この場合、注文時にそのセットは選択不能となる（UI側の責務、DB制約なし。バックエンドは選択リクエストが来た時点で400エラーとして拒否する）。

## 状態遷移

- `OrderItem.status`: 既存の`pending → ready → served`／`cancelled`遷移をそのまま使う。親明細（`isSetCharge: true`）のみ作成時点で`served`から開始する（厨房調理を要さないため）。
- キャンセル: 親明細への`PUT /orders/:id/cancel`は同一トランザクション内で全子明細に同じqty変更をカスケードする。子明細への直接キャンセルは409エラーで拒否する（[research.md](./research.md) Decision 5）。
