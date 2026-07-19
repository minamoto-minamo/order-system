---

description: "Task list template for feature implementation"
---

# Tasks: Socket.io切断・エラー通知の一貫性

**Input**: Design documents from `/specs/001-socket-notification-consistency/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md（`contracts/`は本フィーチャーでは生成していない。外部インターフェース契約に変更がないため）

**Tests**: plan.mdでユニットテストの追加が明示的に要求されているため、各ユーザーストーリーにテストタスクを含む。

**Organization**: タスクはユーザーストーリー単位でグループ化する。各ストーリーは独立して実装・検証可能。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（別ファイル・依存関係なし）
- **[Story]**: 対応するユーザーストーリー（US1, US2）
- ファイルパスは絶対パスではなくリポジトリルートからの相対パスで記載する

## Setup / Foundational フェーズについて

本フィーチャーは既存ファイル（`socket.ts`, `errors.ts`, `platformStores.ts`）の該当箇所のみを変更する既存機能の修正であり、新規インフラ・新規共有基盤は不要。US1（`socket.ts`/`errors.ts`）とUS2（`platformStores.ts`）は変更ファイルが独立しているため、Setup / Foundationalフェーズは省略し、ユーザーストーリーのフェーズから開始する。

---

## Phase 1: User Story 1 - キッチン・ホールスタッフが提供状況操作の失敗に気づける (Priority: P1) 🎯 MVP

**Goal**: `order:complete`/`order:serve`がガード違反（対象注文が期待ステータスでない、グループ/セッションが会計済み）で状態変更を行わなかった場合、既存の`error`イベント経路を通じて操作元クライアントへ単一の汎用メッセージを通知する。サーバー側の状態変更判断（no-opにするかどうか）自体は変更しない。

**Independent Test**: 同一注文明細に対して2つのキッチン端末からほぼ同時に「調理完了」を送信し、後着の操作を行った端末側に失敗が通知される（`error`イベント→トースト）ことを確認する。店舗無効化のシナリオ（US2）とは独立に検証できる。

### Tests for User Story 1 ⚠️

> **NOTE: 先にテストを書き、実装前に FAIL することを確認する**

- [x] T001 [P] [US1] `backend/src/__tests__/socket.test.ts` に、`order:complete`イベントのガード違反ケース（対象明細が`pending`以外、所属グループが`closed`、所属セッションが`closed`の3パターン）で、`socket.emit`が`('error', errorBody(ErrorCodes.Socket.OrderCompleteRejected, <汎用メッセージ>).error)`相当の引数で呼ばれることを検証するテストを追加する。既存の正常系（`pending`から`ready`へ成功するケース）では`socket.emit('error', ...)`が呼ばれないことも合わせて確認する。
- [x] T002 [US1] 同ファイル（`backend/src/__tests__/socket.test.ts`）に、`order:serve`イベントについて同様のガード違反ケース（対象明細が`ready`以外、所属グループが`closed`、所属セッションが`closed`）で`socket.emit`が`('error', errorBody(ErrorCodes.Socket.OrderServeRejected, <同一の汎用メッセージ>).error)`相当の引数で呼ばれることを検証するテストを追加する。正常系（`ready`から`served`へ成功するケース）で呼ばれないことも確認する。（T001と同一ファイルのため直列で追加）

### Implementation for User Story 1

- [x] T003 [US1] `backend/src/lib/errors.ts` の`ErrorCodes.Socket`に`OrderCompleteRejected: 'socket.order.complete_rejected'`と`OrderServeRejected: 'socket.order.serve_rejected'`を追加する（既存の`OrderCompleteFailed`/`OrderServeFailed`は例外`catch`節専用のため転用せず維持する）。（Depends on: T001, T002）
- [x] T004 [US1] `backend/src/plugins/socket.ts` の`order:complete`ハンドラ（150-175行目付近）を変更する。`if (order?.status !== 'pending') return`と、会計済みグループ/セッションのガード（`if (order.group.status === 'closed' || order.group.session.status === 'closed') return`）の両方を、状態変更を行わずに`socket.emit('error', errorBody(ErrorCodes.Socket.OrderCompleteRejected, <単一の汎用メッセージ>).error)`を呼んでから`return`する形に変更する。メッセージ文字列は原因（ステータス不一致／グループ・セッション会計済み／対象明細が存在しない）によらず同一の定数を使う。正常系（状態変更が成功する場合）の`order:updated`emit・レスポンス内容は変更しない。既存のtry/catch内の例外用`socket.emit('error', ...)`（`OrderCompleteFailed`）はそのまま維持する。（Depends on: T003）
- [x] T005 [US1] `backend/src/plugins/socket.ts` の`order:serve`ハンドラ（177-202行目付近）を、T004と同様のパターンで変更する（`ErrorCodes.Socket.OrderServeRejected`を使い、`if (order?.status !== 'ready') return`と会計済みグループ/セッションのガードの両方に同じ汎用メッセージでの`error`通知を追加する）。（Depends on: T004, 同一ファイルのため直列）

**Checkpoint**: この時点でUser Story 1は独立して動作・検証可能。

---

## Phase 2: User Story 2 - 店舗無効化後、旧スタッフ端末が操作を継続できない (Priority: P2)

**Goal**: プラットフォーム管理者が店舗を`isActive: false`に更新した直後、対象店舗の`store:${storeId}`ルームへ`disconnectSockets(true)`を適用し、既存スタッフ接続を強制切断する。店舗削除処理も同一ロジックを経由させる。

**Independent Test**: スタッフ端末を店舗に接続した状態のまま、プラットフォーム管理者が当該店舗を無効化するAPIを呼び出し、直後にそのスタッフ端末のSocket.io接続が切断されることを確認する。User Story 1とは独立に検証できる。

### Tests for User Story 2 ⚠️

> **NOTE: 先にテストを書き、実装前に FAIL することを確認する**

- [x] T006 [P] [US2] `backend/src/__tests__/platformStores.test.ts` に、`authRoutes.test.ts`/`staff.test.ts`と同じ`io.in(room).disconnectSockets`モックパターンを使い、`PUT /:id`について次の3ケースを検証するテストを追加する: (a) `{ isActive: false }`への更新で`io.in('store:{id}').disconnectSockets(true)`が呼ばれる、(b) `{ isActive: true }`への更新（再有効化）では呼ばれない、(c) `{ name: '...' }`のみの更新（`isActive`未指定、既存値が`true`）では呼ばれない。
- [x] T007 [US2] 同ファイル（`backend/src/__tests__/platformStores.test.ts`）に、`DELETE /:id`実行時にも`io.in('store:{id}').disconnectSockets(true)`が呼ばれることを検証するテストを追加する。（T006と同一ファイルのため直列で追加）

### Implementation for User Story 2

- [x] T008 [US2] `backend/src/routes/platformStores.ts` に、店舗を無効化しSocket接続を切断する小さな共有ヘルパー（例: `deactivateStoreSockets(fastify, storeId)` — `fastify.io.in(\`store:${storeId}\`).disconnectSockets(true)`を呼ぶだけの関数）を追加する。`PUT /:id`ハンドラ（96-104行目付近）で`prisma.store.update`実行後、更新後の`store.isActive === false`であればこのヘルパーを呼ぶ。（Depends on: T006）
- [x] T009 [US2] 同ファイル（`backend/src/routes/platformStores.ts`）の`DELETE /:id`ハンドラ（106-152行目付近）を変更する。既存の`prisma.store.update({ where: { id: storeId }, data: { isActive: false } })`（116行目付近）の直後にT008のヘルパーを呼び、削除処理専用の個別実装は追加しない。（Depends on: T008, T007, 同一ファイルのため直列）

**Checkpoint**: この時点でUser Story 1・2すべてが独立して動作・検証可能。

---

## Phase 3: Polish & Cross-Cutting Concerns

**Purpose**: 全ストーリーの回帰確認

- [x] T010 [P] `pnpm --filter backend typecheck` を実行し、型エラーがないことを確認する。
- [x] T011 [P] `pnpm --filter backend test` を実行し、T001/T002/T006/T007で追加したテストを含む全テストが通ることを確認する。
- [ ] T012 `specs/001-socket-notification-consistency/quickstart.md` の「3. 回帰確認（通常時）」の手順に従い、`pnpm test:e2e`を含む既存スイートに回帰がないことを確認する。同ドキュメント「2. 手動での動作確認」の2シナリオを可能な範囲で手動確認する。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (US1)**: 依存なし。単独で開始・完了できる。
- **Phase 2 (US2)**: 依存なし。Phase 1と並行して開始できる（別ファイル: `platformStores.ts`）。
- **Phase 3 (Polish)**: Phase 1・2完了後に行う。

### User Story Dependencies

- US1・US2は互いに独立（変更ファイルが重複しない: `socket.ts`/`errors.ts` vs `platformStores.ts`）。優先度順（P1→P2）に進めてもよいし、並行して進めてもよい。

### Within Each User Story

- テストを先に追加し、実装前にFAILすることを確認してから実装タスクに進む。
- 同一ファイルへの複数タスク（T001→T002、T003→T004→T005、T006→T007、T008→T009）は直列で行う。

### Parallel Opportunities

- T001（US1）とT006（US2）はそれぞれ別ファイルのテスト追加であり並行実行できる。
- US1の実装タスク（T003-T005）とUS2の実装タスク（T008-T009）は別ファイルのため、ストーリー単位で並行して進められる。
- T010・T011（Polish）は並行実行できる。

---

## Parallel Example: 2ストーリー同時着手

```bash
# 各ストーリーのテストを並行して追加:
Task: "T001 backend/src/__tests__/socket.test.ts に order:complete/serve のガード違反通知ケースを追加"
Task: "T006 backend/src/__tests__/platformStores.test.ts に店舗無効化時の強制切断ケースを追加"
```

---

## Implementation Strategy

### MVP First (User Story 1 のみ)

1. Phase 1（US1: ガード違反時のクライアント通知）を完了する。
2. **STOP and VALIDATE**: User Story 1を独立して検証する（`pnpm --filter backend test`、該当テストのみ実行可）。
3. 必要であればここでリリース判断する（日常操作頻度の高いUS1のみ先行修正するケース）。

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
- ガード違反時の通知メッセージは原因によらず単一の汎用メッセージとする（spec.md Clarifications参照。原因別の文言分岐は行わない）
- `order:complete`/`order:serve`のno-op判断ロジック自体（何を条件にno-opとするか）は変更しない。変更するのは通知の有無のみ
- 店舗削除処理（`DELETE /:id`）に切断処理専用の個別実装は追加しない。`PUT /:id`と共有するヘルパー経由で適用する
