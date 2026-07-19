# Tasks: デザイントークンのコントラストをWCAG AA基準に合わせて改善する

**Input**: Design documents from `/specs/001-color-contrast-aa/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: 本フィーチャーは既存プロジェクトのテスト慣習（`frontend/src/__tests__/`配下、レンダリング結果の`className`にトークンクラスが含まれることをアサーションする方式。例: `noticeAndStepper.test.tsx`）に倣い、各ユーザーストーリーに軽量なユニットテストを含める。

**Organization**: ユーザーストーリー単位（spec.mdのUser Story 1 / User Story 2）でタスクをグループ化。両ストーリーは異なるファイルを扱うため独立して実装・検証できる。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並行実行可能（別ファイル・依存なし）
- **[Story]**: 対応するユーザーストーリー（US1 / US2）
- 各タスクに絶対ではなくリポジトリルート相対の正確なファイルパスを含む

## Path Conventions

Web app構成（`frontend/`, `backend/`）のうち、本フィーチャーは `frontend/` のみを対象とする。Setup/Foundationalフェーズは新規プロジェクト初期化・共有インフラ構築を伴わないため省略し、User Story 1（P1）から開始する。

---

## Phase 1: User Story 1 - テイクアウト注文確定ボタンの文言を読み取れる (Priority: P1) 🎯 MVP

**Goal**: `BaseButton`の`takeout`バリアントを、白文字＋アンバー背景（コントラスト比約2.15:1）から、既存の`amber-bg`/`amber-border`/`amber-fg`トークンを使った配色（コントラスト比約6.73:1）に変更する。新規CSS変数の追加は不要。

**Independent Test**: `frontend/src/components/primitives/button/BaseButton.tsx`に`variant="takeout"`を渡してレンダリングし、`className`に`bg-amber-bg`・`border-amber-border`・`text-amber-fg`が含まれ、`bg-amber`・`text-white`が含まれないことを確認する。他タスク（Phase 2）に依存せず単独で実装・検証・リリースできる。

### Tests for User Story 1

- [ ] T001 [P] [US1] `frontend/src/__tests__/`配下に`BaseButton.test.tsx`を新規作成し、`variant="takeout"`でレンダリングした`button`要素の`className`が`bg-amber-bg`・`border-amber-border`・`text-amber-fg`を含み、`bg-amber`（背景の原色トークン）・`text-white`を含まないことを検証するテストを書く（実装前はfailする）。既存の`primary`/`danger`バリアントについては、`bg-brand`/`bg-danger`のクラスが変更されていないことも合わせて確認するアサーションを1件追加する（回帰防止）。

### Implementation for User Story 1

- [ ] T002 [US1] `frontend/src/components/primitives/button/BaseButton.tsx`の`VARIANT_CLASSES.takeout`を`'bg-amber text-white border-none'`から`'bg-amber-bg border border-amber-border text-amber-fg'`に変更する（depends on T001 がfailすることの確認後）。他のバリアント（primary/secondary/ghost/danger）の値は変更しない。
- [ ] T003 [US1] `pnpm --filter frontend test -- BaseButton`（または該当テストファイル名）を実行し、T001のテストがpassすることを確認する。

**Checkpoint**: この時点でテイクアウトボタンの配色修正は独立して完結し、動作確認可能。

---

## Phase 2: User Story 2 - 注文ステータスバッジの状態を読み取れる (Priority: P2)

**Goal**: `order-pending`/`order-ready`バッジの文字色を、専用の濃色トークン（`order-pending-fg` = `#8c5000`、`order-ready-fg` = `#8c4d04`）に差し替え、コントラスト比を約3.08:1/約2.86:1から約5.62:1/約5.93:1に改善する。

**Independent Test**: `frontend/src/pages/group/GroupDetail/components/OrderStatusBadge.tsx`に`status="pending"`/`status="ready"`を渡してレンダリングし、`className`にそれぞれ`text-order-pending-fg`/`text-order-ready-fg`が含まれ、`text-order-pending`/`text-order-ready`（旧・輝度不足の文字色クラス）が含まれないことを確認する。Phase 1とは別ファイル・別トークンの変更であり、単独で実装・検証・リリースできる。

### Tests for User Story 2

- [ ] T004 [P] [US2] `frontend/src/pages/group/GroupDetail/components/`配下（既存のテスト配置慣習に合わせて`frontend/src/__tests__/`でも可）に`OrderStatusBadge.test.tsx`を新規作成し、`status="pending"`で`text-order-pending-fg`を含み`text-order-pending`（文字色としての利用）を含まないこと、`status="ready"`で`text-order-ready-fg`を含み`text-order-ready`（文字色としての利用）を含まないことを検証するテストを書く（実装前はfailする）。`served`/`cancelled`の`text-muted`クラスが変更されていないことも確認するアサーションを1件追加する（回帰防止）。

### Implementation for User Story 2

- [ ] T005 [P] [US2] `frontend/src/styles/tailwind.css`の`/* ── Order: 注文ステータスバッジ ── */`ブロック（56-60行目付近）に以下の2行を追加する:
  ```css
  --color-order-pending-fg: #8c5000;
  --color-order-ready-fg: #8c4d04;
  ```
  既存の`--color-order-pending`/`--color-order-pending-bg`/`--color-order-ready`/`--color-order-ready-bg`の値は変更しない。
- [ ] T006 [US2] `frontend/src/pages/group/GroupDetail/components/OrderStatusBadge.tsx`の`STATUS`定義を変更する（depends on T005）:
  - `pending.cls`: `'text-order-pending bg-order-pending-bg border-order-pending/60'` → `'text-order-pending-fg bg-order-pending-bg border-order-pending/60'`
  - `ready.cls`: `'text-order-ready   bg-order-ready-bg   border-order-ready/60'` → `'text-order-ready-fg   bg-order-ready-bg   border-order-ready/60'`
  - 背景色（`bg-*`）・枠線色（`border-*`）のクラスは変更しない（文字色のみ差し替え）。`served`/`cancelled`のブロックは変更しない。
- [ ] T007 [US2] `pnpm --filter frontend test -- OrderStatusBadge`（または該当テストファイル名）を実行し、T004のテストがpassすることを確認する。

**Checkpoint**: User Story 1・2 いずれも独立して機能する状態になる。

---

## Phase 3: Polish & Cross-Cutting Concerns

**Purpose**: 複数ストーリーにまたがるドキュメント整合性・最終検証

- [ ] T008 [P] `frontend/CLAUDE.md`の「セマンティックカラートークン表」の`order`行を更新する。現行の `order | \`order-pending\` / \`-bg\` / \`order-ready\` / \`-bg\` | 注文ステータスバッジ` を `order | \`order-pending\` / \`-bg\` / \`-fg\` / \`order-ready\` / \`-bg\` / \`-fg\` | 注文ステータスバッジ` に変更し、新設した`-fg`トークンをドキュメントに反映する。
- [ ] T009 `pnpm --filter frontend typecheck` と `pnpm --filter frontend lint` を実行し、エラーがないことを確認する。
- [ ] T010 `specs/001-color-contrast-aa/quickstart.md`の手順に従い、テイクアウトボタン・注文ステータスバッジ（pending/ready）の見た目を目視確認する。既存の`amber-bg`/`amber-fg`/`amber-border`利用箇所（`Kitchen/SidePanel.tsx`の`complete-btn`、`Toast`のdefaultバリアント等）に見た目の変化がないことも確認する。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1（User Story 1, P1）**: 依存なし。即座に着手可能。
- **Phase 2（User Story 2, P2）**: 依存なし（Phase 1とは別ファイル）。Phase 1と並行して着手可能。
- **Phase 3（Polish）**: Phase 1・2の完了後に着手する（T008はPhase 2完了後、T009・T010は両方の完了後が望ましい）。

### User Story Dependencies

- **User Story 1（P1）**: 他ストーリーへの依存なし。単独でMVPとしてリリース可能。
- **User Story 2（P2）**: 他ストーリーへの依存なし。単独でリリース可能。

### Within Each User Story

- テストを先に書き、実装前にfailすることを確認してから実装する（T001→T002→T003、T004→T005→T006→T007）。
- T005（トークン追加）はT006（コンポーネント変更）より先に完了させる。

### Parallel Opportunities

- T001（US1テスト）とT004（US2テスト）は並行して着手可能（別ファイル）。
- T002（US1実装）とT005（US2のトークン追加）は並行して着手可能（別ファイル）。
- T008（ドキュメント更新）はT001-T007と並行して着手可能（別ファイル）。

---

## Parallel Example

```bash
# Phase 1とPhase 2のテストを同時に着手:
Task: "BaseButton.test.tsx でtakeoutバリアントのクラスを検証（T001）"
Task: "OrderStatusBadge.test.tsx でpending/readyのクラスを検証（T004）"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1（T001-T003）を完了する。
2. テイクアウトボタンの配色修正のみを先行リリース可能。

### Incremental Delivery

1. Phase 1（US1）→ 独立して検証・リリース（MVP）。
2. Phase 2（US2）→ 独立して検証・リリース。
3. Phase 3（Polish）→ ドキュメント整合性確認・最終検証。

---

## Notes

- [P] tasks = 別ファイル・依存なし。
- 本フィーチャーはデータモデル変更・API変更・Socket.ioイベント変更を含まないため、それらに関するタスクは生成していない。
- 各タスク完了ごとにコミットする運用を推奨する（Codex実行時は`.claude/skills/codex-execution`のhandoff単位に従う）。
- 対象外（スコープ外、変更しない）: `amber`/`bill`/`danger`など他の意味色グループの値、`order-pending`/`order-ready`/`order-pending-bg`/`order-ready-bg`の値そのもの、ダークモード対応。
