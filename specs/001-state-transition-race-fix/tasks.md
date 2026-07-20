---

description: "Task list template for feature implementation"
---

# Tasks: 状態変更エンドポイントのレースコンディションをトランザクション内再検証で解消する

**Input**: Design documents from `/specs/001-state-transition-race-fix/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md, contracts/api-changes.md（5-1統合分の新規409エラーレスポンスのみ記載。それ以外は外部インターフェース契約に変更がない）

**Tests**: spec.md/plan.mdでユニットテストの追加が明示的に要求されているため、各ユーザーストーリーにテストタスクを含む。

**Organization**: タスクはユーザーストーリー単位でグループ化する。各ストーリーは独立して実装・検証可能。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（別ファイル・依存関係なし）
- **[Story]**: 対応するユーザーストーリー（US1, US2, US3）
- ファイルパスは絶対パスではなくリポジトリルートからの相対パスで記載する

## Setup / Foundational フェーズについて

本フィーチャーは既存の3ファイル（`customer.ts`, `socket.ts`, `groups.ts`）の該当関数のみを変更する既存機能の修正であり、新規インフラ・新規共有基盤は不要。各ユーザーストーリーが変更するファイルは互いに独立しているため、Setup / Foundationalフェーズは省略し、ユーザーストーリーのフェーズから開始する。

---

## Phase 1: User Story 1 - 会計依頼が不正な状態遷移・未提供注文の残存を許さない (Priority: P1) 🎯 MVP

**Goal**: 会計依頼処理（客用`POST /customer/groups/:id/bill`、スタッフ用`PUT /api/groups/:id`）の状態確認と書き込みを不可分にし、(a) 直前に他リクエストがグループを`closed`にしていた場合に上書きしない、(b) 未提供（`pending`/`ready`）の注文明細が残っている場合は拒否する（5-1統合）。

**Independent Test**:
- （状態競合）客用の会計依頼APIと、ホール/レジ側のグループ更新APIをほぼ同時に呼び出し、会計依頼側がグループを`closed`から`bill_requested`へ書き換えないことを確認する。
- （未提供注文）未提供の注文明細を持つグループに対して、客用の会計依頼APIとスタッフ用のグループ状態更新APIをそれぞれ直接呼び出し、両方とも拒否されることを確認する。全明細提供済み/取消済み、または0件のグループでは成功することも確認する。

### Tests for User Story 1 ⚠️

> **NOTE: 先にテストを書き、実装前に FAIL することを確認する**

- [ ] T001 [P] [US1] `backend/src/lib/errors.ts` に `ErrorCodes.Groups.UnservedItemsExist`（`groups.update.unserved_items_exist`, 409）と `ErrorCodes.Customer.UnservedItemsExist`（`customer.bill.unserved_items_exist`, 409）を追加する。既存の命名規則（`<リソース>.<操作>.<理由>`のスネークケース）に合わせる。
- [ ] T002 [US1] `backend/src/__tests__/customer.test.ts` の`POST /groups/:id/bill`テストに以下を追加する: (a) トランザクション内`tx.group.findFirst`が`status !== 'active'`相当（`null`）を返すケース→既存と同じ`400/BillRequestNotAllowed`を返しステータス更新をしないこと、(b) `status === 'active'`だが`tx.orderItem.count`が`0`より大きい値を返すケース→`409/customer.bill.unserved_items_exist`（`details.count`一致）を返しステータス更新をしないこと、(c) `active`かつ未提供0件→`204`で`bill_requested`に更新されること。（Depends on: T001）
- [ ] T003 [US1] `backend/src/__tests__/groups.test.ts`の`PUT /:id`テストに、`status: 'bill_requested'`指定時の同様のケース（未提供注文あり→`409/groups.update.unserved_items_exist`、なし→既存通り成功）を追加する。（Depends on: T001。T002と同一領域のため直列で追加）

### Implementation for User Story 1

- [ ] T004 [US1] `backend/src/routes/customer.ts`の`POST /groups/:id/bill`（111-141行目付近）を変更する。既存のcheck-then-act（`findFirst`→`update`）を廃し、新規にSerializableトランザクションを導入する（同ファイル`POST /orders`の既存トランザクションパターンを踏襲）。トランザクション内で`tx.group.findFirst({ where: { id, storeId: request.storeId, status: 'active' } })`を再検証し、`null`なら既存と同じ`400/BillRequestNotAllowed`を投げてロールバックする。続けて`tx.orderItem.count({ where: { groupId: id, status: { in: ['pending', 'ready'] } } })`を実行し、`count > 0`なら`409/customer.bill.unserved_items_exist`（`details: { count }`）を投げてロールバックする。いずれも満たせば`tx.group.update({ where: { id }, data: { status: 'bill_requested' } })`を実行する。トランザクション成功後、既存通り`prisma.group.findUniqueOrThrow`等で取得し`toGroup(updated, setting)`で`group:updated`をemitして`204`を返す。（Depends on: T002, T003）
- [ ] T005 [US1] `backend/src/routes/groups.ts`の`PUT /:id`（`active → bill_requested`遷移を扱う既存のSerializableトランザクション、`groups.ts:342-390`付近）を変更する。既存の状態遷移検証（`validTransitions`）に続けて、同一トランザクション内で`tx.orderItem.count({ where: { groupId: id, status: { in: ['pending', 'ready'] } } })`を実行し、`count > 0`なら`409/groups.update.unserved_items_exist`（`details: { count }`）を投げてロールバックする。`active → bill_requested`以外の遷移には影響しない。（Depends on: T003, T004）

**Checkpoint**: この時点でUser Story 1は独立して動作・検証可能。

---

## Phase 2: User Story 2 - キャンセル済みの注文が提供状況操作で復活しない (Priority: P1)

**Goal**: `order:complete`/`order:serve`の状態確認と書き込みを不可分にし、直前にキャンセル等で状態が変わっていた場合に上書きしないようにする。

**Independent Test**: 同一注文明細に対して「注文キャンセル」APIと「調理完了」(`order:complete`)または「提供完了」(`order:serve`)イベントをほぼ同時に発行し、キャンセル済みの明細が`ready`/`served`に変化しないことを確認する。

### Tests for User Story 2 ⚠️

> **NOTE: 先にテストを書き、実装前に FAIL することを確認する**

- [ ] T006 [P] [US2] `backend/src/__tests__/socket.test.ts` に、`order:complete`イベントで対象明細が事前チェック時点では`pending`でも、`prisma.orderItem.updateMany`をモックして`count: 0`（＝更新直前に`cancelled`等へ変化していた）を返すケースを追加する。明細が更新されないこと、`order:updated`がemitされないこと、`socket.emit('error', ...)`も呼ばれない（サイレントno-op）ことを検証する。
- [ ] T007 [US2] 同ファイル（`backend/src/__tests__/socket.test.ts`）に、`order:serve`イベントについて同様の競合ケース（`ready`→更新直前に`cancelled`等へ変化、`count: 0`）テストを追加する。（T006と同一ファイルのため直列で追加）

### Implementation for User Story 2

- [ ] T008 [US2] `backend/src/plugins/socket.ts` の `order:complete` ハンドラ（150-172行目付近）を変更する。既存の`prisma.orderItem.findFirst`（`itemId`存在確認用）はそのまま維持しつつ、書き込みを`prisma.orderItem.updateMany({ where: { id: itemId, storeId: socket.data.storeId, status: 'pending', group: { status: { not: 'closed' }, session: { status: { not: 'closed' } } } }, data: { status: 'ready' } })`によるcompare-and-swapに置き換える。`count !== 1`の場合は何もemitせず`return`する（既存の前提条件不一致時と同じサイレントno-op）。`count === 1`の場合は`prisma.orderItem.findUniqueOrThrow({ where: { id: itemId } })`で取得し直し、既存通り`toOrderItem(updated)`で`order:updated`をemitする。既存のtry/catch（予期しない例外時の`socket.emit('error', ...)`）はそのまま維持する。（Depends on: T006, T007）
- [ ] T009 [US2] `backend/src/plugins/socket.ts` の `order:serve` ハンドラ（174-202行目付近）を、T008と同様のパターンで変更する（`status: 'ready'`であることをCAS条件にし、成功時のみ`status: 'served'`に更新）。（Depends on: T008, T006, T007）

**Checkpoint**: この時点でUser Story 1・2が独立して動作・検証可能。

---

## Phase 3: User Story 3 - コース適用・人数変更が最新のコース定義に基づいて処理される (Priority: P2)

**Goal**: コース適用・人数変更のトランザクション内で`Course`/`DrinkPlan`を再取得し、トランザクション開始前に取得した値を書き込みに使い回さないようにする。

**Independent Test**: コース適用（またはコース人数変更）APIの処理中に、対象コースの価格・構成を変更するAPIをほぼ同時に呼び出し、生成・更新される注文明細が処理完了時点のコース定義と一致することを確認する。

### Tests for User Story 3 ⚠️

> **NOTE: 先にテストを書き、実装前に FAIL することを確認する**

- [ ] T010 [P] [US3] `backend/src/__tests__/groupCourse.test.ts` の `describe('POST /api/groups/:id/course — コース適用', ...)` ブロックに、トランザクション内で再取得する`tx.course.findFirst`（および`tx.drinkPlan.findFirst`）が、トランザクション開始前の`prisma.course.findFirst`/`prisma.drinkPlan.findFirst`とは異なる価格・構成を返すようモックし、作成される`OrderItem`（コース料金明細・飲み放題定額課金明細・コース料理明細）と更新される`Group.drinkPlanId`が、トランザクション内再取得後の値を反映することを検証するテストを追加する。
- [ ] T011 [US3] 同ファイル（`backend/src/__tests__/groupCourse.test.ts`）の `describe('PUT /api/groups/:id/course — コース人数変更', ...)` ブロックに、トランザクション内で再取得する`tx.course.findFirst`が、トランザクション開始前の`prisma.course.findFirst`とは異なる`foodItems`数量を返すようモックし、再計算される食事明細の`qty`が再取得後の構成を反映することを検証するテストを追加する。（T010と同一ファイルのため直列で追加）

### Implementation for User Story 3

- [ ] T012 [US3] `backend/src/routes/groups.ts` の `POST /:id/course`（457-583行目付近）を変更する。トランザクション内、`tx.group.findUnique`によるグループ状態再検証の直後に、`tx.course.findFirst({ where: { id: courseId, storeId: request.storeId }, include: { foodItems: true } })`と（`course.drinkPlanId != null`の場合）`tx.drinkPlan.findFirst({ where: { id: course.drinkPlanId, storeId: request.storeId } })`を再取得する。以降の`OrderItem`作成（コース料金明細・飲み放題定額課金明細・コース料理明細・飲み放題ゼロ化更新）と`tx.group.update`（`courseId`/`drinkPlanId`設定）は、このトランザクション内で再取得した変数のみを使う（トランザクション開始前の`prisma.course.findFirst`/`prisma.drinkPlan.findFirst`は404判定用にそのまま残すが、書き込みには使わない）。トランザクション内で再取得した`course`が`null`の場合（削除された等）は、既存の`CourseNotFoundError`相当（既存の404エラーコードを再利用）を投げてロールバックする。（Depends on: T010）
- [ ] T013 [US3] `backend/src/routes/groups.ts` の `PUT /:id/course`（649-745行目付近、コース人数変更）を変更する。トランザクション内、`tx.group.findUnique`によるグループ状態再検証の直後に、`tx.course.findFirst({ where: { id: group.courseId, storeId: request.storeId }, include: { foodItems: true } })`を再取得し、`foodItemQtyByMenuItemId`をこのトランザクション内変数から再構築して食事明細の`qty`再計算に使う（トランザクション開始前の`prisma.course.findFirst`は404判定用にそのまま残すが、書き込みには使わない）。（Depends on: T011, T012）
- [ ] T014 [P] [US3] `backend/src/routes/groups.ts` の `unapplyCourse` の既存コメントを、実装内容と一致するよう修正する（指摘5-2）。挙動自体は変更しない。他のUS3タスクとは独立して行える。

**Checkpoint**: この時点でUser Story 1・2・3すべてが独立して動作・検証可能。

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: 全ストーリーの回帰確認

- [ ] T015 [P] `pnpm --filter backend typecheck` を実行し、型エラーがないことを確認する。
- [ ] T016 [P] `pnpm --filter backend test` を実行し、T002/T003/T006/T007/T010/T011で追加したテストを含む全テストが通ることを確認する。
- [ ] T017 `specs/001-state-transition-race-fix/quickstart.md` の「3. 回帰確認（通常時）」の手順に従い、`pnpm test:e2e`を含む既存スイートに回帰がないことを確認する。同ドキュメント「2. 手動での競合再現（任意、開発環境）」の3シナリオを可能な範囲で手動確認する。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (US1)**: 依存なし。単独で開始・完了できる。
- **Phase 2 (US2)**: 依存なし。Phase 1と並行して開始できる（別ファイル: `socket.ts`）。
- **Phase 3 (US3)**: 依存なし。Phase 1・2と並行して開始できる。ただし`groups.ts`はUS1（T005: `PUT /:id`）とUS3（T012/T013: `POST`/`PUT /:id/course`、T014: `unapplyCourse`）の両方が触る。関数が異なるためコンフリクトはしにくいが、同一ファイルへの同時編集はコミット単位を分けるなど配慮する。
- **Phase 4 (Polish)**: Phase 1〜3のうち実施したストーリーすべてが完了した後に行う。

### User Story Dependencies

- US1・US2・US3は変更対象の関数が独立している（`customer.ts` / `socket.ts` / `groups.ts`内の別関数）。優先度順（P1→P1→P2）に進めてもよいし、並行して進めてもよい。`groups.ts`はUS1・US3で共有ファイルのため、並行実装時はマージ順に注意する。

### Within Each User Story

- テストを先に追加し、実装前にFAILすることを確認してから実装タスクに進む。
- 同一ファイルへの複数タスク（T002→T003、T004→T005、T006→T007、T008→T009、T010→T011、T012→T013）は直列で行う。

### Parallel Opportunities

- T001（US1、エラーコード追加）、T006（US2）、T010（US3）はそれぞれ別ファイルのテスト追加であり並行実行できる（T001完了後にT002/T003が着手可能）。
- US1・US2・US3の実装タスク（T004-T005 / T008-T009 / T012-T014）はストーリー単位で並行して進められる（`groups.ts`の同時編集にのみ注意）。
- T015・T016（Polish）は並行実行できる。

---

## Parallel Example: 3ストーリー同時着手

```bash
# 各ストーリーのテストを並行して追加:
Task: "T001 backend/src/lib/errors.ts に新規エラーコードを追加"
Task: "T002 backend/src/__tests__/customer.test.ts に会計依頼の競合・未提供注文ケースを追加"
Task: "T006 backend/src/__tests__/socket.test.ts に order:complete の競合ケースを追加"
Task: "T010 backend/src/__tests__/groupCourse.test.ts にコース適用の再取得ケースを追加"
```

---

## Implementation Strategy

### MVP First (User Story 1 のみ)

1. Phase 1（US1: 会計依頼）を完了する。
2. **STOP and VALIDATE**: User Story 1を独立して検証する（`pnpm --filter backend test`、該当テストのみ実行可）。
3. 必要であればここでリリース判断する（Highの指摘1件のみを先行修正するケース）。

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
- 新規エラーコードの追加は最小限にする（spec.md Clarifications参照）
- `docs/data-model/concurrency-notes.md`に記載の参考実装（`orders.ts`のcancel、`refreshToken.ts`、`unapplyCourse`）自体は変更しない
