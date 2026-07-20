---

description: "Task list template for feature implementation"
---

# Tasks: 数量単位・レポート単位表記のi18n集約

**Input**: Design documents from `/specs/001-report-unit-i18n/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md（`contracts/`は本フィーチャーでは生成していない。外部インターフェース契約に変更がないため）

**Tests**: 表示結果を変更しない機能のため、新規テスト追加は必須としない（research.md R4）。既存テストの回帰確認をPolishフェーズで行う。

**Organization**: タスクはユーザーストーリー単位でグループ化する。各ストーリーは独立して実装・検証可能。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（別ファイル・依存関係なし）
- **[Story]**: 対応するユーザーストーリー（US1, US2）
- ファイルパスは絶対パスではなくリポジトリルートからの相対パスで記載する

## Setup / Foundational フェーズについて

本フィーチャーは既存5ファイルへの参照方法変更と`ja.ts`への翻訳キー追加のみであり、新規インフラ・新規共有基盤は不要。US1（`common.personUnit`）とUS2（`report.hourLabel`/`report.countUnit`）は`ja.ts`内の別名前空間・別コンポーネントを触るため独立している。Setup / Foundationalフェーズは省略し、ユーザーストーリーのフェーズから開始する。

---

## Phase 1: User Story 1 - 人数単位表記が多言語対応の仕組みに乗る (Priority: P1) 🎯 MVP

**Goal**: `CourseConfirmModal.tsx`・`CourseTab.tsx`・`CreateGroupSheet.tsx`の3箇所の`QuantityPicker unit="名"`を、`common.personUnit`翻訳キー経由に置き換える。

**Independent Test**: `frontend/src/i18n/locales/ja.ts`の`common.personUnit`キーを変更し、3画面すべてで表示される単位が新しい値に切り替わることを確認する。

### Implementation for User Story 1

- [ ] T001 [US1] `frontend/src/i18n/locales/ja.ts`の`common`名前空間に`personUnit: '名'`を追加する。
- [ ] T002 [P] [US1] `frontend/src/pages/group/GroupDetail/components/CourseConfirmModal.tsx`（40行目付近）の`QuantityPicker`の`unit="名"`を`unit={t('common.personUnit')}`に置き換える（`useTranslation`が未importの場合は追加する）。（Depends on: T001）
- [ ] T003 [P] [US1] `frontend/src/pages/group/GroupDetail/components/CourseTab.tsx`（122行目付近）の同様の箇所を、T002と同じパターンで置き換える。（Depends on: T001）
- [ ] T004 [P] [US1] `frontend/src/pages/hall/Hall/components/CreateGroupSheet.tsx`（59行目付近）の同様の箇所を、T002と同じパターンで置き換える。（Depends on: T001）

**Checkpoint**: この時点でUser Story 1は独立して動作・検証可能。

---

## Phase 2: User Story 2 - 日次レポートの単位表記が多言語対応の仕組みに乗る (Priority: P2)

**Goal**: `HourlyChart.tsx`の時刻ラベル、`RankingSection.tsx`の件数表記を、`report.hourLabel`/`report.countUnit`翻訳キー経由に置き換える。

**Independent Test**: `frontend/src/i18n/locales/ja.ts`の`report.hourLabel`・`report.countUnit`キーを変更し、日次レポートの時間帯別グラフとランキングセクションの表示が新しい値に切り替わることを確認する。

### Implementation for User Story 2

- [ ] T005 [US2] `frontend/src/i18n/locales/ja.ts`の`report`名前空間に`hourLabel: '{{hour}}時'`・`countUnit: '{{qty}}件'`を追加する。
- [ ] T006 [P] [US2] `frontend/src/pages/admin/DailyReport/components/HourlyChart.tsx`（46行目付近）の`` {h.hour}時 ``を`{t('report.hourLabel', { hour: h.hour })}`に置き換える（`useTranslation`が未importの場合は追加する）。（Depends on: T005）
- [ ] T007 [P] [US2] `frontend/src/pages/admin/DailyReport/components/RankingSection.tsx`（133, 153行目付近）の`` `${item.qty}件` ``（2箇所）を`t('report.countUnit', { qty: item.qty })`に置き換える。（Depends on: T005）

**Checkpoint**: この時点でUser Story 1・2すべてが独立して動作・検証可能。

---

## Phase 3: Polish & Cross-Cutting Concerns

**Purpose**: 全ストーリーの回帰確認

- [ ] T008 [P] `pnpm --filter frontend typecheck`を実行し、型エラーがないことを確認する。
- [ ] T009 [P] `pnpm --filter frontend test`を実行し、既存テストに回帰がないこと（表示文字列が変更前と一致すること）を確認する。
- [ ] T010 [P] `pnpm --filter frontend lint`を実行し、リントエラーがないことを確認する。
- [ ] T011 `specs/001-report-unit-i18n/quickstart.md`の手順に従い、5画面すべてで表示結果に回帰がないことを手動確認する。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (US1)**: 依存なし。単独で開始・完了できる。
- **Phase 2 (US2)**: 依存なし。Phase 1と並行して開始できる（`ja.ts`内の別名前空間、別コンポーネント）。
- **Phase 3 (Polish)**: Phase 1〜2完了後に行う。

### User Story Dependencies

- US1・US2は互いに独立（変更ファイルが重複しない）。優先度順（P1→P2）に進めてもよいし、並行して進めてもよい。

### Within Each User Story

- `ja.ts`へのキー追加タスク（T001, T005）を先に行い、それに依存するコンポーネント側の置き換えタスクを後に行う。
- コンポーネント側の置き換えタスク（T002-T004, T006-T007）はそれぞれ別ファイルのため並列実行できる。

### Parallel Opportunities

- T002・T003・T004（US1）はそれぞれ別ファイルであり、T001完了後は並列実行できる。
- T006・T007（US2）はそれぞれ別ファイルであり、T005完了後は並列実行できる。
- US1一式とUS2一式は互いに独立しており、ストーリー単位で並行して進められる。
- T008・T009・T010（Polish）は並列実行できる。

---

## Parallel Example: 2ストーリー同時着手

```bash
# 各ストーリーのキー追加を並行して実施:
Task: "T001 frontend/src/i18n/locales/ja.ts に common.personUnit を追加"
Task: "T005 frontend/src/i18n/locales/ja.ts に report.hourLabel / report.countUnit を追加"
# 完了後、コンポーネント側の置き換えを並行して実施:
Task: "T002 CourseConfirmModal.tsx を置き換え"
Task: "T003 CourseTab.tsx を置き換え"
Task: "T004 CreateGroupSheet.tsx を置き換え"
Task: "T006 HourlyChart.tsx を置き換え"
Task: "T007 RankingSection.tsx を置き換え"
```

**注意**: T001とT005は同じファイル（`ja.ts`）の異なる名前空間を編集するため、完全な並列実行（同時書き込み）は避け、直列で行うか、片方を先に完了させてマージしてからもう片方を行う。

---

## Implementation Strategy

### MVP First (User Story 1 のみ)

1. Phase 1（US1: 人数単位表記）を完了する。
2. **STOP and VALIDATE**: User Story 1を独立して検証する（3画面の目視確認、`pnpm --filter frontend test`）。
3. 必要であればここでリリース判断する。

### Incremental Delivery

1. Phase 1（US1）→ 独立検証 → リリース可能な単位。
2. Phase 2（US2）を追加 → 独立検証 → リリース可能な単位。
3. Phase 3（Polish）で全体の回帰確認を行う。

### Codexへのハンドオフについて

`speckit-implement`は使用しない。本`tasks.md`は`.claude/skills/codex-execution`でhandoff形式に変換し、`/codex:rescue`へ委譲する（`CLAUDE.md`「speckitを使う場合」参照）。

---

## Notes

- [P] タスク = 別ファイル・依存関係なし（ただしT001/T005は同一ファイル`ja.ts`のため直列注意）
- [Story] ラベルはタスクをユーザーストーリーに対応付けるためのトレーサビリティ用
- 各ユーザーストーリーは独立して完了・検証可能であること
- 論理的な区切りごとにコミットする
- 表示結果（「名」「時」「件」を含む文字列）を変更しない
