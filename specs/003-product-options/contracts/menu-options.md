# API Contract: 商品オプション機能

既存の `menus.ts`（MenuItem CRUD）と `orders.ts`（注文作成）を拡張する。新規エンドポイントは追加しない。

## 共有型の追加・拡張（`shared/types/index.ts`）

```ts
export interface ProductOptionChoice {
  id: number
  name: string
  extraPrice: number
  sort: number
}

export interface ProductOptionGroup {
  id: number
  name: string
  required: boolean
  sort: number
  choices: ProductOptionChoice[]
}

// MenuItem に optionGroups を追加
export interface MenuItem {
  id: number
  name: string
  price: number
  categoryId: number
  subCategoryId: number
  soldOut: boolean
  takeout: TakeoutType
  sort: number
  optionGroups: ProductOptionGroup[] // 追加
}

// UpsertMenuItemRequest に optionGroups を追加
export interface UpsertMenuItemRequest {
  name: string
  price: number
  categoryId: number
  subCategoryId: number
  soldOut: boolean
  takeout: TakeoutType
  optionGroups: UpsertProductOptionGroupRequest[] // 追加
}

export interface UpsertProductOptionGroupRequest {
  name: string
  required: boolean
  sort: number
  choices: UpsertProductOptionChoiceRequest[]
}

export interface UpsertProductOptionChoiceRequest {
  name: string
  extraPrice: number
  sort: number
}

// OrderItem に選択済みオプションを追加
export interface OrderItemOption {
  id: string
  choiceId: number | null
  groupName: string
  choiceName: string
  extraPrice: number
}

export interface OrderItem {
  id: string
  groupId: string
  menuItemId: number | null
  menuItemName: string
  price: number
  qty: number
  status: OrderItemStatus
  isTakeout: boolean
  courseId: number | null
  isCourseCharge: boolean
  isDrinkPlanCharge: boolean
  orderedAt: string
  options: OrderItemOption[] // 追加
}

// OrderItemInput に選択したオプション選択肢のidを追加
export interface OrderItemInput {
  menuItemId: number
  qty: number
  isTakeout?: boolean
  selectedChoiceIds?: number[] // 追加。分類ごとに1つのchoiceId、複数分類がある場合は複数要素
}
```

## PUT /menus/:id, POST /menus（既存エンドポイントの拡張）

- **Request body**: `UpsertMenuItemRequest`（`optionGroups` を含む）
- **挙動**: `optionGroups` は既存の `courses.ts` の `foodItems` と同じ「全置換」方式（`deleteMany` + `create` のnested write）で保存する。
- **Response**: `MenuItem`（`optionGroups` を含む）
- **Socket.io**: 既存の `menu:created` / `menu:updated` イベントのペイロード（`MenuItem`）に `optionGroups` が含まれるようになる（イベント名・型シグネチャ自体は変更なし）。
- **権限**: 既存通り `requireAdmin`。

## POST /orders（既存エンドポイントの拡張）

- **Request body**: `CreateOrderBatchRequest`（`items[].selectedChoiceIds` を含む）
- **サーバー側バリデーション（追加）**:
  1. `selectedChoiceIds` に含まれる各choiceIdが、対象`menuItemId`に紐づく`ProductOptionChoice`として実在するか検証。不正なchoiceIdがあれば400エラー。
  2. 同一`ProductOptionGroup`から2件以上のchoiceIdが選択されていないか検証（択一制約、FR-005）。違反時は400エラー。
  3. `required: true` の`ProductOptionGroup`が全て`selectedChoiceIds`でカバーされているか検証（FR-004）。未選択の分類があれば400エラー。
- **価格計算**: `originalPrice`（MenuItem単価）はそのまま。`price` = `originalPrice + Σ(選択されたchoiceのextraPrice)`。負値になる場合は0円にクランプ（FR-007）。
- **保存**: `OrderItem`作成と同一トランザクション内で、選択されたchoiceごとに`OrderItemOption`を作成（groupName/choiceName/extraPriceをその時点の値でスナップショット）。
- **エラーコード追加（`backend/src/lib/errors.ts`）**: `ErrorCodes.orders` 配下に以下を追加する想定。
  - `invalidOptionChoice`: 実在しない/対象商品に属さないchoiceIdが指定された
  - `duplicateOptionGroupSelection`: 同一分類から複数選択肢が指定された
  - `missingRequiredOption`: 必須分類が未選択

## 厨房表示（既存の調理チケット表示ロジック拡張）

- 厨房画面（Kitchen）が参照する `OrderItem` に `options` 配列が追加されるため、商品名の下に選択されたオプション名（`choiceName`）を表示する（FR-008）。新規APIは不要、既存の`order:created`イベントのペイロードに含まれる。
