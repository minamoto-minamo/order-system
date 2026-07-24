---

description: "Task list for セットメニュー機能"
---

# Tasks: セットメニュー機能

**Input**: Design documents from `/specs/004-set-menu/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/set-menu.md, quickstart.md（すべて完了済み）

**Tests**: プロジェクトのグローバル方針（CLAUDE.md「テストで検証する」）により、新規ロジック・変更箇所には対応するテストを含める。

**Organization**: タスクはUser Story（spec.md）ごとに分類する。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並行実行可能（別ファイル・依存関係なし）
- **[Story]**: 対応するUser Story（US1/US2/US3）
- 各タスクに具体的なファイルパスを含める

---

## Phase 1: Foundational（全User Storyの前提・ブロッキング）

**Purpose**: DBスキーマ・共有型・エラーコードなど、全User Storyが依存する基盤

**⚠️ CRITICAL**: このフェーズが完了するまでUser Story の実装は開始できない

- [ ] T001 `backend/prisma/schema.prisma` に `MenuItem.isSet`、`SetFrame`/`SetFrameChoice` モデル、`OrderItem.isSetCharge`/`setOrderItemId`（自己参照FK `setParent`/`setChildren`）を追加し、`Store`/`MenuItem` に逆リレーションを追加する（[data-model.md](./data-model.md) の Prisma schema 追記イメージを反映。`SetFrameChoice.menuItemId` は `onDelete: Cascade` とする、research.md Decision 3）
- [ ] T002 `pnpm --filter backend db:migrate` でマイグレーションを生成・適用する（T001完了後）
- [ ] T003 [P] `shared/types/index.ts` に `SetFrame` / `SetFrameChoice` / `UpsertSetFrameRequest` / `UpsertSetFrameChoiceRequest` 型を追加し、`MenuItem`（`isSet`, `setFrames`）、`UpsertMenuItemRequest`（`isSet`, `setFrames`）、`OrderItem`（`isSetCharge`, `setOrderItemId`）、`OrderItemInput`（`selectedFrameChoiceIds`）を拡張する（[contracts/set-menu.md](./contracts/set-menu.md) 参照）
- [ ] T004 [P] `backend/src/lib/errors.ts` に以下のエラーコードを追加する：`ErrorCodes.Menus` に `SetWithOptionsNotAllowed` / `SetFrameChoiceMenuItemNotFound`、`ErrorCodes.Orders` と `ErrorCodes.Customer` の両方に `InvalidSetFrameChoice` / `MissingSetFrameSelection` / `SetFrameChoiceSoldOut` / `SetFrameSelectionNotApplicable`、`ErrorCodes.Orders` に `SetChildNotCancellable`（customer.tsにはキャンセルAPIが存在しないため対象外）

**Checkpoint**: DBスキーマ・共有型・エラーコードが揃い、各User Storyの実装に着手できる

---

## Phase 2: User Story 1 - 管理者がセットメニューの構成を作成する (Priority: P1) 🎯 MVP

**Goal**: 管理画面でセット商品を作成し、枠（例：「ラーメン」）と各枠の選択肢（既存商品）を設定できる

**Independent Test**: 管理画面で「ラーメンチャーハンセット」を作成し、「ラーメン」枠に2商品、「チャーハン」枠に2商品を登録し、保存後に再表示されることを確認する

### Tests for User Story 1

- [ ] T005 [P] [US1] backend unit test: `POST /menus` / `PUT /menus/:id` に `setFrames` を含めた場合の全置換保存（作成・更新・削除の反映）、`isSet: true`かつ`optionGroups`が空でない場合の422エラー、存在しない`menuItemId`を選択肢に指定した場合の422エラーを検証するテストを `backend/src/routes/menus.test.ts` に追加する

### Implementation for User Story 1

- [ ] T006 [US1] `backend/src/lib/mappers.ts` の `toMenuItem` に `isSet` / `setFrames`（`choices`は参照先商品の現在の`name`/`price`/`soldOut`をJOINして含める）のマッピングを追加する
- [ ] T007 [US1] `backend/src/routes/menus.ts` の `createBodySchema` / `updateBodySchema`（JSON Schema）に `isSet`（boolean）、`setFrames` 配列（`name`, `sort`, `choices: [{menuItemId, sort}]`）を追加する
- [ ] T008 [US1] `backend/src/routes/menus.ts` の `POST /menus` / `PUT /menus/:id` に `setFrames` の nested write（`deleteMany` + `create` の全置換、`courses.ts:145-150`パターン踏襲）と、`isSet: true`×`optionGroups`併用禁止バリデーション、`setFrames[].choices[].menuItemId`の実在性検証（同一store内）を実装する（T006, T007に依存）
- [ ] T009 [P] [US1] frontend: `frontend/src/pages/admin/Products/components/types.ts` に `SetFrameForm` / `SetFrameChoiceForm` 型と `ProductFormData.isSet`/`setFrames` を追加し、枠・選択肢の追加/編集/削除フォームコンポーネントを新規作成する（`frontend/src/pages/admin/Products/components/SetFrameEditor.tsx`。枠の追加・削除、各枠内の選択肢（既存商品からのピッカー）の追加・削除を持つ）
- [ ] T010 [US1] `frontend/src/pages/admin/Products/components/ProductModal.tsx` に「セットメニュー」トグルとT009のコンポーネントを組み込む（`isSet: true`のときは既存の`OptionGroupEditor`相当のUIを非表示にし排他にする）
- [ ] T011 [US1] `frontend/src/pages/admin/Products/Products.tsx` に`toOptionGroupForms`と対称的な`toSetFrameForms`変換を追加し、`addProduct`/`editProduct`で`isSet`/`setFrames`をAPI呼び出し・ローカル状態更新に反映する（T009に依存）

**Checkpoint**: 管理画面でセットメニューの構成設定が完結し、独立して検証可能（[quickstart.md](./quickstart.md) シナリオ1）

---

## Phase 3: User Story 2 - スタッフ・客がセットメニューを注文する (Priority: P2)

**Goal**: 注文画面でセットメニューを選ぶと枠ごとに選択肢が提示され、各枠から1つずつ選んでセットを1回の注文として確定できる。確定後の注文明細はセット価格のみで課金され、内訳は個別の注文明細として生成される

**Independent Test**: 「ラーメンチャーハンセット」を選び、「味噌ラーメン」と「五目チャーハン」を選択して注文し、会計金額がセット価格通りになることを確認する

**重要**: 注文作成APIは `backend/src/routes/orders.ts`（スタッフ用）と `backend/src/routes/customer.ts`（客用ゲスト向け）の2経路が独立実装されている（003-product-optionsと同じ構造）。以下のバリデーション・親子明細作成は**両ファイルに同様に実装する**。キャンセルAPI（`PUT /orders/:id/cancel`）はスタッフ用のみに存在する。

### Tests for User Story 2

- [ ] T012 [P] [US2] backend unit test（orders.ts）: 枠選択の過不足・重複・実在性・品切れバリデーション、親明細（セット価格・数量・`isSetCharge: true`・`status: 'served'`）と子明細（`price: 0`・親と同じ数量・`setOrderItemId`・`status: 'pending'`）の作成ロジックを検証するテストを `backend/src/routes/orders.test.ts` に追加する
- [ ] T013 [P] [US2] backend unit test（customer.ts）: T012と同内容を客用ルートで検証するテストを `backend/src/routes/customer.test.ts` に追加する
- [ ] T014 [P] [US2] backend unit test（orders.ts キャンセル）: セット親明細をキャンセルした場合に`setOrderItemId`が一致する全子明細へ同じqty変更がカスケードされること、子明細単独のキャンセルが409（`SetChildNotCancellable`）で拒否されることを検証するテストを `backend/src/routes/orders.test.ts` に追加する

### Implementation for User Story 2

- [ ] T015 [US2] `backend/src/routes/orders.ts` の `createBodySchema` と `backend/src/routes/customer.ts` の `createOrderBodySchema` の両方に `items[].selectedFrameChoiceIds` を追加する
- [ ] T016 [US2] `backend/src/routes/orders.ts` と `backend/src/routes/customer.ts` の両方に、対象商品が`isSet`の場合の枠選択バリデーション（全枠の過不足なき1件選択、選択肢の実在性・所属チェック、参照先商品の品切れチェック）と、非セット商品への`selectedFrameChoiceIds`指定拒否を追加する（[contracts/set-menu.md](./contracts/set-menu.md) の「POST /orders, POST /customer/orders」節参照、T004・T015に依存）
- [ ] T017 [US2] `backend/src/routes/orders.ts` と `backend/src/routes/customer.ts` 両方の`OrderItem`作成トランザクションに、セット親明細（`isSetCharge: true`, `status: 'served'`, `price: originalPrice: セットのMenuItem.price`）と各枠の子明細（`setOrderItemId: 親明細のid`, `price: 0`, `originalPrice: 選択商品の現在単価`, `qty: 親と同じ`）の作成を追加する（T016に依存）
- [ ] T018 [US2] `backend/src/routes/orders.ts` の `PUT /:id/cancel` に、対象が`isSetCharge: true`の場合の子明細への同一qty変更カスケードと、対象が子明細（`setOrderItemId != null`かつ`isSetCharge: false`）の場合の409拒否（`SetChildNotCancellable`）を追加する（[contracts/set-menu.md](./contracts/set-menu.md) の「PUT /orders/:id/cancel」節参照）
- [ ] T019 [US2] `backend/src/lib/mappers.ts` の`toOrderItem`に`isSetCharge`/`setOrderItemId`マッピングを追加する
- [ ] T020 [P] [US2] frontend: セット枠選択ボトムシートコンポーネントを新規作成する（`frontend/src/features/order/components/SetFrameSelectSheet.tsx`。`OptionSelectSheet.tsx`と同型の`BottomSheetModal`構成、全枠が必須選択、`MenuConfirmModal`への引き渡しは`{groupName: frame.name, choiceName: 選択商品名, extraPrice: 0}[]`の形に変換する、research.md Decision 6）
- [ ] T021 [US2] `frontend/src/pages/group/GroupDetail/components/MenuAdd.tsx` に、`isSet: true`の商品タップ時にT020のボトムシートを開く導線を追加する（既存の`optionGroups.length > 0`分岐と排他）
- [ ] T022 [US2] `frontend/src/pages/customer/CustomerOrder/components/CustomerMenuList.tsx` に同様の導線を追加する
- [ ] T023 [US2] 注文確定時のリクエストに`selectedFrameChoiceIds`を含める処理を、`MenuAdd.tsx`/`CustomerMenuList.tsx`双方の注文確定処理（`MenuConfirmModal`呼び出し元の`orderItems`組み立て）に追加する（T021, T022に依存）

**Checkpoint**: セットメニューの注文と金額反映が完結し、US1と独立して検証可能（[quickstart.md](./quickstart.md) シナリオ2・4）

---

## Phase 4: User Story 3 - 厨房・伝票でセット注文の内訳が適切に表示される (Priority: P3)

**Goal**: 厨房の調理チケットにはセットの内訳商品が個別に表示され、伝票・注文履歴ではセット単位でまとまって表示される

**Independent Test**: セット注文後、厨房画面でラーメンとチャーハンが別チケットとして表示されること、注文履歴画面ではその2品が「ラーメンチャーハンセット」の配下にまとまって表示されることを確認する

### Implementation for User Story 3

- [ ] T024 [US3] `frontend/src/lib/partitionOrderItems.ts` に、`isCourseCharge`/`courseId`ベースの`courseCharges`/`courseDishes`と対称的な`setCharges`（`isSetCharge: true`）/`setDishes`（`setOrderItemId != null`）分類を追加する
- [ ] T025 [P] [US3] frontend unit test: T024の`setCharges`/`setDishes`分類が`setOrderItemId`によってインスタンス単位で正しく絞り込まれることを検証するテストを追加する
- [ ] T026 [US3] `frontend/src/pages/group/GroupDetail/components/OrderHistory.tsx` に、既存の`courseCharges`/`courseDishes`表示と同様の`setCharges`/`setDishes`グルーピング表示を追加する（子明細には既存の個別キャンセルボタンを表示しない。キャンセルは親明細に対してのみ提供する）
- [ ] T027 [US3] `frontend/src/pages/customer/CustomerOrder/components/CustomerOrderHistory.tsx` の`groupItems`を拡張し、`setOrderItemId`を持つ子明細を親明細（同一`setOrderItemId`のセット注文インスタンス）の配下にまとめて表示する
- [ ] T028 [P] [US3] frontend unit test: T027の`groupItems`がセット親子を正しくグルーピングすることを検証するテストを追加する
- [ ] T029 [US3] 厨房画面（`frontend/src/pages/kitchen/Kitchen/components/`）が変更不要であることを確認する（セットの子明細は通常の`OrderItem`としてSocket.io配信され、既存の個別チケット表示ロジックがそのまま適用されるため。親明細は`status: 'served'`で作成され厨房画面に表示されない）

**Checkpoint**: 厨房表示・伝票表示の反映が完結し、全User Storyが独立して検証可能（[quickstart.md](./quickstart.md) シナリオ3・5）

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 全Storyを跨ぐ検証・後片付け

- [ ] T030 `pnpm typecheck` を実行し、frontend/backend/sharedすべてで型エラーがないことを確認する
- [ ] T031 `pnpm lint` を実行し、Biomeのリントエラーがないことを確認する
- [ ] T032 `pnpm test` を実行し、T005・T012・T013・T014・T025・T028のテストを含む全単体テストが通ることを確認する
- [ ] T033 [quickstart.md](./quickstart.md) のシナリオ1〜5をe2eで手動検証する（Claude側で実行）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: 依存なし。最初に着手し、完了後に全User Storyがブロック解除される
- **User Story 1 (Phase 2)**: Foundational完了後に着手可能。他Storyへの依存なし
- **User Story 2 (Phase 3)**: Foundational完了後に着手可能。管理画面で作成したセットを注文するため実運用上はUS1完了後に検証するが、実装自体はUS1のコードに依存しない（DBに直接セット構成を投入すれば独立実装・検証できる）
- **User Story 3 (Phase 4)**: Foundational完了後に着手可能。表示側のみのため他Storyの実装コードに依存しないが、動作確認にはUS1・US2で作られたデータが必要
- **Polish (Phase 5)**: 全Story完了後

### Within Each User Story

- Tests → Backendモデル/マッピング → Backend API → Frontend

### Parallel Opportunities

- Phase 1: T003, T004は並行実行可能（T001, T002はスキーマ変更のため直列）
- Phase 2: T005とT009は並行実行可能
- Phase 3: T012・T013・T014は並行実行可能。T020はT012〜T019と並行実行可能（別ファイル）
- Phase 4: T025はT024完了後、T028はT027完了後に実行（依存あり）。T024とT027は並行実行可能
- Foundational完了後、US1/US2/US3は別々の担当者であれば並行着手可能（ただしUS2/US3の動作確認にはUS1のデータが実用上必要）

---

## Parallel Example: Foundational

```bash
# T001, T002完了後に並行実行:
Task: "shared/types/index.ts に型を追加する"
Task: "backend/src/lib/errors.ts にエラーコードを追加する"
```

## Parallel Example: User Story 2

```bash
Task: "backend unit test: orders.ts の枠選択バリデーション・親子明細作成を検証する"
Task: "backend unit test: customer.ts の枠選択バリデーション・親子明細作成を検証する"
Task: "backend unit test: orders.ts のセットキャンセルカスケード・子明細単独拒否を検証する"
Task: "frontend: SetFrameSelectSheet.tsx を新規作成する"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Foundational を完了する
2. Phase 2: User Story 1 を完了する
3. **STOP and VALIDATE**: quickstart.md シナリオ1で独立検証する
4. 管理画面でのセット構成設定のみのMVPとしてデプロイ・デモ可能（注文フローには未反映）

### Incremental Delivery

1. Foundational → 基盤完成
2. User Story 1 追加 → 独立検証 → デプロイ/デモ（MVP）
3. User Story 2 追加 → 独立検証 → デプロイ/デモ（セットを注文可能に）
4. User Story 3 追加 → 独立検証 → デプロイ/デモ（厨房・伝票表示が完全反映）

---

## Notes

- [P] タスク = 別ファイル・依存なし
- [Story] ラベルはUser Storyへのトレーサビリティのため
- 各User Storyは独立して完結・検証可能
- テストは実装前に失敗することを確認してから実装する
- 各タスクまたは論理的なまとまりごとにコミットする
- 各チェックポイントで独立検証を行う
