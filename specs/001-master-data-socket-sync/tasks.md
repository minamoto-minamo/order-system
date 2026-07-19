---

description: "Task list template for feature implementation"
---

# Tasks: マスタデータ変更のSocket同期漏れ解消

**Input**: Design documents from `/specs/001-master-data-socket-sync/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md, contracts/socket-events.md

**Tests**: plan.mdでユニットテストの追加が明示的に要求されているため、各ユーザーストーリーにテストタスクを含む。

**Organization**: タスクはユーザーストーリー単位でグループ化する。各ストーリーは独立して実装・検証可能。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（別ファイル・依存関係なし）
- **[Story]**: 対応するユーザーストーリー（US1, US2）
- ファイルパスは絶対パスではなくリポジトリルートからの相対パスで記載する

## Setup / Foundational フェーズについて

本フィーチャーは既存ファイルへの追加（emit・room join・型定義・イベント購読）のみで、新規インフラは不要。共有型定義（`shared/types/index.ts`）の変更は両ユーザーストーリーに影響するため、Setupフェーズとして先に行う。

---

## Phase 0: Setup（共有型定義）

- [ ] T001 `shared/types/index.ts`の`ServerToClientEvents`に、`category:created`/`category:updated`/`category:deleted`/`subCategory:created`/`subCategory:updated`/`subCategory:deleted`を追加する（[contracts/socket-events.md](contracts/socket-events.md)参照）。`menu:soldout`の型定義自体は変更しない（配信先room拡張のみ）。
- [ ] T002 `frontend/src/lib/events.ts`の`SOCKET_EVENTS`定数に、T001で追加したイベント名を追加する（既存の`menuCreated`等と同じ命名パターン: `categoryCreated`, `categoryUpdated`, `categoryDeleted`, `subCategoryCreated`, `subCategoryUpdated`, `subCategoryDeleted`）。（Depends on: T001）

**Checkpoint**: 型定義完了後、US1・US2は並行して着手できる。

---

## Phase 1: User Story 1 - 営業中スタッフ端末へのカテゴリ・サブカテゴリ変更の即時反映 (Priority: P1) 🎯 MVP

**Goal**: カテゴリ・サブカテゴリのCRUDを、既存`menu:*`と同じパターンで`store:${storeId}`ルームへSocket配信する。ホール・キッチン・グループ詳細画面が再読み込みなしで反映する。

**Independent Test**: 2つのスタッフ端末を開いた状態で、管理画面からカテゴリ名を変更する。もう一方の画面でページ再読み込みをせずに新しいカテゴリ名が表示されれば合格。

### Tests for User Story 1 ⚠️

> **NOTE: 先にテストを書き、実装前に FAIL することを確認する**

- [ ] T003 [P] [US1] `backend/src/__tests__/categories.test.ts`に、`POST`/`PUT`/`DELETE`それぞれで`fastify.io.to('store:${storeId}').emit('category:created'|'category:updated'|'category:deleted', ...)`が正しいペイロードで呼ばれることを検証するテストを追加する（既存`menus.test.ts`のemit検証パターンに倣う）。
- [ ] T004 [P] [US1] `backend/src/__tests__/subcategories.test.ts`に、同様に`subCategory:created`/`subCategory:updated`/`subCategory:deleted`のemit検証テストを追加する。

### Implementation for User Story 1

- [ ] T005 [US1] `backend/src/routes/categories.ts`の`POST /`・`PUT /:id`・`DELETE /:id`に、既存`menus.ts`と同じパターンで`fastify.io.to(\`store:${request.storeId}\`).emit(...)`を追加する。作成・更新は変更後のエンティティ全体、削除は`categoryId`のみを渡す。（Depends on: T001, T003）
- [ ] T006 [US1] `backend/src/routes/subcategories.ts`の`POST /`・`PUT /:id`・`DELETE /:id`に、同様のパターンで`subCategory:*`のemitを追加する。（Depends on: T001, T004）
- [ ] T007 [P] [US1] `frontend/src/pages/kitchen/Kitchen/Kitchen.tsx`に`useSocketListeners`で`SOCKET_EVENTS.categoryCreated`/`categoryUpdated`/`categoryDeleted`/`subCategoryCreated`/`subCategoryUpdated`/`subCategoryDeleted`の購読を追加し、画面が保持するカテゴリ・サブカテゴリ一覧stateを更新する。カテゴリ削除時、削除されたカテゴリがアクティブタブだった場合は別カテゴリにフォールバックする（spec.md Edge Cases参照）。（Depends on: T002）
- [ ] T008 [P] [US1] `frontend/src/pages/group/GroupDetail/GroupDetail.tsx`（および子コンポーネント`MenuAdd.tsx`/`CourseTab.tsx`がカテゴリ一覧stateを個別に保持している場合はそちらも）に、T007と同様の購読・state更新・フォールバック処理を追加する。（Depends on: T002）

**Checkpoint**: この時点でUser Story 1は独立して動作・検証可能。

---

## Phase 2: User Story 2 - 客用注文画面への品切れ変更の即時反映 (Priority: P2)

**Goal**: 客用ゲスト専用の店舗共有ルーム`customer-store:${storeId}`を新設し、既存`menu:soldout`イベントの配信先に追加する。客用注文画面が再読み込みなしで品切れ変更を反映する。

**Independent Test**: 客用注文画面を開いた状態を保ったまま、スタッフ画面から対象商品を品切れに変更する。客用画面をリロードせずに品切れ表示に変わることを確認する。

### Tests for User Story 2 ⚠️

> **NOTE: 先にテストを書き、実装前に FAIL することを確認する**

- [ ] T009 [P] [US2] `backend/src/__tests__/socket.test.ts`の`group:join`テストに、joinが成功した場合（`group`が自`storeId`に属する）、`group:${groupId}`に加えて`customer-store:${storeId}`にもjoinすることを検証するケースを追加する。他店舗のグループを指定した場合はどちらにもjoinしないこと（既存の`other-store-group`テストと同様）も確認する。
- [ ] T010 [US2] `backend/src/__tests__/menus.test.ts`の品切れ更新テストに、`menu:soldout`が`store:${storeId}`に加えて`customer-store:${storeId}`にも配信されることを検証するケースを追加する。（T009と関連するが別ファイルのため並行可）

### Implementation for User Story 2

- [ ] T011 [US2] `backend/src/plugins/socket.ts`の`group:join`ハンドラ（既存の`group`検証・`group:${groupId}`join処理の直後）に、`socket.join(\`customer-store:${socket.data.storeId}\`)`を追加する。（Depends on: T009）
- [ ] T012 [US2] `backend/src/routes/menus.ts`の`menu:soldout`emit箇所（203行目付近）を、`fastify.io.to(\`store:${request.storeId}\`).to(\`customer-store:${request.storeId}\`).emit('menu:soldout', item.id, item.soldOut)`に変更する。（Depends on: T010, T011）
- [ ] T013 [US2] `frontend/src/pages/customer/CustomerOrder/CustomerOrder.tsx`（および`components/CustomerMenuList.tsx`）の既存`useSocketListeners`に`SOCKET_EVENTS.menuSoldout`の購読を追加し、対象商品の品切れ表示・カート追加可否を更新する。カート内に既に品切れ商品が入っている場合の扱いは既存の送信時チェックに委ねる（spec.md User Story 2 Acceptance Scenario 3、変更不要）。（Depends on: T002）

**Checkpoint**: この時点でUser Story 1・2すべてが独立して動作・検証可能。

---

## Phase 3: Polish & Cross-Cutting Concerns

**Purpose**: 全ストーリーの回帰確認

- [ ] T014 [P] `pnpm --filter backend typecheck && pnpm --filter frontend typecheck` を実行し、型エラーがないことを確認する。
- [ ] T015 [P] `pnpm --filter backend test && pnpm --filter frontend test` を実行し、T003/T004/T009/T010で追加したテストを含む全テストが通ることを確認する。
- [ ] T016 `specs/001-master-data-socket-sync/quickstart.md`の手順1〜4に従い、複数クライアント間の即時反映と権限境界（客用ゲストにスタッフ限定イベントが届かないこと、他店舗イベントが混入しないこと）を手動確認する。`pnpm test:e2e`で既存スイートに回帰がないことも確認する。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 0 (Setup)**: 依存なし。最初に完了させる（T001→T002）。
- **Phase 1 (US1)**: Phase 0完了後に開始。単独で完了できる。
- **Phase 2 (US2)**: Phase 0完了後、Phase 1と並行して開始できる（変更ファイルが独立: `categories.ts`/`subcategories.ts` vs `socket.ts`/`menus.ts`）。
- **Phase 3 (Polish)**: Phase 1・2完了後に行う。

### User Story Dependencies

- US1・US2はPhase 0（共有型定義）にのみ依存し、互いには依存しない。優先度順（P1→P2）に進めてもよいし、並行して進めてもよい。

### Within Each User Story

- テストを先に追加し、実装前にFAILすることを確認してから実装タスクに進む。
- T005/T006、T011/T012はそれぞれ関連する実装のため、対応するテスト（T003/T004、T009/T010）の後に着手する。

### Parallel Opportunities

- T003・T004（US1）、T009・T010（US2）はそれぞれ別ファイルのテスト追加であり並行実行できる。
- T007・T008（US1フロントエンド）は別ファイルのため並行実行できる。
- T014・T015（Polish）は並行実行できる。

---

## Parallel Example: US1・US2同時着手（Phase 0完了後）

```bash
Task: "T003 backend/src/__tests__/categories.test.ts に category:* emitのテストを追加"
Task: "T004 backend/src/__tests__/subcategories.test.ts に subCategory:* emitのテストを追加"
Task: "T009 backend/src/__tests__/socket.test.ts に customer-store join のテストを追加"
Task: "T010 backend/src/__tests__/menus.test.ts に menu:soldout 配信先拡張のテストを追加"
```

---

## Implementation Strategy

### MVP First (User Story 1 のみ)

1. Phase 0（Setup）→ Phase 1（US1: カテゴリ・サブカテゴリ配信）を完了する。
2. **STOP and VALIDATE**: User Story 1を独立して検証する（`pnpm --filter backend test`、該当テストのみ実行可）。
3. 必要であればここでリリース判断する（4-4のみを先行修正するケース）。

### Incremental Delivery

1. Phase 0 → Phase 1（US1）→ 独立検証 → リリース可能な単位。
2. Phase 2（US2）を追加 → 独立検証 → リリース可能な単位。
3. Phase 3（Polish）で全体の回帰確認を行う。

### Codexへのハンドオフについて

`speckit-implement`は使用しない。本`tasks.md`は`.claude/skills/codex-execution`でhandoff形式に変換し、`/codex:rescue`へ委譲する（`CLAUDE.md`「speckitを使う場合」参照）。Phase 0完了後、US1・US2でhandoffを分けることを推奨する（変更ファイルが独立しているため並列実行可能）。

---

## Notes

- [P] タスク = 別ファイル・依存関係なし
- [Story] ラベルはタスクをユーザーストーリーに対応付けるためのトレーサビリティ用
- 各ユーザーストーリーは独立して完了・検証可能であること
- 実装前にテストがFAILすることを確認する
- 論理的な区切りごとにコミットする
- カテゴリ・サブカテゴリの変更は客用注文画面には配信しない（spec.md Clarifications参照、スコープ外）
