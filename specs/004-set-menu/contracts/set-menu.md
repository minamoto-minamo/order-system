# API Contract: セットメニュー機能

既存の `menus.ts`（MenuItem CRUD）・`orders.ts`（スタッフ用注文作成・キャンセル）・`customer.ts`（客用注文作成）を拡張する。新規エンドポイントは追加しない。

## 共有型の追加・拡張（`shared/types/index.ts`）

```ts
export interface SetFrameChoice {
  id: number
  menuItemId: number
  name: string       // 参照先商品の現在の名称（スナップショットしない）
  price: number       // 参照先商品の現在の単価（表示用。セット価格には加算されない）
  soldOut: boolean    // 参照先商品の現在の品切れ状態
  sort: number
}

export interface SetFrame {
  id: number
  name: string
  sort: number
  choices: SetFrameChoice[]
}

// MenuItem に isSet / setFrames を追加
export interface MenuItem {
  id: number
  name: string
  price: number
  categoryId: number
  subCategoryId: number
  soldOut: boolean
  takeout: TakeoutType
  sort: number
  optionGroups: ProductOptionGroup[]
  isSet: boolean          // 追加
  setFrames: SetFrame[]   // 追加
}

// UpsertMenuItemRequest に isSet / setFrames を追加
export interface UpsertMenuItemRequest {
  name: string
  price: number
  categoryId: number
  subCategoryId: number
  soldOut: boolean
  takeout: TakeoutType
  optionGroups?: UpsertProductOptionGroupRequest[]
  isSet?: boolean                              // 追加
  setFrames?: UpsertSetFrameRequest[]           // 追加
}

export interface UpsertSetFrameRequest {
  name: string
  sort: number
  choices: UpsertSetFrameChoiceRequest[]
}

export interface UpsertSetFrameChoiceRequest {
  menuItemId: number
  sort: number
}

// OrderItem にセット親子関係を追加
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
  options: OrderItemOption[]
  isSetCharge: boolean          // 追加
  setOrderItemId: string | null // 追加
}

// OrderItemInput にセット枠選択を追加
export interface OrderItemInput {
  menuItemId: number
  qty: number
  isTakeout?: boolean
  selectedChoiceIds?: number[]        // 003: 商品オプション
  selectedFrameChoiceIds?: number[]   // 追加。セット注文時、枠ごとに1つのSetFrameChoice.id
}
```

## PUT /menus/:id, POST /menus（既存エンドポイントの拡張）

- **Request body**: `UpsertMenuItemRequest`（`isSet` / `setFrames` を含む）
- **挙動**:
  - `setFrames`は既存の`optionGroups`と同じ「全置換」方式（`deleteMany` + `create` のnested write）で保存する。
  - `isSet: true`かつ`optionGroups`が空でない場合は422エラー（`Menus.SetWithOptionsNotAllowed`）。
  - `setFrames[].choices[].menuItemId`が同一店舗の実在する商品か検証する。存在しない場合は422エラー（`Menus.SetFrameChoiceMenuItemNotFound`）。
  - `isSet: false`（または未指定）の場合、`setFrames`は無視する（保存しない）。
- **Response**: `MenuItem`（`isSet` / `setFrames` を含む。`setFrames[].choices[].name`/`price`/`soldOut`は参照先商品の現在値をJOINして返す）
- **Socket.io**: 既存の `menu:created` / `menu:updated` イベントのペイロード（`MenuItem`）に `isSet` / `setFrames` が含まれるようになる（イベント名・型シグネチャ自体は変更なし）。
- **権限**: 既存通り `requireAdmin`。

## DELETE /menus/:id（既存エンドポイントの挙動確認・追加チェックなし）

- 商品が他のセット枠の選択肢として登録されていても削除をブロックしない（`SetFrameChoice.menuItemId`は`onDelete: Cascade`のため、削除と同時に選択肢からも自動的に除外される。[data-model.md](./data-model.md) 参照）。
- `isSet: true`の商品（セット自体）を削除する場合は、既存の`activeOrderCount`チェック（処理中の注文がある場合は409）がそのまま適用される。セット自体がコース・飲み放題プランに含まれることはない（`CourseFoodItem`/`DrinkPlanItem`は通常商品のみを参照する既存仕様）ため、`referenced_course`/`referenced_drink_plan`チェックは影響しない。

## POST /orders, POST /customer/orders（既存エンドポイントの拡張）

- **Request body**: `CreateOrderBatchRequest`（`items[].selectedFrameChoiceIds` を含む）
- **サーバー側バリデーション（追加）**:
  1. `item.menuItemId`が`isSet: true`の商品を指す場合、`selectedFrameChoiceIds`が必須。その商品の全`SetFrame`について、対応する選択肢がちょうど1つ含まれているか検証する（枠の過不足・重複はいずれも400エラー）。
  2. `selectedFrameChoiceIds`に含まれる各idが、対象`menuItemId`に紐づく`SetFrameChoice`として実在するか検証。不正なidは400エラー。
  3. 選択された`SetFrameChoice`の参照先商品が品切れでないか検証（FR-011）。品切れの場合は409エラー。
  4. `item.menuItemId`が`isSet: false`の通常商品の場合、`selectedFrameChoiceIds`は指定不可（指定されていれば400エラー）。
- **価格計算**:
  - 親明細: `originalPrice = price = セットのMenuItem.price`（内訳商品の価格は加算しない、FR-009）。
  - 子明細: `price = 0`、`originalPrice = 選択された商品の現在の単価`。
- **保存**: `OrderItem`作成と同一トランザクション内で、
  - 親明細を1件作成（`isSetCharge: true`, `status: 'served'`, `qty: 指定数量`）。
  - 各枠につき子明細を1件ずつ作成（`setOrderItemId: 親明細のid`, `price: 0`, `qty: 親と同じ数量`, `status`はデフォルト`pending`）。
- **エラーコード追加（`backend/src/lib/errors.ts`）**: `ErrorCodes.Orders` / `ErrorCodes.Customer` 配下に以下を追加する想定。
  - `invalidSetFrameChoice`: 実在しない/対象商品に属さないSetFrameChoiceIdが指定された
  - `missingSetFrameSelection`: 枠の選択に過不足がある（未選択の枠がある、または同一枠から複数選択されている）
  - `setFrameChoiceSoldOut`: 選択されたSetFrameChoiceの参照先商品が品切れ
  - `setFrameSelectionNotApplicable`: セットではない商品に対して`selectedFrameChoiceIds`が指定された

## PUT /orders/:id/cancel（既存エンドポイントの拡張）

- 対象明細が`isSetCharge: true`（セットの親明細）の場合: 同一トランザクション内で、`setOrderItemId`が対象idと一致する全子明細に対しても、親明細と同じqty変更（全キャンセルまたは同数量分の減算）を適用する。
- 対象明細が`setOrderItemId != null`かつ`isSetCharge: false`（セットの子明細）の場合: `isCourseCharge`ブロックと同様に409エラーで拒否する（内訳単独のキャンセル操作は提供しない、Edge Case）。
- **エラーコード追加**: `Orders.SetChildNotCancellable`（内訳単独のキャンセル拒否用、`Orders.CourseChargeNotCancellable`と対称）。

## 厨房表示（既存の調理チケット表示ロジック、変更なし）

- セットの子明細は通常の`OrderItem`として`order:created`イベントで配信され、既存の厨房チケット表示ロジック（商品ごとに個別チケット化）がそのまま適用される（FR-007）。親明細は`status: 'served'`で作成されるため厨房画面には表示されない。
- 新規APIは不要。

## 伝票・注文履歴表示（既存コンポーネントの拡張）

- スタッフ用（`GroupDetail/components/OrderHistory.tsx`）・客用（`CustomerOrder/components/CustomerOrderHistory.tsx`）双方で、既存の`isCourseCharge`/`courseId`によるコース明細のグルーピング表示（`partitionOrderItems`の`courseCharges`/`courseDishes`）と対称的な`setCharges`/`setDishes`分類を追加する。
- 相違点: コースは`courseId`（テンプレートID）で子を絞り込むのに対し、セットは`setOrderItemId === 対象親明細のid`（インスタンスID）で子を絞り込む（[research.md](./research.md) Decision 2）。
