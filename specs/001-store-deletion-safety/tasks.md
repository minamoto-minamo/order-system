---

description: "Task list template for feature implementation"
---

# Tasks: 店舗削除・無効化の運用安全性（F7）

**Input**: Design documents from `/specs/001-store-deletion-safety/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md, contracts/api-changes.md

**Tests**: spec.md/plan.mdでユニットテストの追加が明示的に要求されているため、各ユーザーストーリーにテストタスクを含む。

**Organization**: タスクはユーザーストーリー単位でグループ化する。US1・US2は同一ファイル（`platformStores.ts`の`DELETE /:id`）を変更するため、US1完了後にUS2を積み上げる順で進める。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（別ファイル・依存関係なし）
- **[Story]**: 対応するユーザーストーリー（US1, US2）
- ファイルパスはリポジトリルートからの相対パスで記載する

## Setup / Foundational フェーズについて

本フィーチャーは既存の1ファイル（`platformStores.ts`）の`DELETE /:id`ハンドラのみを変更する既存機能の修正であり、新規インフラ・新規共有基盤は不要。Setup / Foundationalフェーズは省略し、ユーザーストーリーのフェーズから開始する。

---

## Phase 1: User Story 1 - 営業中の店舗を誤って削除できないようにする (Priority: P1) 🎯 MVP

**Goal**: `DELETE /api/platform/stores/:id`に、営業中セッション・アクティブなグループの存在チェックを追加し、該当する場合は削除を拒否する。判定と削除実行を不可分な操作にする。

**Independent Test**: 営業中のセッション（またはアクティブなグループ）を持つ店舗に対して削除操作を行い、削除が拒否され店舗データが削除前の状態のまま残ることを確認する。

### Tests for User Story 1 ⚠️

> **NOTE: 先にテストを書き、実装前に FAIL することを確認する**

- [x] T001 [P] [US1] `backend/src/lib/errors.ts`に`ErrorCodes.PlatformStores.ActiveDataExists`（`platform_stores.delete.active_data_exists`, 409）を追加する。
- [x] T002 [US1] `backend/src/__tests__/platformStores.test.ts`（存在しない場合は新規作成、既存の他ルートのテストファイル構成に倣う）に、`DELETE /:id`のテストケースを追加する: (a) `tx.session.count`が`1`以上を返す場合、`409/platform_stores.delete.active_data_exists`を返し、`store.delete`等のカスケード削除クエリが呼ばれないこと、店舗が`isActive: true`に復元されること、(b) `tx.group.count`（`active`/`bill_requested`）が`1`以上を返す場合も同様、(c) 両方0件の場合は既存通り`204`でカスケード削除が実行されること、(d) 対象店舗が存在しない場合は既存通り`404/platform_stores.detail.not_found`のままであること。（Depends on: T001）

### Implementation for User Story 1

- [x] T003 [US1] `backend/src/routes/platformStores.ts`の`DELETE /:id`（106-152行目付近）を変更する。既存の`store.update({ isActive: false })`（先行の非アクティブ化）はそのまま維持する。その直後の`prisma.$transaction([...])`（配列形式のバッチトランザクション）を`prisma.$transaction(async (tx) => { ... })`（インタラクティブトランザクション）に置き換える。トランザクション先頭で`tx.session.count({ where: { storeId, status: 'open' } })`と`tx.group.count({ where: { storeId, status: { in: ['active', 'bill_requested'] } } })`を実行し、いずれかが`0`より大きい場合は`ErrorCodes.PlatformStores.ActiveDataExists`（`details: { openSessionCount, activeGroupCount }`）をthrowしてロールバックする。0件の場合は既存のカスケード削除クエリ（`orderItem.deleteMany`〜`store.delete`）をこのトランザクション内で順に実行する。既存のcatch節（`isActive: true`への復元、エラーログ、rethrow）は変更せず、営業中データ検出時のエラーもこのcatch節を通す。（Depends on: T002）

**Checkpoint**: この時点でUser Story 1は独立して動作・検証可能。

---

## Phase 2: User Story 2 - データ量の多い店舗でも削除処理が失敗せず完了する (Priority: P2)

**Goal**: 削除トランザクションのタイムアウトを既定値から延長し、データ量の多い店舗でもタイムアウトによる削除失敗を防ぐ。

**Independent Test**: `pnpm --filter backend test`で、トランザクションが`timeout`オプション付きで呼ばれていることをモック検証する（実データでの大規模削除検証はquickstart.mdの手動確認に委ねる）。

### Tests for User Story 2 ⚠️

> **NOTE: 先にテストを書き、実装前に FAIL することを確認する**

- [x] T004 [US2] `backend/src/__tests__/platformStores.test.ts`に、`prisma.$transaction`が呼ばれる際の第2引数（オプション）に`{ timeout: 30_000 }`が含まれることを検証するテストを追加する。（T002と同一ファイルのため直列で追加。Depends on: T003）

### Implementation for User Story 2

- [x] T005 [US2] `backend/src/routes/platformStores.ts`の`DELETE /:id`で、T003が導入したインタラクティブトランザクション呼び出しに`{ timeout: 30_000 }`オプションを追加する（`prisma.$transaction(async (tx) => { ... }, { timeout: 30_000 })`）。（Depends on: T003, T004）

**Checkpoint**: この時点でUser Story 1・2すべてが独立して動作・検証可能。

---

## Phase 3: Polish & Cross-Cutting Concerns

**Purpose**: 全ストーリーの回帰確認

- [x] T006 [P] `pnpm --filter backend typecheck`を実行し、型エラーがないことを確認する。
- [x] T007 [P] `pnpm --filter backend test`を実行し、T002/T004で追加したテストを含む全テストが通ることを確認する。
- [ ] T008 `specs/001-store-deletion-safety/quickstart.md`の手順1〜3に従い、営業中データがある/ない店舗それぞれの削除挙動を手動確認する。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (US1)**: 依存なし。単独で開始できる。
- **Phase 2 (US2)**: Phase 1完了後に開始する（同一の`$transaction`呼び出しにオプションを追加するため、T003のインタラクティブトランザクション化が前提）。
- **Phase 3 (Polish)**: Phase 1・2完了後に行う。

### Within Each User Story

- テストを先に追加し、実装前にFAILすることを確認してから実装タスクに進む。
- T001→T002→T003→T004→T005は同一ファイル（`platformStores.ts`）への変更が積み重なるため直列で行う。

### Parallel Opportunities

- T001（エラーコード追加）は他のタスクと並行して着手できる。
- T006・T007（Polish）は並行実行できる。

---

## Implementation Strategy

### MVP First (User Story 1 のみ)

1. Phase 1（US1: 営業中データの削除ガード）を完了する。
2. **STOP and VALIDATE**: User Story 1を独立して検証する（`pnpm --filter backend test`、該当テストのみ実行可）。
3. 必要であればここでリリース判断する（Mediumの指摘のうち、データ消失リスクの高い6-1のみを先行修正するケース）。

### Incremental Delivery

1. Phase 1（US1）→ 独立検証 → リリース可能な単位。
2. Phase 2（US2）を追加 → 独立検証 → リリース可能な単位。
3. Phase 3（Polish）で全体の回帰確認を行う。

### Codexへのハンドオフについて

`speckit-implement`は使用しない。本`tasks.md`は`.claude/skills/codex-execution`でhandoff形式に変換し、`/codex:rescue`へ委譲する（`CLAUDE.md`「speckitを使う場合」参照）。US1・US2は同一ファイルへの積み上げ変更のため、1つのhandoffにまとめることを推奨する。

---

## Notes

- [P] タスク = 別ファイル・依存関係なし
- [Story] ラベルはタスクをユーザーストーリーに対応付けるためのトレーサビリティ用
- 実装前にテストがFAILすることを確認する
- 論理的な区切りごとにコミットする
- 新規エラーコードは1件のみ（`ErrorCodes.PlatformStores.ActiveDataExists`）
- force等による削除ガードの上書き手段は設けない（Clarifications参照）
- 削除確認UIの新設は本フィーチャーの対象外（Clarifications参照）
