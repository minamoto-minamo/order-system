---

description: "Task list template for feature implementation"
---

# Tasks: コース人数変更時の手動追加注文保護

**Input**: Design documents from `specs/001-course-qty-overwrite-fix/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/orders-post.md, quickstart.md

**Tests**: バグ修正のため、テストファースト（失敗するテストを先に書き、実装で通す）で進める。

**Organization**: ユーザーストーリー（spec.md）ごとにグループ化。実装対象は3ファイルのみ（`backend/src/routes/orders.ts` / `backend/src/lib/errors.ts` / `backend/src/__tests__/orders.test.ts`）。`backend/src/routes/groups.ts` は変更しない（確認のみ）。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並行実行可能（異なるファイル、依存関係なし）。同一ファイルを変更するタスクには付けない。
- **[Story]**: 対応するユーザーストーリー（US1, US2）
- 各タスクに正確なファイルパスを含む

## Path Conventions

Web app（`backend/` + `frontend/`）。本フィーチャーは `backend/` のみを変更する。

---

## Phase 1: Setup

**Purpose**: 前提確認（新規依存追加・スキーマ変更はなし）

- [ ] T001 [P] `backend/src/routes/groups.ts` の `PUT /:id/course`（692-727行目付近）を読み、本フィーチャーで変更が不要であることを確認する。方式B（`POST /orders` 側での禁止）採用により、このハンドラが再計算対象とする明細（`courseId === group.courseId && isCourseCharge === false && menuItemId が course.foodItems に含まれる`）は、T006 実装後は常にコース適用時の自動生成明細のみになる。コード変更は行わない（確認結果に矛盾があれば実装に進まず報告する）。

---

## Phase 2: Foundational（全ストーリーの前提）

**Purpose**: 新規エラーコードの追加。US1・US2 双方の実装が依存する。

**⚠️ CRITICAL**: このフェーズ完了までユーザーストーリーの実装（テスト作成は除く）に着手しない。

- [ ] T002 `backend/src/lib/errors.ts` の `ErrorCodes.Orders` に `CourseFoodItemConflict: 'orders.create.course_food_item_conflict'` を追加する。既存の命名規約（`orders.<action>.<snake_case_reason>`）・既存エントリの並び順（`CourseNotFound` / `CourseMismatch` の近く）に倣う。

**Checkpoint**: `pnpm --filter backend typecheck` が通る（新規エラーコードのみ追加、他への影響なし）。

---

## Phase 3: User Story 1 - 追加注文を巻き込まない人数変更 (Priority: P1) 🎯 MVP

**Goal**: コース適用中グループへの `courseId` 付き・コース内商品と同一メニューの追加注文を、作成時点で拒否する。これにより `PUT /:id/course` が巻き込んで上書きする曖昧な明細が新規に発生しなくなる。

**Independent Test**: `POST /orders` に `courseId` とコース内商品と同一の `menuItemId` を指定したリクエストを送り、422 `orders.create.course_food_item_conflict` が返り明細が作成されないことを確認する（`contracts/orders-post.md` 参照）。

### Tests for User Story 1 ⚠️

> **NOTE: 先にこれらのテストを書き、実装前に FAIL することを確認する**

- [ ] T003 [US1] `backend/src/__tests__/orders.test.ts` に失敗するテストを追加する: `courseId` を指定し、`items` に対象コースの `foodItems` に含まれる `menuItemId` を持つ item を含めて `POST /orders` を呼ぶと、422・`ErrorCodes.Orders.CourseFoodItemConflict`（`orders.create.course_food_item_conflict`）が返り、`prisma.$transaction`（= `mockTransaction`）が呼ばれない（＝明細が作成されない）ことを検証する。既存の `mockCourseFindFirst` に `foodItems: [{ menuItemId: ... }]` を含めて返すようモックする。
- [ ] T004 [US1] `backend/src/__tests__/orders.test.ts` に回帰テストを追加する: `courseId` を指定せず（`undefined`/省略）、コース内商品と同一の `menuItemId` を持つ item で `POST /orders` を呼ぶと、従来通り201相当で成功し明細が作成されることを検証する（現行フロントエンドの通常経路が壊れないことの確認）。
- [ ] T005 [US1] `backend/src/__tests__/orders.test.ts` に境界テストを追加する: `courseId` を指定し、その `foodItems` に含まれない `menuItemId` の item で `POST /orders` を呼ぶと、従来通り成功することを検証する（新規バリデーションがコース外商品に影響しないことの確認）。

### Implementation for User Story 1

- [ ] T006 [US1] `backend/src/routes/orders.ts` の `POST /orders` ハンドラに、コース内商品と `courseId` 付き items の衝突チェックを実装する。配置位置は既存の `courseId` 存在チェック（127-139行目付近、`course` を `foodItems` include 済みで取得している箇所）の直後、トランザクション開始前。`body.courseId != null` かつ `body.items` のいずれかの `menuItemId` が `course.foodItems` の `menuItemId` 一覧に含まれる場合、`sendError(reply, 422, ErrorCodes.Orders.CourseFoodItemConflict, ...)` でリクエスト全体を拒否する（部分成功はさせない）。`contracts/orders-post.md` の実行順序・レスポンス形式に従う。T002・T003-T005 に依存。

**Checkpoint**: `pnpm --filter backend test -- orders.test.ts` を実行し、T003 が新たに成功し、T004・T005 が引き続き成功することを確認する。

---

## Phase 4: User Story 2 - 会計金額の整合性確認 (Priority: P2)

**Goal**: User Story 1 で保護された追加注文明細が、会計金額の計算に必要な正しいデータ（価格・数量・courseId）で作成されることを確認する。

**Independent Test**: `courseId` を指定しない追加注文（T004 のケース）で作成される `OrderItem` の `price` / `qty` / `courseId` が期待通りであることを確認する。

**Note（スコープ注記）**: `PUT /:id/course` を経由した人数変更後の実際の会計金額算出（合計計算ロジック自体）は `backend/src/routes/groups.ts` および会計計算コード側の責務であり、本フィーチャーでは変更しない。それらは既存の `backend/src/__tests__/groupCourse.test.ts` の既存テスト（例: 1364行目付近「foodItems ありのコースで人数変更すると、紐づく食事明細の qty も比例して再計算される」）で引き続きカバーされており、本フィーチャーの変更によって壊れないことは Phase 5 のフルテスト実行（T010）で確認する。`groupCourse.test.ts` 自体への新規テスト追加は本フィーチャーのスコープ外（3ファイル制約）とする。

### Tests for User Story 2

- [ ] T007 [US2] `backend/src/__tests__/orders.test.ts` に、T004 の回帰テスト（`courseId` なし・コース内商品と同一メニューの追加注文）で作成される `OrderItem` の `price`（メニュー単価どおり）・`qty`（リクエスト通り）・`courseId`（`null`）が正しいことを検証するアサーションを追加する（T004 の拡張、または新規テストケースとして分離してもよい）。これにより、この明細が以降の会計金額計算（本フィーチャー範囲外）に正しい値を渡せることを保証する。

**Checkpoint**: T007 が成功する。US1・US2 とも独立してテスト可能な状態になる。

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 検証とスコープ外領域への非破壊確認

- [ ] T008 [P] `pnpm --filter backend typecheck` を実行し、型エラーがないことを確認する。
- [ ] T009 [P] `pnpm --filter backend lint` を実行し、Biome のリントエラーがないことを確認する（変更したファイルのみ対象）。
- [ ] T010 `pnpm --filter backend test` を実行し、`orders.test.ts` の新規テストに加え、`groupCourse.test.ts` を含む既存の全テストが引き続きグリーンであること（回帰なし）を確認する。
- [ ] T011 `quickstart.md` のシナリオ1〜3を、開発環境（`pnpm dev`）または直接APIリクエストで手動実行し、期待結果と一致することを確認する（シナリオ1は `PUT /groups/:id/course` を含む End-to-End 確認であり、Phase 3/4 の単体テストでは自動化していない範囲を手動で補う）。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし。T001 は読み取り確認のみで即着手可能。
- **Foundational (Phase 2)**: T002 は Setup と並行可能（別ファイル）。US1・US2 の実装（T006）は T002 完了後にのみ着手できる。
- **User Story 1 (Phase 3)**: Foundational 完了後に着手。T003-T005（テスト）→ T006（実装）の順。
- **User Story 2 (Phase 4)**: T004（US1のテスト）に依存（T007 はその拡張）。
- **Polish (Phase 5)**: Phase 3・Phase 4 完了後に着手。

### User Story Dependencies

- **User Story 1 (P1)**: Foundational (T002) にのみ依存。他ストーリーへの依存なし。
- **User Story 2 (P2)**: User Story 1 のテスト（T004）に依存（同じ `OrderItem` を対象にアサーションを追加するため）。

### Within Each User Story

- テストを先に書き、FAIL することを確認してから実装する（T003-T005 → T006）。
- 同一ファイル（`orders.test.ts` / `orders.ts`）を変更するタスクは並行実行せず、順番に適用する。

### Parallel Opportunities

- T001（`groups.ts` 確認）と T002（`errors.ts` 変更）は異なるファイルのため並行可能。
- T003・T004・T005 は同一ファイル（`orders.test.ts`）内の別テストケースのため、`[P]` は付けない。1つのセッション内で順に追加する。
- T008・T009 は読み取り専用の検証コマンドのため並行可能。

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup（T001）
2. Phase 2: Foundational（T002）
3. Phase 3: User Story 1（T003-T006）
4. **STOP and VALIDATE**: `pnpm --filter backend test -- orders.test.ts` で単独検証
5. これだけでレビュー指摘（High #3-1）の核心である「静かなデータ損失・売上漏れ」は解消される。

### Incremental Delivery

1. Setup + Foundational → 基盤完了
2. User Story 1 → 単独テスト → MVP（売上漏れの根本原因を解消）
3. User Story 2 → 単独テスト → 会計金額整合性の裏付けを追加
4. Polish（T008-T011）→ 型・Lint・全体回帰・手動End-to-End確認

---

## Notes

- `[P]` タスク = 異なるファイル・依存関係なし
- `[Story]` ラベルはユーザーストーリーへのトレーサビリティ用
- 各タスクはCodexへの `/codex:rescue` handoffに耐える粒度（原則1タスク=1ファイルの1変更）にしてある
- スキーマ変更・マイグレーション・フロントエンド変更・`groups.ts` の実装変更は本フィーチャーのスコープ外（`spec.md` の Assumptions 参照）
- `speckit-implement` は使用しない。本 `tasks.md` は `.claude/skills/codex-execution` で handoff 形式に変換し `/codex:rescue` へ委譲する。
