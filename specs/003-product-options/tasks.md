---

description: "Task list for 商品オプション機能"
---

# Tasks: 商品オプション機能

**Input**: Design documents from `/specs/003-product-options/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/menu-options.md, quickstart.md（すべて完了済み）

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

- [x] T001 `backend/prisma/schema.prisma` に `ProductOptionGroup` / `ProductOptionChoice` / `OrderItemOption` モデルを追加し、`Store`/`MenuItem`/`OrderItem` に逆リレーションを追加する（[data-model.md](./data-model.md) の Prisma schema 追記イメージを反映）
- [x] T002 `pnpm --filter backend db:migrate` でマイグレーションを生成・適用する（T001完了後）
- [x] T003 [P] `shared/types/index.ts` に `ProductOptionGroup` / `ProductOptionChoice` / `OrderItemOption` / `UpsertProductOptionGroupRequest` / `UpsertProductOptionChoiceRequest` 型を追加し、`MenuItem`（`optionGroups`）、`OrderItem`（`options`）、`UpsertMenuItemRequest`（`optionGroups`）、`OrderItemInput`（`selectedChoiceIds`）を拡張する（[contracts/menu-options.md](./contracts/menu-options.md) 参照）
- [x] T004 [P] `backend/src/lib/errors.ts` の `ErrorCodes.Orders` と `ErrorCodes.Customer` の両方に、それぞれの既存命名パターンに倣って `invalidOptionChoice` / `duplicateOptionGroupSelection` / `missingRequiredOption` 相当のコードを追加する（customer.ts側は客用ゲスト向けエンドポイントでも同じバリデーションを行うため、`ErrorCodes.Orders`とは別に`ErrorCodes.Customer`にも追加する。T013で両方使用）

**Checkpoint**: DBスキーマ・共有型・エラーコードが揃い、各User Storyの実装に着手できる

---

## Phase 2: User Story 1 - 管理者が商品にオプションを設定する (Priority: P1) 🎯 MVP

**Goal**: 管理画面で商品にオプション分類・選択肢（必須/任意、追加金額）を作成・編集・削除できる

**Independent Test**: 管理画面で商品に1つのオプション分類と2つ以上の選択肢（うち1つは追加課金あり）を設定し、保存後に商品詳細で内容が再表示されることを確認する

### Tests for User Story 1

- [x] T005 [P] [US1] backend unit test: `POST /menus` / `PUT /menus/:id` に `optionGroups` を含めた場合の全置換保存（作成・更新・削除の反映）を検証するテストを `backend/src/routes/menus.test.ts` に追加する

### Implementation for User Story 1

- [x] T006 [US1] `backend/src/lib/mappers.ts` の `toMenuItem`（または相当関数）に `optionGroups`（`choices`含む）のマッピングを追加する（`toCourse`の`foodItems`マッピングパターン踏襲）
- [x] T007 [US1] `backend/src/routes/menus.ts` の `createBodySchema` / `updateBodySchema`（JSON Schema）に `optionGroups` 配列（`name`, `required`, `sort`, `choices: [{name, extraPrice, sort}]`）を追加する
- [x] T008 [US1] `backend/src/routes/menus.ts` の `POST /menus` / `PUT /menus/:id` に `optionGroups` の nested write（`deleteMany` + `create` の全置換、`courses.ts:145-150`パターン踏襲）を実装する（T006, T007に依存）
- [x] T009 [P] [US1] frontend: オプション分類・選択肢の追加・編集・削除フォームコンポーネントを新規作成する（`frontend/src/pages/admin/Products/OptionGroupEditor.tsx`）。分類の追加・削除、各分類内の選択肢（名前・追加金額）の追加・削除、必須/任意トグルを持つ
- [x] T010 [US1] `frontend/src/pages/admin/Products/ProductModal.tsx` に T009のコンポーネントを組み込み、保存時に `optionGroups` を `UpsertMenuItemRequest` に含めてAPI呼び出しする（T009に依存）

**Checkpoint**: 管理画面でオプション分類・選択肢の設定が完結し、独立して検証可能（[quickstart.md](./quickstart.md) シナリオ1）

---

## Phase 3: User Story 2 - スタッフ・客が注文時にオプションを選択する (Priority: P2)

**Goal**: 注文画面でオプション付き商品を選ぶとオプション分類ごとに選択肢を提示し、選択内容が注文明細・金額に反映される

**Independent Test**: オプション設定済みの商品を注文し、追加課金選択肢を選んだ場合に注文明細の金額が「商品価格＋追加金額」になることを確認する

**重要**: 注文作成APIは `backend/src/routes/orders.ts`（スタッフ用 `POST /orders`）と `backend/src/routes/customer.ts`（客用ゲスト向け `POST /orders`、`customer.ts:189`）の2経路が独立実装されており、価格スナップショットロジックがそれぞれに重複している（共通関数化はされていない）。spec.mdのUser Story 2は「注文画面（ホール/客用）」の両方が対象のため、以下のバリデーション・価格計算・`OrderItemOption`作成は**両ファイルに同様に実装する**。

### Tests for User Story 2

- [x] T011 [P] [US2] backend unit test: `POST /orders`（スタッフ用）の選択肢実在性チェック・択一制約違反（`duplicateOptionGroupSelection`）・必須未選択（`missingRequiredOption`）・価格計算（0円下限クランプ、マイナス値許容）を検証するテストを `backend/src/routes/orders.test.ts` に追加する
- [x] T011b [P] [US2] backend unit test: `customer.ts` の `POST /orders`（客用ゲスト向け）についてT011と同内容を検証するテストを `backend/src/routes/customer.test.ts` に追加する

### Implementation for User Story 2

- [x] T012 [US2] `backend/src/routes/orders.ts` の `createBodySchema` と `backend/src/routes/customer.ts` の `createOrderBodySchema` の両方に `items[].selectedChoiceIds` を追加する
- [x] T013 [US2] `backend/src/routes/orders.ts` と `backend/src/routes/customer.ts` の両方に、選択肢の実在性・対象商品所属チェック、同一`ProductOptionGroup`内の択一制約チェック、`required: true`分類の必須網羅チェックを追加する（[contracts/menu-options.md](./contracts/menu-options.md) の「POST /orders」節参照、T004・T012に依存。customer.ts側は既存の`ErrorCodes.Customer`グループに倣ったエラーコードを使う）
- [x] T014 [US2] `backend/src/routes/orders.ts`（`orders.ts:189-198`パターン）と `backend/src/routes/customer.ts`（`customer.ts:260-289`パターン）両方の`OrderItem`作成処理に、`price = originalPrice + Σ選択肢extraPrice`（0円未満は0円クランプ）の計算と、同一トランザクション内での`OrderItemOption`作成（`groupName`/`choiceName`/`extraPrice`スナップショット）を追加する（T013に依存）
- [x] T015 [US2] `backend/src/lib/mappers.ts` の`toOrderItem`（または相当関数、orders.ts/customer.ts共通で使用）に`options`マッピングを追加する
- [x] T016 [P] [US2] frontend: オプション選択ボトムシートコンポーネントを新規作成する（`frontend/src/features/order/components/OptionSelectSheet.tsx`、既存`BottomSheetModal`を使用。分類ごとに択一選択、必須分類が未選択の間は確定不可）
- [x] T017 [US2] `frontend/src/pages/group/GroupDetail/components/MenuAdd.tsx` に、オプション分類を持つ商品タップ時にT016のボトムシートを挟む導線を追加する（T016に依存）
- [x] T018 [US2] `frontend/src/pages/customer/CustomerOrder/components/CustomerMenuList.tsx` に同様の導線を追加する（T016に依存）
- [x] T019 [US2] 注文確定時のリクエストに`selectedChoiceIds`を含める処理を、`MenuAdd.tsx`/`CustomerMenuList.tsx`双方の注文確定処理（`MenuConfirmModal`呼び出し元）に追加する（T017, T018に依存）

**Checkpoint**: 注文時のオプション選択と金額反映が完結し、US1と独立して検証可能（[quickstart.md](./quickstart.md) シナリオ2・4）

---

## Phase 4: User Story 3 - 選択したオプションが厨房・会計に正しく反映される (Priority: P3)

**Goal**: 厨房の調理チケットにオプション名が表示され、会計画面の合計金額にオプション追加分が正しく含まれる

**Independent Test**: オプション付きの商品を注文し、厨房画面にオプション名が表示されること、会計画面の合計金額にオプション追加分が含まれることを確認する

### Implementation for User Story 3

- [x] T020 [US3] `frontend/src/pages/kitchen/Kitchen/components/TicketCard.tsx` に、`OrderItem.options`（選択されたオプション名）を商品名と併記する表示を追加する
- [x] T021 [P] [US3] frontend unit test: T020の表示コンポーネントがオプション名を正しく表示することを検証するテストを追加する
- [x] T022 [US3] `frontend/src/pages/group/GroupDetail/components/BillFooter.tsx` の合計金額計算が`OrderItem.price`（オプション加算済み）をそのまま合算しており、追加のロジック変更が不要であることを確認する（変更不要な場合はコード変更なしでチェックのみ、追加ロジックが必要と判明した場合はここに実装を追加する）→ 確認済み。`calculateTaxTotals`（`lib/taxTotals.ts`）は`i.price`をそのまま合算しており、`price`は`orders.ts`/`customer.ts`側で既にオプション加算済みの値のため変更不要

**Checkpoint**: 厨房表示・会計金額の反映が完結し、全User Storyが独立して検証可能（[quickstart.md](./quickstart.md) シナリオ3・5）

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 全Storyを跨ぐ検証・後片付け

- [x] T023 `pnpm typecheck` を実行し、frontend/backend/sharedすべてで型エラーがないことを確認する
- [x] T024 `pnpm lint` を実行し、Biomeのリントエラーがないことを確認する（003-product-options変更ファイルは`npx biome check`で個別確認済み。リポジトリ全体には本機能と無関係な既存lintエラーが別途あるため対象外）
- [x] T025 `pnpm test` を実行し、T005・T011・T021のテストを含む全単体テストが通ることを確認する
- [x] T026 [quickstart.md](./quickstart.md) のシナリオ1〜5をe2eで手動検証する（Claude側で実行）→ シナリオ1は既存e2e（`e2e/s06-product-settings.spec.ts`）で10/10通過確認済み。シナリオ2〜5はChromiumヘッドレスで一時検証テストを実行し全通過（必須未選択で確定不可／追加課金の金額反映／マイナス値の0円クランプ／厨房チケットへのオプション名表示と会計合計反映／オプション分類削除後も過去注文明細が不変であること）。検証用一時ファイルは確認後に削除済み

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: 依存なし。最初に着手し、完了後に全User Storyがブロック解除される
- **User Story 1 (Phase 2)**: Foundational完了後に着手可能。他Storyへの依存なし
- **User Story 2 (Phase 3)**: Foundational完了後に着手可能。管理画面で作成したオプションを注文するため実運用上はUS1完了後に検証するが、実装自体はUS1のコードに依存しない（DBに直接オプションを投入すれば独立実装・検証できる）
- **User Story 3 (Phase 4)**: Foundational完了後に着手可能。表示側のみのため他Storyの実装コードに依存しないが、動作確認にはUS1・US2で作られたデータが必要
- **Polish (Phase 5)**: 全Story完了後

### Within Each User Story

- Tests → Backendモデル/マッピング → Backend API → Frontend

### Parallel Opportunities

- Phase 1: T003, T004は並行実行可能（T001, T002はスキーマ変更のため直列）
- Phase 2: T005とT009は並行実行可能
- Phase 3: T011とT016は並行実行可能
- Phase 4: T021はT020と並行実行可能（別ファイル）
- Foundational完了後、US1/US2/US3は別々の担当者であれば並行着手可能（ただしUS2/US3の動作確認にはUS1のデータが実用上必要）

---

## Parallel Example: Foundational

```bash
# T001, T002完了後に並行実行:
Task: "shared/types/index.ts に型を追加する"
Task: "backend/src/lib/errors.ts にエラーコードを追加する"
```

## Parallel Example: User Story 1

```bash
Task: "backend unit test: menus.ts の optionGroups 全置換保存を検証する"
Task: "frontend: OptionGroupEditor.tsx を新規作成する"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Foundational を完了する
2. Phase 2: User Story 1 を完了する
3. **STOP and VALIDATE**: quickstart.md シナリオ1で独立検証する
4. 管理画面でのオプション設定のみのMVPとしてデプロイ・デモ可能（注文フローには未反映）

### Incremental Delivery

1. Foundational → 基盤完成
2. User Story 1 追加 → 独立検証 → デプロイ/デモ（MVP）
3. User Story 2 追加 → 独立検証 → デプロイ/デモ（注文でオプション選択可能に）
4. User Story 3 追加 → 独立検証 → デプロイ/デモ（厨房・会計表示が完全反映）

---

## Notes

- [P] タスク = 別ファイル・依存なし
- [Story] ラベルはUser Storyへのトレーサビリティのため
- 各User Storyは独立して完結・検証可能
- テストは実装前に失敗することを確認してから実装する
- 各タスクまたは論理的なまとまりごとにコミットする
- 各チェックポイントで独立検証を行う
