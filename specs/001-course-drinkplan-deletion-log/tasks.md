---

description: "Task list template for feature implementation"
---

# Tasks: Course/DrinkPlan削除時の会計済みグループ参照消失をログに記録する

**Input**: Design documents from `/specs/001-course-drinkplan-deletion-log/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md（`contracts/`は本フィーチャーでは生成していない。外部インターフェース契約に変更がないため）

**Tests**: plan.mdでユニットテストの追加が明示的に要求されているため、各ユーザーストーリーにテストタスクを含む。

**Organization**: タスクはユーザーストーリー単位でグループ化する。各ストーリーは独立して実装・検証可能。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（別ファイル・依存関係なし）
- **[Story]**: 対応するユーザーストーリー（US1, US2）
- ファイルパスは絶対パスではなくリポジトリルートからの相対パスで記載する

## Setup / Foundational フェーズについて

本フィーチャーは既存の2ファイル（`courses.ts`, `drinkPlans.ts`）の`DELETE /:id`ハンドラのみを変更する既存機能の修正であり、新規インフラ・新規共有基盤は不要。両ユーザーストーリーが変更するファイルは互いに独立しているため、Setup / Foundationalフェーズは省略し、ユーザーストーリーのフェーズから開始する。

---

## Phase 1: User Story 1 - コース削除時に過去の会計済みグループへの参照消失を追跡可能にする (Priority: P1) 🎯 MVP

**Goal**: コース削除トランザクション内で`closed`グループの`courseId`参照件数を集計し、1件以上なら警告ログを出力する。

**Independent Test**: `closed`状態のグループが`courseId`を参照している状態でコース削除APIを呼び出し、削除が成功し、かつサーバーログに`courseId`・`storeId`・参照件数が記録されることを確認する。

### Tests for User Story 1 ⚠️

> **NOTE: 先にテストを書き、実装前に FAIL することを確認する**

- [x] T001 [P] [US1] `backend/src/__tests__/courses.test.ts`の`DELETE /:id`テストに、`tx.group.count`（`closed`グループ集計）をモックして`1`より大きい値を返すケースを追加する。`fastify.log.warn`が`{ courseId, storeId, closedGroupCount }`を含む引数で呼ばれることを検証する。
- [x] T002 [US1] 同ファイルに、`closed`グループ参照が0件のケースを追加する。当該警告ログが呼ばれないこと、既存の`referencedOrderItemCount`ログの挙動に変化がないこと、削除が成功することを検証する（回帰確認）。（T001と同一ファイルのため直列で追加）

### Implementation for User Story 1

- [x] T003 [US1] `backend/src/routes/courses.ts`の`DELETE /:id`（削除トランザクション内、既存の`referencedOrderItemCount`集計・ログの直後）に、`tx.group.count({ where: { courseId, status: 'closed' } })`を追加する。件数が1件以上なら`fastify.log.warn({ courseId, storeId: request.storeId, closedGroupCount }, 'コース削除により過去の closed グループの courseId 参照が失われます')`を出力する。削除の成否判定ロジック（`in_use`判定等）は変更しない。（Depends on: T001, T002）

**Checkpoint**: この時点でUser Story 1は独立して動作・検証可能。

---

## Phase 2: User Story 2 - 飲み放題プラン削除時も同様に会計済みグループへの参照消失を追跡可能にする (Priority: P1)

**Goal**: 飲み放題プラン削除トランザクション内で`closed`グループの`drinkPlanId`参照件数を集計し、1件以上なら警告ログを出力する。

**Independent Test**: `closed`状態のグループが`drinkPlanId`を参照している状態で飲み放題プラン削除APIを呼び出し、削除が成功し、かつサーバーログに`drinkPlanId`・`storeId`・参照件数が記録されることを確認する。

### Tests for User Story 2 ⚠️

> **NOTE: 先にテストを書き、実装前に FAIL することを確認する**

- [x] T004 [P] [US2] `backend/src/__tests__/drinkPlans.test.ts`の`DELETE /:id`テストに、`tx.group.count`（`closed`グループ集計）をモックして`1`より大きい値を返すケースを追加する。`fastify.log.warn`が`{ drinkPlanId, storeId, closedGroupCount }`を含む引数で呼ばれることを検証する。
- [x] T005 [US2] 同ファイルに、`closed`グループ参照が0件のケースを追加する。当該警告ログが呼ばれないこと、既存の`referencedOrderItemCount`ログ・`referencedCourse`チェックの挙動に変化がないこと、削除が成功することを検証する（回帰確認）。（T004と同一ファイルのため直列で追加）

### Implementation for User Story 2

- [x] T006 [US2] `backend/src/routes/drinkPlans.ts`の`DELETE /:id`（削除トランザクション内、既存の`referencedOrderItemCount`集計・ログの直後、`course.delete`実行前）に、`tx.group.count({ where: { drinkPlanId, status: 'closed' } })`を追加する。件数が1件以上なら`fastify.log.warn({ drinkPlanId, storeId: request.storeId, closedGroupCount }, '飲み放題プラン削除により過去の closed グループの drinkPlanId 参照が失われます')`を出力する。削除の成否判定ロジック（`in_use`判定、`referencedCourse`チェック等）は変更しない。（Depends on: T004, T005）

**Checkpoint**: この時点でUser Story 1・2すべてが独立して動作・検証可能。

---

## Phase 3: Polish & Cross-Cutting Concerns

**Purpose**: 全ストーリーの回帰確認

- [x] T007 [P] `pnpm --filter backend typecheck`を実行し、型エラーがないことを確認する。
- [x] T008 [P] `pnpm --filter backend test`を実行し、T001/T002/T004/T005で追加したテストを含む全テストが通ることを確認する。
- [ ] T009 `specs/001-course-drinkplan-deletion-log/quickstart.md`の「2. 手動確認」「3. 回帰確認」の手順に従い、可能な範囲で手動確認する。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (US1)**: 依存なし。単独で開始・完了できる。
- **Phase 2 (US2)**: 依存なし。Phase 1と並行して開始できる（別ファイル: `drinkPlans.ts`）。
- **Phase 3 (Polish)**: Phase 1〜2完了後に行う。

### User Story Dependencies

- US1・US2は互いに独立（変更ファイルが重複しない: `courses.ts` / `drinkPlans.ts`）。並行して進められる。

### Within Each User Story

- テストを先に追加し、実装前にFAILすることを確認してから実装タスクに進む。
- 同一ファイルへの複数タスク（T001→T002、T004→T005）は直列で行う。

### Parallel Opportunities

- T001（US1）とT004（US2）はそれぞれ別ファイルのテスト追加であり並行実行できる。
- US1・US2の実装タスク（T003 / T006）は別ファイルのため並行して進められる。
- T007・T008（Polish）は並行実行できる。

---

## Parallel Example: 2ストーリー同時着手

```bash
# 各ストーリーのテストを並行して追加:
Task: "T001 backend/src/__tests__/courses.test.ts に closed グループ参照ログのケースを追加"
Task: "T004 backend/src/__tests__/drinkPlans.test.ts に closed グループ参照ログのケースを追加"
```

---

## Implementation Strategy

### MVP First (User Story 1 のみ)

1. Phase 1（US1: コース削除）を完了する。
2. **STOP and VALIDATE**: User Story 1を独立して検証する（`pnpm --filter backend test`、該当テストのみ実行可）。

### Incremental Delivery

1. Phase 1（US1）→ 独立検証 → リリース可能な単位。
2. Phase 2（US2）を追加 → 独立検証 → リリース可能な単位。
3. Phase 3（Polish）で全体の回帰確認を行う。

### Codexへのハンドオフについて

`speckit-implement`は使用しない。本`tasks.md`は`.claude/skills/codex-execution`でhandoff形式に変換し、`/codex:rescue`へ委譲する（`CLAUDE.md`「speckitを使う場合」参照）。ストーリー単位（US1 / US2）でhandoffを分けることを推奨する（変更ファイルが独立しているため並列実行可能）。

---

## Notes

- [P] タスク = 別ファイル・依存関係なし
- [Story] ラベルはタスクをユーザーストーリーに対応付けるためのトレーサビリティ用
- 各ユーザーストーリーは独立して完了・検証可能であること
- 実装前にテストがFAILすることを確認する
- 論理的な区切りごとにコミットする
- 削除の成否判定ロジック・エラーコード体系は変更しない
