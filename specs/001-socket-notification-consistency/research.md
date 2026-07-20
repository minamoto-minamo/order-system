# Phase 0 Research: Socket.io切断・エラー通知の一貫性

技術的な不明点は`spec.md`のClarifications段階でほぼ解消済み。本フィーチャーはリポジトリ内に確立済みの2パターン（`error`イベント経路、`disconnectSockets`パターン）を既存箇所に適用するものであり、新規技術選定は発生しない。以下は各対象箇所への適用方法を具体化するための実装調査結果。

## Decision 1: ガード違反時の通知は既存の`error`イベント経路を再利用し、専用のエラーコードを1組追加する

- **Decision**: `order:complete`/`order:serve`の各ガード分岐（`if (order?.status !== 'pending') return` 等）を、状態変更を行わずに`socket.emit('error', errorBody(code, message).error)`を呼んでから処理を終える形に変更する。コードは`ErrorCodes.Socket`に`OrderCompleteRejected: 'socket.order.complete_rejected'`/`OrderServeRejected: 'socket.order.serve_rejected'`を新設する（既存の`OrderCompleteFailed`/`OrderServeFailed`は例外`catch`節専用として意味が固定されているため転用せず、ガード違反用に別コードを設ける）。
- **Rationale**: `PageLayout`（`frontend/src/layouts/PageLayout/index.tsx:18`）は`socket.on(SE.error, onError)`で`ApiErrorPayload`を受け取り`showToast(payload.message, 'danger')`するだけで、コードそのものはフロント側で分岐に使っていない。新規イベント・新規フロント購読ロジックを追加せずに済む（spec.md Clarifications Q1）。既存の`OrderCompleteFailed`/`OrderServeFailed`とコードを分ける理由は、`backend/CLAUDE.md`の「エラーコードを一元管理し、既存リソースのグループに倣って追加する」方針と、原因（例外 vs 業務ルール上のno-op）が異なるため将来の運用ログ調査で区別できるようにするため。
- **メッセージ**: 単一の汎用メッセージ文字列（例:「操作を反映できませんでした。画面を更新してください」）を`order:complete`/`order:serve`のガード分岐すべてで共通利用する（spec.md Clarifications Q2、FR-003）。原因別の文言分岐は行わない。日本語文字列はバックエンド側の`errorBody()`呼び出しに直書きする（既存の`OrderCompleteFailed`/`OrderServeFailed`の呼び出しと同じ扱いで、フロントのi18nを経由しない。既存の`error`イベントメッセージは全てバックエンド生成のためこの点は既存パターン通り）。
- **通知範囲**: `socket.emit(...)`（`socket.to(...)`ではなく`socket`自身への`emit`）を使うことで、操作元クライアントにのみ送信される。既存の例外`catch`節のコードと同じ書き方（`socket.emit('error', ...)`、`io.to(...)`ではない）を踏襲すれば自然にFR-004（本人のみ通知）を満たす。
- **Alternatives considered**:
  - Socket.ioのack callback（`socket.emit('order:complete', itemId, callback)`形式）: フロント・共有型（`ClientToServerEvents`）両方の変更が必要になり、既存の「fire-and-forgetでemitし、結果は`error`イベントで受け取る」設計から逸脱する。spec.md Clarifications Q1で不採用と確定済み。
  - 原因ごとに専用コード・専用メッセージを用意: spec.md Clarifications Q2で単一の汎用メッセージと確定済みのため不採用。ただし将来原因別に分けたくなった場合に備え、コード自体は`order:complete`/`order:serve`で分けておく（アクション単位の分離のみ）。

## Decision 2: 店舗無効化時の強制切断は`platformStores.ts`の`PUT /:id`ハンドラ内、`isActive:false`更新の直後に追加する

- **Decision**: `PUT /:id`内の`prisma.store.update({ where: { id: Number(id) }, data: body, select })`実行後、更新後の`store.isActive === false`であれば`fastify.io.in(\`store:${store.id}\`).disconnectSockets(true)`を呼ぶ。`isActive`が`body`に含まれない更新（名称のみ変更等）や、`true`への更新では呼ばない。
- **Rationale**: `staff.ts`（`fastify.io.in(\`user:${id}\`).disconnectSockets(true)`）、`auth.ts`（ログアウト時）と同じ確立済みパターンをルーム粒度だけ`store:${storeId}`に変えて適用する。`socket.ts`の接続確立時ロジック（`socket.join(\`store:${socket.data.storeId}\`)`、118-119行目）と対応が取れている——認証済みスタッフは全員このルームに入るため、ルーム単位の`disconnectSockets`で店舗内の全スタッフ接続を漏れなく切断できる。
- **判定条件**: `body.isActive === false`ではなく、更新後の`store.isActive === false`を見る（`store.update`の戻り値を使う）。これにより「既に無効化済みの店舗へ`{ name: '...' }`のみで更新した場合」も冪等に切断処理が実行されるが、対象接続が既にない/切断済みであれば実質的に無害（spec.md Clarifications Q3で明示的に許容）。
- **削除経路との関係**: `DELETE /:id`は`PUT`とは別ハンドラだが、内部で`prisma.store.update({ where: { id: storeId }, data: { isActive: false } })`（116行目）を直接呼んでおり、`PUT`ハンドラは経由しない。したがって`disconnectSockets`の呼び出しは`PUT`ハンドラ内のロジックをコピーするのではなく、`isActive: false`への更新と`disconnectSockets`呼び出しをセットにした小さな共有ヘルパー関数（例: `deactivateStoreSockets(fastify, storeId)`）を`platformStores.ts`内に定義し、`PUT`と`DELETE`の両方から呼ぶ形にする。これにより「削除処理専用の特別扱いは不要」（spec.md FR-007）という要件を、コード重複なしに満たす。
- **Alternatives considered**:
  - `DELETE`ハンドラにも同じ2行を個別に書く: 動作は同じだが、将来どちらかだけ変更されて挙動がずれるリスクがある。`backend/CLAUDE.md`の「同一リソースの状態変更エンドポイントはガード条件を横並びで揃える」方針に照らし、小さな共有ヘルパーに寄せる方を選ぶ。
  - `store`更新の`preHandler`/`onSend`フックで汎用的に検知する: 対象が1エンドポイントのみで抽象化のメリットが薄く、シンプル第一の原則に反するため不採用。

## Decision 3: テスト方針

- `socket.test.ts`: 既存のガード違反テスト（`status`不一致、グループ/セッション`closed`）のアサーションに、`io`（またはモックされた`socket`）の`emit`が`('error', expect.objectContaining({ code: ErrorCodes.Socket.OrderCompleteRejected / OrderServeRejected }))`で呼ばれたことを追加する。正常系（状態変更が成功するケース）では`error`イベントが呼ばれないことも確認する。
- `platformStores.test.ts`: `authRoutes.test.ts`/`staff.test.ts`と同じ`io.in(room).disconnectSockets`モックパターンを使い、(a) `isActive: false`への更新で`io.in('store:{id}').disconnectSockets(true)`が呼ばれること、(b) `isActive: true`への更新（再有効化）では呼ばれないこと、(c) `name`のみの更新（`isActive`が`body`に含まれない、かつ既存値が`true`）では呼ばれないこと、(d) `DELETE /:id`でも同様に呼ばれることを検証する。
- E2Eテスト（Playwright）は対象外（既存のE2Eスイートに回帰がないことのみ確認する）。
