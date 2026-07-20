---

description: "Task list template for feature implementation"
---

# Tasks: タップ領域サイズの不整合を解消する

**Input**: Design documents from `/specs/001-tap-target-consistency/`

**Prerequisites**: plan.md, spec.md, research.md, quickstart.md（`data-model.md`/`contracts/`は本フィーチャーでは生成していない。データエンティティ・API契約の変更がないため）

**Tests**: plan.mdでユニットテストの追加が明示的に要求されているため、各ユーザーストーリーにテストタスクを含む。

**Organization**: タスクはユーザーストーリー単位でグループ化する。各ストーリーは独立して実装・検証可能。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（別ファイル・依存関係なし）
- **[Story]**: 対応するユーザーストーリー（US1, US2, US3）
- ファイルパスは絶対パスではなくリポジトリルートからの相対パスで記載する

## Setup / Foundational フェーズについて

本フィーチャーは既存4ファイルのCSSクラス調整であり、新規インフラ・新規共有基盤は不要。各ユーザーストーリーが変更するファイルは互いに独立しているため、Setup / Foundationalフェーズは省略し、ユーザーストーリーのフェーズから開始する。

---

## Phase 1: User Story 1 - 客が自分のスマホでヘッダー操作ボタンを確実にタップできる (Priority: P1) 🎯 MVP

**Goal**: `CustomerOrder`画面の「店員を呼ぶ」「お会計」ボタンの当たり判定を44×44px以上に拡張する。

**Independent Test**: 客用注文画面の該当ボタンのタップ可能領域が44×44px以上であることを確認する。

### Tests for User Story 1 ⚠️

> **NOTE: 先にテストを書き、実装前に FAIL することを確認する**

- [ ] T001 [P] [US1] `frontend/src/pages/customer/CustomerOrder/__tests__/CustomerOrder.test.tsx`（既存テストファイルがなければ新規作成）に、「店員を呼ぶ」「お会計」ボタンのクラス名に`min-w-11 min-h-11`が含まれること、および`w-8 h-8`が含まれないことを検証するテストを追加する。

### Implementation for User Story 1

- [ ] T002 [US1] `frontend/src/pages/customer/CustomerOrder/CustomerOrder.tsx`の251行目・259行目付近、「店員を呼ぶ」「お会計」ボタンの`className`から`w-8 h-8`を`min-w-11 min-h-11`に置き換える（`flex items-center justify-center`等の他クラスは維持）。（Depends on: T001）

**Checkpoint**: この時点でUser Story 1は独立して動作・検証可能。

---

## Phase 2: User Story 2 - スタッフがタブレット/スマホでヘッダー・グループ詳細のアイコンボタンを確実にタップできる (Priority: P1)

**Goal**: `AppHeader`のハンバーガーメニュー、`GroupDetail`のQR表示・席変更ボタンの当たり判定を44×44px以上に拡張する。

**Independent Test**: AppHeaderとGroupDetail画面の該当ボタンのタップ可能領域が44×44px以上であることを確認する。

### Tests for User Story 2 ⚠️

> **NOTE: 先にテストを書き、実装前に FAIL することを確認する**

- [ ] T003 [P] [US2] `frontend/src/features/navigation/components/AppHeader/__tests__/AppHeader.test.tsx`（既存テストファイルがなければ新規作成）に、ハンバーガーメニューボタンのクラス名に`min-w-11 min-h-11`が含まれること、`w-8 h-8`が含まれないことを検証するテストを追加する。
- [ ] T004 [P] [US2] `frontend/src/pages/group/GroupDetail/__tests__/GroupDetail.test.tsx`（既存テストファイルがなければ新規作成）に、QR表示・席変更ボタンについて同様のテストを追加する。（T003とは別ファイルのため並行実行可）

### Implementation for User Story 2

- [ ] T005 [P] [US2] `frontend/src/features/navigation/components/AppHeader/index.tsx`の53行目付近、ハンバーガーメニューボタンの`className`から`w-8 h-8`を`min-w-11 min-h-11`に置き換える。（Depends on: T003）
- [ ] T006 [P] [US2] `frontend/src/pages/group/GroupDetail/GroupDetail.tsx`の314-327行目付近、QR表示・席変更ボタンの`className`から`w-8 h-8`を`min-w-11 min-h-11`に置き換える（2箇所とも）。（Depends on: T004）

**Checkpoint**: この時点でUser Story 1・2が独立して動作・検証可能。

---

## Phase 3: User Story 3 - QuantityPickerの±ボタンがZeroStartStepperと同じ当たり判定基準になる (Priority: P3)

**Goal**: `QuantityPicker`の−・＋ボタンを`ZeroStartStepper`と同じ二層構造（外側の当たり判定＋内側の視覚円）に変更し、視覚サイズを変えずに当たり判定を44×44pxへ拡張する。

**Independent Test**: `QuantityPicker`の±ボタンのタップ可能領域が44×44px以上であることを確認する。

### Tests for User Story 3 ⚠️

> **NOTE: 先にテストを書き、実装前に FAIL することを確認する**

- [ ] T007 [P] [US3] `frontend/src/components/primitives/QuantityPicker/__tests__/QuantityPicker.test.tsx`（既存テストファイルがなければ新規作成）に、−・＋ボタンの外側要素のクラス名に`min-w-11 min-h-11`が含まれること、内側の視覚要素（円）のサイズが変更前と同じ（`w-10 h-10`相当）であることを検証するテストを追加する。

### Implementation for User Story 3

- [ ] T008 [US3] `frontend/src/components/primitives/QuantityPicker/index.tsx`の−・＋ボタン（19, 27行目付近）を、`ZeroStartStepper`と同様の二層構造に変更する。外側の`<button>`（または`div`+`onClick`）に`min-w-11 min-h-11 p-0 flex items-center justify-center`を付与し、内側に既存の視覚スタイル（`w-10 h-10 rounded-full border border-line bg-white text-xl text-dim flex items-center justify-center`）を持つ`<span>`を配置する。クリックハンドラ（`dec`/`inc`）は外側要素に付与する。（Depends on: T007）

**Checkpoint**: この時点でUser Story 1・2・3すべてが独立して動作・検証可能。

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: 全ストーリーの回帰確認

- [ ] T009 [P] `pnpm --filter frontend typecheck` を実行し、型エラーがないことを確認する。
- [ ] T010 [P] `pnpm --filter frontend test` を実行し、T001/T003/T004/T007で追加したテストを含む全テストが通ることを確認する。
- [ ] T011 `specs/001-tap-target-consistency/quickstart.md` の手順に従い、視覚回帰確認（スクリーンショット比較）・隣接ボタンの重なり確認・`pnpm test:e2e`の回帰確認を行う。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (US1)**: 依存なし。単独で開始・完了できる。
- **Phase 2 (US2)**: 依存なし。Phase 1と並行して開始できる（別ファイル: `AppHeader/index.tsx`, `GroupDetail.tsx`）。
- **Phase 3 (US3)**: 依存なし。Phase 1・2と並行して開始できる（別ファイル: `QuantityPicker/index.tsx`）。
- **Phase 4 (Polish)**: Phase 1〜3のうち実施したストーリーすべてが完了した後に行う。

### User Story Dependencies

- US1・US2・US3は互いに独立（変更ファイルが重複しない）。優先度順（P1→P1→P3）に進めてもよいし、並行して進めてもよい。

### Within Each User Story

- テストを先に追加し、実装前にFAILすることを確認してから実装タスクに進む。

### Parallel Opportunities

- T001（US1）、T003・T004（US2）、T007（US3）はそれぞれ別ファイルのテスト追加であり並行実行できる。
- US1・US2・US3の実装タスク（T002 / T005-T006 / T008）は別ファイルのため、ストーリー単位で並行して進められる。
- T009・T010（Polish）は並行実行できる。

---

## Implementation Strategy

### MVP First (User Story 1 のみ)

1. Phase 1（US1: 客用画面）を完了する。
2. **STOP and VALIDATE**: User Story 1を独立して検証する。
3. 必要であればここでリリース判断する（客対応チャネルのみ先行修正するケース）。

### Incremental Delivery

1. Phase 1（US1）→ 独立検証 → リリース可能な単位。
2. Phase 2（US2）を追加 → 独立検証 → リリース可能な単位。
3. Phase 3（US3）を追加 → 独立検証 → リリース可能な単位。
4. Phase 4（Polish）で全体の回帰確認を行う。

### Codexへのハンドオフについて

`speckit-implement`は使用しない。本`tasks.md`は`.claude/skills/codex-execution`でhandoff形式に変換し、`/codex:rescue`へ委譲する（`CLAUDE.md`「speckitを使う場合」参照）。ストーリー単位（US1 / US2 / US3）でhandoffを分けることを推奨する（変更ファイルが独立しているため並列実行可能）。

---

## Notes

- [P] タスク = 別ファイル・依存関係なし
- [Story] ラベルはタスクをユーザーストーリーに対応付けるためのトレーサビリティ用
- 各ユーザーストーリーは独立して完了・検証可能であること
- 実装前にテストがFAILすることを確認する
- 論理的な区切りごとにコミットする
- 視覚サイズ（円・アイコンのサイズ）は一切変更しない
