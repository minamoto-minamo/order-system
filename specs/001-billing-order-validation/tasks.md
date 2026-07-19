---

description: "Task list template for feature implementation"
---

# Tasks: 会計・注文可否のサーバー側検証見直し

**Input**: Design documents from `/specs/001-billing-order-validation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-changes.md（`quickstart.md`は生成していない。開発環境セットアップ手順に変更がないため）

**Tests**: spec.md/plan.mdでユニットテストの追加が明示的に要求されているため、テストタスクを含む。

**Organization**: 本フィーチャーはUser Story 1（3-2: 飲み放題プラン部分受理）単独のスコープ。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（別ファイル・依存関係なし）
- **[Story]**: 対応するユーザーストーリー（US1）
- ファイルパスは絶対パスではなくリポジトリルートからの相対パスで記載する

## Setup / Foundational フェーズについて

本フィーチャーは既存の1ファイル（`customer.ts`）の該当ブロックのみを変更する既存機能の修正であり、新規インフラ・新規共有基盤は不要。Setup / Foundationalフェーズは省略し、ユーザーストーリーのフェーズから開始する。

---

## Phase 1: User Story 1 - 飲み放題プラン適用中の来店客が対象外商品を含む注文を送信できる (Priority: P1) 🎯 MVP

**Goal**: `POST /api/customer/orders`が、飲み放題プラン対象商品とプラン対象外商品の混在注文を全体拒否せず、対象商品0円・対象外商品通常価格で部分受理するようにする。

**Independent Test**: 飲み放題プラン適用中のグループに対し、プラン対象商品とプラン対象外商品を混在させた注文リクエストを客用APIに送信し、両方の商品が1回のリクエストで登録され、プラン対象商品のみ0円・対象外商品は通常価格になることを確認する。

### Tests for User Story 1 ⚠️

> **NOTE: 先にテストを書き、実装前に FAIL することを確認する**

- [ ] T001 [P] [US1] `backend/src/__tests__/customer.test.ts` の`POST /orders`テストに以下を追加する: (a) プラン対象商品のみの注文→全件`price: 0`で201登録されること（既存挙動の回帰確認）、(b) プラン対象外商品のみの注文→全件`originalPrice`で201登録されること、(c) プラン対象商品と対象外商品が混在する注文→拒否されず201で、対象商品は`price: 0`・対象外商品は`price: originalPrice`でそれぞれ登録されること（現状は422 `drink_plan_mismatch`で拒否されるためこの時点でFAILする）。

### Implementation for User Story 1

- [ ] T002 [US1] `backend/src/routes/customer.ts`の`POST /orders`（219-236行目付近）から、`outOfPlan`判定と`422 customer.orders.drink_plan_mismatch`を返す全体拒否ブロックを削除する。既存の価格計算ロジック（`price: isPlanItem ? 0 : originalPrice`、250-259行目付近）はそのまま維持し、`planMenuItemIds`の取得（219-226行目付近、トランザクション開始前）も変更しない。既存の`422 menu_items_not_found` / `409 sold_out` / `422 takeout_only`のバリデーション順序・挙動は変更しない。（Depends on: T001）

**Checkpoint**: この時点でUser Story 1は独立して動作・検証可能。

---

## Phase 2: Polish & Cross-Cutting Concerns

**Purpose**: 回帰確認

- [ ] T003 [P] `pnpm --filter backend typecheck` を実行し、型エラーがないことを確認する。
- [ ] T004 [P] `pnpm --filter backend test` を実行し、T001で追加したテストを含む全テストが通ることを確認する。
- [ ] T005 客用注文画面（`frontend/src/pages/customer/CustomerOrder/CustomerOrder.tsx`）を手動確認し、`drink_plan_mismatch`エラー分岐が個別処理されていないこと（汎用エラートーストのみ）を再確認する（research.md R3の前提の裏取り）。フロントエンド変更は不要。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (US1)**: 依存なし。単独で開始・完了できる。
- **Phase 2 (Polish)**: Phase 1完了後に行う。

### Within Each User Story

- テストを先に追加し、実装前にFAILすることを確認してから実装タスクに進む（T001→T002）。

### Parallel Opportunities

- T003・T004（Polish）は並行実行できる。

---

## Implementation Strategy

### MVP First (User Story 1 のみ)

1. Phase 1（US1）を完了する。
2. **STOP and VALIDATE**: User Story 1を独立して検証する（`pnpm --filter backend test`、該当テストのみ実行可）。

### Codexへのハンドオフについて

`speckit-implement`は使用しない。本`tasks.md`は`.claude/skills/codex-execution`でhandoff形式に変換し、`/codex:rescue`へ委譲する（`CLAUDE.md`「speckitを使う場合」参照）。

---

## Notes

- [P] タスク = 別ファイル・依存関係なし
- [Story] ラベルはタスクをユーザーストーリーに対応付けるためのトレーサビリティ用
- 実装前にテストがFAILすることを確認する
- 論理的な区切りごとにコミットする
- 指摘5-1（未提供注文チェック）関連のタスクは001-state-transition-race-fixのtasks.mdを参照（本フィーチャーには含まない）
