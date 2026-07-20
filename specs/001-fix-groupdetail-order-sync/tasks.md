# Tasks: GroupDetailの初期ロードとSocketイベントの競合による注文消失を修正する

**Input**: Design documents from `/specs/001-fix-groupdetail-order-sync/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: 変更対象のロジック（新規純粋関数`applyQueuedOrderEvents`）についてユニットテストを含む。CLAUDE.mdの方針（変更した関数の入出力に対するテストを必須とする）に従う。

**Organization**: タスクはspec.mdのユーザーストーリー（優先度順）ごとにグループ化する。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並行実行可能（別ファイル・未完了タスクへの依存なし）
- **[Story]**: 対応するユーザーストーリー（US1/US2/US3）
- 各タスクに実ファイルパスを明記する

## Path Conventions

本フィーチャーはfrontendワークスペースのみを変更する（`frontend/src/`）。バックエンド・shared側の変更はない。

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: 全ユーザーストーリーが共通で必要とする、保留イベント再適用ロジックを先に用意する

**⚠️ CRITICAL**: このフェーズ完了まで、いずれのユーザーストーリーの実装にも着手できない

- [ ] T001 `frontend/src/lib/applyQueuedOrderEvents.ts` に `QueuedOrderEvent` 型（`created`/`updated`/`cancelled`の判別共用体。data-model.md参照）と、`applyQueuedOrderEvents(base: OrderItem[], events: QueuedOrderEvent[]): OrderItem[]` 純粋関数を実装する。合成規則は既存の`GroupDetail.tsx`の3ハンドラ（112-123行目）と同一にする: created=id重複なら無視/なければ追加、updated=id一致要素を置換（不一致ならno-op）、cancelled=id一致要素のstatusを`'cancelled'`に更新（不一致ならno-op）。research.md R3参照。
- [ ] T002 `frontend/src/__tests__/applyQueuedOrderEvents.test.ts` を新規作成し、T001の関数をユニットテストする。ケース: (a) REST基点に存在しないidへの`created`イベントが追加される、(b) REST基点に既に存在する同一idへの`created`イベントは重複追加されない、(c) `updated`イベントが対象idの内容を丸ごと置換する、(d) `updated`イベントの対象idが基点に存在しない場合は何も変化しない、(e) `cancelled`イベントが対象idのstatusのみを`'cancelled'`に変更しほかのフィールドは保持する、(f) `cancelled`イベントの対象idが基点に存在しない場合は何も変化しない、(g) 同一idへの`created`→`updated`が受信順どおりに適用され最終的にupdated内容が反映される。

**Checkpoint**: `applyQueuedOrderEvents` が完成しテスト済み。ここから各ユーザーストーリーの実装に着手できる。

---

## Phase 2: User Story 1 - 画面表示中の再接続で他スタッフの新規注文が消えない (Priority: P1) 🎯 MVP

**Goal**: Socket再接続の実行中に他クライアントが追加した注文が、再接続完了後も画面から消えないようにする

**Independent Test**: GroupDetail画面表示中にSocket接続を切断・再接続させ、その間に別クライアントから同一グループへ注文を追加し、再接続後も注文が表示され続けることを確認する（quickstart.md §2）

### Implementation for User Story 1

- [ ] T003 [US1] `frontend/src/pages/group/GroupDetail/GroupDetail.tsx` の `fetchAll`（現行78-108行目）を書き換える: `useRef<number>(0)`の世代カウンタ（`fetchGenRef`）、`useRef<QueuedOrderEvent[]>([])`の保留キュー（`queueRef`）、`useRef<boolean>(false)`のフェッチ中フラグ（`isFetchingRef`）を導入する。`fetchAll`開始時に世代をインクリメントして捕捉し、`queueRef.current`を空配列にリセットし、`isFetchingRef.current`を`true`にする。`Promise.all`解決時、捕捉した世代が`fetchGenRef.current`と一致する場合のみ、`setItems(o)`を`setItems(applyQueuedOrderEvents(o, queueRef.current))`（T001の関数を使用）に置き換えた上で他の`set*`を実行する。世代が不一致（より新しいフェッチが既に開始・完了している）の場合は、いかなるstate更新も行わず処理を終える。`.catch`（`setLoadError(true)`）と後始末（`isFetchingRef.current = false`）も、捕捉した世代が現在の世代と一致する場合のみ実行するようガードする。（FR-001, FR-007, FR-008 / research.md R1, R2）
- [ ] T004 [US1] 同ファイルの`useSocketListeners`内、`order:created`/`order:updated`/`order:cancelled`ハンドラ（現行112-123行目）を変更する: `isFetchingRef.current`が`true`の間はイベントを直接`setItems`せず、対応する`QueuedOrderEvent`（`{type:'created',item:o}` 等）を`queueRef.current`へ追記するだけに留める。`isFetchingRef.current`が`false`の場合は既存どおり直接`setItems`で反映する。（FR-001, FR-002, FR-003, FR-007）
- [ ] T005 [US1] quickstart.md §2の手動確認手順1〜5を実施し、Socket再接続中に他クライアントが追加した注文が再接続完了後も画面から消えないことを確認する。

**Checkpoint**: User Story 1が単独で完結し検証可能。ここまでで再接続タイミングの注文消失は解消される。

---

## Phase 3: User Story 2 - 画面を開いた直後の新規注文が消えない (Priority: P1)

**Goal**: 画面の初回マウント時（初期データ取得中）に他クライアントが追加した注文が消えないようにする

**Independent Test**: GroupDetail画面への初回遷移直後、初期データ取得完了前に別クライアントから注文を追加し、取得完了後の画面にその注文が表示されることを確認する（quickstart.md §2の変形）

### Implementation for User Story 2

- [ ] T006 [US2] `frontend/src/pages/group/GroupDetail/GroupDetail.tsx` を確認し、マウント時に呼ばれる`fetchAll()`（現行103行目）が、T003で実装した世代・キュー機構を通る同一の`fetchAll`関数であること（マウント専用の別経路が存在しないこと）をコードレビューで確認する。別経路が存在する場合はT003の機構を通るよう修正する。追加の実装が不要であれば、その旨をタスクの完了根拠として記録する。
- [ ] T007 [US2] quickstart.md §2の手動確認手順を、Socket再接続ではなく「画面への初回遷移直後」に他クライアントが注文を追加するケースに変えて実施し、初期データ取得完了後の画面にその注文が表示されることを確認する。

**Checkpoint**: User Story 1・2が両方とも単独で機能する。マウント時・再接続時いずれの注文消失も解消される。

---

## Phase 4: User Story 3 - サーバー側で削除・キャンセルされた注文は正しく反映される (Priority: P2)

**Goal**: 初期データ取得や再接続処理の実行中に他クライアントが注文をキャンセルした場合、処理完了後の画面が正しくキャンセル済みとして表示することを保証する（マージ的解決による副作用がないことの確認）

**Independent Test**: 初期データ取得中に他クライアントが既存注文をキャンセルし、取得完了後の画面でその注文がキャンセル済みとして表示されることを確認する（quickstart.md §2の変形）

### Implementation for User Story 3

- [ ] T008 [US3] `frontend/src/__tests__/applyQueuedOrderEvents.test.ts`（T002）に、REST基点では未キャンセルの注文に対して`cancelled`イベントが保留されていたケースのテストを追加し、`applyQueuedOrderEvents`適用後にその注文の`status`が`'cancelled'`になることを検証する（T002のケース(e)で既にカバーしている場合は、REST基点由来のitemであることを明示するケースとして拡張する）。
- [ ] T009 [US3] quickstart.md §2の手動確認手順を、クライアントBが注文を「追加」ではなく「キャンセル」する変形で実施し、クライアントAの画面がフェッチ完了後にキャンセル済み状態を正しく表示することを確認する。

**Checkpoint**: 全ユーザーストーリーが単独で機能する。

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 全ストーリー共通の回帰確認と、Edge Casesで挙げた多重フェッチ耐性の検証

- [ ] T010 [P] `frontend/src/__tests__/applyQueuedOrderEvents.test.ts`（またはGroupDetail関連の既存テストファイル）に、フェッチ非実行中（`isFetchingRef.current === false`相当の状態）ではSocketイベントが従来どおり即時に`items`へ反映されることを確認する回帰ケースを追加する（SC-004: 正常系の非回帰）。
- [ ] T011 `pnpm --filter frontend typecheck`・`pnpm --filter frontend test`・`pnpm lint` を実行し、すべて成功することを確認する（quickstart.md §3）。
- [ ] T012 quickstart.mdのEdge Cases相当のシナリオ（短時間の複数回Socket再接続）を手動で再現し、古い取得結果や古い取得に紐づく保留キューがstateに反映されず、最終的な画面表示が最新の取得結果と矛盾しないことを確認する（FR-008 / research.md R2）。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: 依存なし。最初に着手する。T004以降のすべてのユーザーストーリーをブロックする。
- **User Story 1 (Phase 2)**: Foundational完了後に着手可能。他ストーリーへの依存なし。
- **User Story 2 (Phase 3)**: Foundational完了後に着手可能だが、T006はUser Story 1のT003で実装される`fetchAll`の機構を前提に確認するため、実務上はPhase 2の後に行う。
- **User Story 3 (Phase 4)**: Foundational完了後に着手可能。T008はT002で作成したテストファイルを拡張するため、T002完了後に着手する。
- **Polish (Phase 5)**: 実施したいユーザーストーリーがすべて完了した後に着手する。

### Within Each Phase

- T001 → T002（テストは実装後、または実装と同時にシグネチャを合わせて作成）
- T003 → T004（同一ファイル`GroupDetail.tsx`を編集するため直列。T004はT003で導入した`isFetchingRef`/`queueRef`を参照する）
- T003, T004 → T005（実装完了後に手動検証）
- T006, T007 はT003完了後（T003が実装する機構を前提に確認・検証するため）
- T008はT002完了後（同一テストファイルの拡張）
- T008 → T009（テストで裏付けた後に手動検証）

### Parallel Opportunities

- T001とT002は同一ファイルへの実装/新規テストファイル作成であり別ファイルだが、テストが実装のシグネチャに依存するため並行度は限定的（実装を先に固めてからテストを書くことを推奨）。
- T010はT001〜T009と別の関心事（正常系の非回帰）のテストであり、Foundational完了後であれば他タスクと並行して着手可能。

---

## Parallel Example: Foundational

```bash
# T001完了後、T002は独立したテストファイルとして着手可能:
Task: "Implement QueuedOrderEvent type and applyQueuedOrderEvents in frontend/src/lib/applyQueuedOrderEvents.ts"
Task: "Write unit tests in frontend/src/__tests__/applyQueuedOrderEvents.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Foundational完了
2. Phase 2: User Story 1完了
3. **STOP and VALIDATE**: quickstart.md §2の再接続シナリオで確認
4. この時点で、レビュー指摘の中で最も発生頻度が高い「再接続時の注文消失」は解消されている

### Incremental Delivery

1. Foundational → 土台完成
2. User Story 1追加 → 独立検証 → 再接続時の消失解消（MVP）
3. User Story 2追加 → 独立検証 → 画面表示直後の消失解消（実装上はUS1と共通の`fetchAll`機構だが、確認観点が異なるため別ストーリーとして検証する）
4. User Story 3追加 → 独立検証 → キャンセル同期の正しさを保証
5. Polish → 全体の回帰確認とEdge Case（多重再接続）の検証

---

## Notes

- 本フィーチャーはUIの新規追加ではなく既存コードの不具合修正のため、全タスクの変更先ファイルは既存ファイル（`GroupDetail.tsx`）または新規の小さな純粋関数ファイル1つに限定される。
- `speckit-implement` は使用しない。本タスクリストの実行はCodex（`/codex:rescue`）へのhandoffで行う。
- 各タスク完了ごとにコミットする場合は、CLAUDE.mdのgit運用方針（明示的な依頼がある場合のみコミットする等）に従うこと。
