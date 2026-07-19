# Tasks: 商品管理画面の削除操作に確認ステップを追加する

**Input**: Design documents from `/specs/001-products-delete-confirm/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md（`contracts/` は本機能では不要 — バックエンドAPI変更なし）

**Tests**: 変更対象（削除確認フローの状態遷移）に対する単体テストを含む（`CLAUDE.md` グローバル原則「テストで検証する」に基づき必須）。

**Organization**: タスクはspec.mdのユーザーストーリー（P1/P2/P3）ごとにグループ化。各ストーリーは独立して実装・テスト・検証可能。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（別ファイル・依存関係なし）
- **[Story]**: 対応するユーザーストーリー（US1/US2/US3）
- ファイルパスは絶対パスではなくリポジトリルートからの相対パスで記載

## Path Conventions

Web app構成（`frontend/` + `backend/`）。本機能は `frontend/` のみ変更する。

---

## Phase 1: Setup

**Purpose**: 3ストーリー共通で使う型定義の追加

- [ ] T001 [P] `frontend/src/pages/admin/Products/components/types.ts` に `DeleteTarget` 判別可能ユニオン型を追加する（data-model.md参照）: `export type DeleteTarget = { type: 'cat'; id: number; label: string } | { type: 'sub'; catId: number; id: number; label: string } | { type: 'product'; id: number; label: string }`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 3ストーリーすべてが依存する削除確認の状態管理とUIの骨格を用意する

**⚠️ CRITICAL**: このフェーズが完了するまでどのユーザーストーリーも着手できない

- [ ] T002 `frontend/src/pages/admin/Products/Products.tsx` に `deleteTarget` state（`useState<DeleteTarget | null>(null)`）を追加する（depends on T001）
- [ ] T003 `frontend/src/pages/admin/Products/Products.tsx` に削除確認用の `BottomSheetModal`（`@/components/composite` からimport）を追加する（depends on T002）:
  - `show={!!deleteTarget}`
  - `secondaryAction`（キャンセル）と `onClose`（オーバーレイタップ）は `deleteTarget` を `null` に戻すのみ。編集モーダルは再表示しない（spec.md FR-010）
  - `primaryAction.onClick` は `deleteTarget.type` で分岐し、`'cat'` なら `deleteCat(deleteTarget.id)`、`'sub'` なら `deleteSub(deleteTarget.catId, deleteTarget.id)`、`'product'` なら `deleteProduct(deleteTarget.id)` を呼び出した後、`deleteTarget` を `null` に戻す（既存の `deleteCat`/`deleteSub`/`deleteProduct` はロジック変更なしでそのまま呼び出す）
  - タイトルは `deleteTarget.type` で分岐し、`t('productSettings.deleteProductConfirm', { name: deleteTarget.label })` / `t('productSettings.deleteSubCategoryConfirm', { name: deleteTarget.label })` / `t('productSettings.deleteCategoryConfirm', { name: deleteTarget.label })` を使う（キー自体はT005/T008/T011で追加。未追加の間はi18nextがキー文字列をそのまま表示するのみで実行時エラーにはならない）

**Checkpoint**: 削除確認の状態管理とモーダル骨格が完成。ただしこの時点ではどの削除ボタンもまだ確認ステップに接続されておらず、既存の即時削除の挙動が維持されている（各ストーリーのタスクで1つずつ接続する）。

---

## Phase 3: User Story 1 - 商品削除時に確認ステップを挟む (Priority: P1) 🎯 MVP

**Goal**: 商品編集モーダルの「削除」ボタンから、確認ステップを経ないと商品が削除されないようにする

**Independent Test**: 商品編集モーダルを開き「削除」をタップ→確認ステップが出る→キャンセルで商品が残る／確定で商品が消えることを確認する。小分類・カテゴリ削除の実装状況に関わらず単独で検証できる。

### Tests for User Story 1 ⚠️

> 実装前にこのテストを書き、FAILすることを確認してから実装に進む

- [ ] T004 [P] [US1] `frontend/src/pages/admin/Products/Products.test.tsx`（新規作成）に商品削除確認フローのテストを書く: (1) 商品編集モーダルで「削除」をタップすると確認ステップが表示され `api.delete` がまだ呼ばれないこと、(2) 確認ステップでキャンセルすると `api.delete` が呼ばれず編集モーダルも再表示されないこと、(3) 確認ステップで確定すると `api.delete(EP.menu(id))` が呼ばれ商品が一覧から消えること

### Implementation for User Story 1

- [ ] T005 [US1] `frontend/src/i18n/locales/ja.ts` の `productSettings` 配下に `deleteProductConfirm: '{{name}} を削除しますか？'` を追加する
- [ ] T006 [US1] `frontend/src/pages/admin/Products/Products.tsx` の `editProduct` モーダルブロックにある `ProductModal` の `onDelete` を、`deleteProduct(modal.payload.id)` の直接呼び出しから `setModal(null)` に続けて `setDeleteTarget({ type: 'product', id: modal.payload.id, label: modal.payload.name })` を呼ぶよう変更する（depends on T002, T003, T005）

**Checkpoint**: User Story 1は単独で完全に機能する。商品削除には確認ステップが必須になる。カテゴリ・小分類削除はまだ従来通り確認なしの即時削除のまま。

---

## Phase 4: User Story 2 - 小分類削除時に確認ステップを挟む (Priority: P2)

**Goal**: 小分類編集モーダルの「削除」ボタンから、配下の商品も失われる旨の確認ステップを経ないと小分類が削除されないようにする

**Independent Test**: 小分類編集モーダルを開き「削除」をタップ→カスケード警告付きの確認ステップが出る→キャンセルで小分類・配下商品が残る／確定で両方消えることを確認する。商品削除（US1）の実装状況に関わらず単独で検証できる。

### Tests for User Story 2 ⚠️

- [ ] T007 [P] [US2] `frontend/src/pages/admin/Products/Products.test.tsx` に小分類削除確認フローのテストを追加する: (1) 小分類編集モーダルで「削除」をタップすると「配下の商品もすべて削除されます」を含む確認ステップが表示されること、(2) キャンセルで `api.delete` が呼ばれないこと、(3) 確定で `api.delete(EP.subcategory(id))` が呼ばれ小分類と配下商品が一覧から消えること

### Implementation for User Story 2

- [ ] T008 [US2] `frontend/src/i18n/locales/ja.ts` の `productSettings` 配下に `deleteSubCategoryConfirm: '{{name}} を削除しますか？配下の商品もすべて削除されます'` を追加する
- [ ] T009 [US2] `frontend/src/pages/admin/Products/Products.tsx` の `editSub` モーダルブロックにある `InputModal` の `onDelete` を、`deleteSub(modal.payload.cat.id, modal.payload.sub.id)` の直接呼び出しから `setModal(null)` に続けて `setDeleteTarget({ type: 'sub', catId: modal.payload.cat.id, id: modal.payload.sub.id, label: modal.payload.sub.label })` を呼ぶよう変更する（depends on T002, T003, T008）

**Checkpoint**: User Story 1・2がともに独立して機能する。

---

## Phase 5: User Story 3 - カテゴリ（大分類）削除時に確認ステップを挟む (Priority: P3)

**Goal**: カテゴリ編集モーダルの「削除」ボタンから、配下の小分類・商品も失われる旨の確認ステップを経ないとカテゴリが削除されないようにする

**Independent Test**: カテゴリ編集モーダルを開き「削除」をタップ→カスケード警告付きの確認ステップが出る→キャンセルでカテゴリ・配下小分類・配下商品が残る／確定ですべて消えることを確認する。他2ストーリーの実装状況に関わらず単独で検証できる。

### Tests for User Story 3 ⚠️

- [ ] T010 [P] [US3] `frontend/src/pages/admin/Products/Products.test.tsx` にカテゴリ削除確認フローのテストを追加する: (1) カテゴリ編集モーダルで「削除」をタップすると「配下の小分類・商品もすべて削除されます」を含む確認ステップが表示されること、(2) キャンセルで `api.delete` が呼ばれないこと、(3) 確定で `api.delete(EP.category(id))` が呼ばれカテゴリ・配下小分類・配下商品が一覧から消えること

### Implementation for User Story 3

- [ ] T011 [US3] `frontend/src/i18n/locales/ja.ts` の `productSettings` 配下に `deleteCategoryConfirm: '{{name}} を削除しますか？配下の小分類・商品もすべて削除されます'` を追加する
- [ ] T012 [US3] `frontend/src/pages/admin/Products/Products.tsx` の `editCat` モーダルブロックにある `InputModal` の `onDelete` を、`deleteCat(modal.payload.id)` の直接呼び出しから `setModal(null)` に続けて `setDeleteTarget({ type: 'cat', id: modal.payload.id, label: modal.payload.label })` を呼ぶよう変更する（depends on T002, T003, T011）

**Checkpoint**: 3つのユーザーストーリーすべてが独立して機能する。商品・小分類・カテゴリのいずれの削除も確認ステップ必須になる。

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 全ストーリー共通の検証

- [ ] T013 [P] `pnpm --filter frontend typecheck` と `pnpm --filter frontend lint` を実行し、本機能で発生した型エラー・lintエラーを修正する
- [ ] T014 [P] `pnpm --filter frontend test` を実行し、`Products.test.tsx` の全ケース（T004/T007/T010）が通ることを確認する
- [ ] T015 `specs/001-products-delete-confirm/quickstart.md` の検証シナリオ（商品・小分類・カテゴリの3種類）を手動で実行し、確認ステップが期待通り機能することを確認する。**注**: `CLAUDE.md` の分担ルールによりE2E・手動UI検証はClaude担当。Codex実行担当への委譲対象から本タスクは除外すること。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし。即着手可能
- **Foundational (Phase 2)**: Setup完了後。全ユーザーストーリーをブロックする
- **User Stories (Phase 3-5)**: Foundational完了後に着手可能。3ストーリーは互いに独立（同一ファイルへの変更のため並列実装時はコンフリクトに注意、ただし機能的には独立）
- **Polish (Phase 6)**: 実施したいユーザーストーリーすべての完了後

### User Story Dependencies

- **User Story 1 (P1)**: Foundational完了後に着手可能。他ストーリーへの依存なし
- **User Story 2 (P2)**: Foundational完了後に着手可能。US1と同じファイル（Products.tsx, ja.ts）を編集するが、コードの依存関係はない
- **User Story 3 (P3)**: Foundational完了後に着手可能。US1・US2と同じファイルを編集するが、コードの依存関係はない

### Within Each User Story

- テスト（T004/T007/T010）を先に書き、FAILすることを確認してから実装する
- i18nキー追加（T005/T008/T011）を先に行い、その後に呼び出し元の変更（T006/T009/T012）を行う

### Parallel Opportunities

- T001は単独タスクなので並列対象なし（Setup唯一のタスク）
- Foundational（T002, T003）は同一ファイル・逐次依存のため並列不可
- 各ストーリーのテストタスク（T004, T007, T010）は別ストーリー間では並列実行可能だが、同一ファイル（`Products.test.tsx`）への追記になるため、実際に複数人・複数エージェントで同時編集する場合はマージ調整が必要
- Polishの T013・T014 は並列実行可能

---

## Parallel Example: User Story 1

```bash
# User Story 1はテスト（T004）→ i18nキー追加（T005）→ 呼び出し元変更（T006）の順で実施する。
# T004とT005は異なるファイルのため並列着手可能:
Task: "商品削除確認フローのテストを frontend/src/pages/admin/Products/Products.test.tsx に書く"
Task: "productSettings.deleteProductConfirm を frontend/src/i18n/locales/ja.ts に追加する"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup（T001）完了
2. Phase 2: Foundational（T002-T003、CRITICAL）完了
3. Phase 3: User Story 1（T004-T006）完了
4. **STOP and VALIDATE**: 商品削除の確認フローを単独で検証する
5. ここまでで指摘8-1のうち最も操作頻度の高い商品削除への対応が完了する

### Incremental Delivery

1. Setup + Foundational → 基盤完成
2. User Story 1（商品削除）追加 → 単独検証 → MVP
3. User Story 2（小分類削除）追加 → 単独検証
4. User Story 3（カテゴリ削除）追加 → 単独検証
5. 各ストーリーは他ストーリーを壊さずに価値を追加する

### Codex実行担当への委譲時の注意

- T013・T014（typecheck/lint/test実行と修正）はCodex実行担当（`/codex:rescue`）に委譲する対象
- T015（quickstart.mdの手動検証）はClaude担当。Codexへの委譲スコープから除外する

---

## Notes

- [P] = 別ファイル・依存関係なしのタスク
- [US1]/[US2]/[US3] = 対応するユーザーストーリー
- 各ユーザーストーリーは独立して完了・検証可能
- 実装前にテストがFAILすることを確認する
- 各タスク（または論理的なまとまり）ごとにコミットする
- チェックポイントごとに立ち止まってストーリー単位で検証する
