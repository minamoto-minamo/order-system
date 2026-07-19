# Phase 1 Data Model: Socket.io切断・エラー通知の一貫性

スキーマ変更は発生しない（`backend/prisma/schema.prisma`は無変更）。本フィーチャーはDBの永続データではなく、Socket.io接続・エラーコードという実行時の状態を扱う。以下は本フィーチャーが扱う既存エンティティおよびSocket.io側の状態のうち、通知・切断制御に関わる部分のみを記載する。

## OrderItem（永続データ、既存）

- `status: OrderItemStatus`（`pending` / `ready` / `served` / `cancelled`）。
- `group: Group`（多対一）。`Group.session: Session`（多対一）。
- **本フィーチャーでの扱い**: `status`・`group.status`・`group.session.status`は読み取りのみ（既存のガード判定条件を変更しない）。判定結果がno-op（状態変更なし）の場合に、その事実を`error`イベントとして操作元クライアントへ通知する対象として扱う。

## Group / Session（永続データ、既存）

- `status`（会計済み`closed`かどうか）が`order:complete`/`order:serve`のガード条件に使われる。本フィーチャーでの変更なし（読み取りのみ）。

## Store（永続データ、既存）

- `isActive: boolean`。プラットフォーム管理者による`PUT /:id`（`isActive`の更新）・`DELETE /:id`（内部で`isActive: false`へ更新後に削除）の対象。
- **本フィーチャーでの扱い**: `isActive`が`false`へ遷移した事実をトリガーに、Socket.io接続の強制切断（後述）を行う。フィールド自体・遷移条件は変更しない。

## Socket.io接続とルーム（実行時状態、永続化されない）

- 認証済みスタッフ接続は接続確立時に`store:${storeId}`ルーム（店舗単位）・`user:${userId}`ルーム（ユーザー単位）へ自動`join`する（`plugins/socket.ts`、既存）。
- **本フィーチャーでの制約**: `store:${storeId}`ルームは、対象店舗が`isActive: false`へ更新された時点で`disconnectSockets(true)`の対象になる。他店舗の`store:${otherId}`ルーム、プラットフォーム管理者の接続には影響しない（FR-008）。

## ErrorCodes.Socket（コード定義、既存グループへの追加）

- 既存: `OrderCompleteFailed` / `OrderServeFailed`（例外`catch`節専用、本フィーチャーでの変更なし）。
- **追加**: `OrderCompleteRejected` / `OrderServeRejected`（ガード違反によるno-op専用。原因によらず単一の汎用メッセージと組み合わせて使う）。

## 通知・切断まとめ（本フィーチャーが追加する挙動）

| 対象 | トリガー | 挙動 | 実現方式 |
|---|---|---|---|
| OrderItem（`order:complete`） | ガード違反（`status !== 'pending'`、または`group`/`session`が`closed`） | 状態変更を行わず、操作元クライアントへ`error`イベントで単一の汎用メッセージを通知 | `socket.emit('error', errorBody(OrderCompleteRejected, message).error)` |
| OrderItem（`order:serve`） | ガード違反（`status !== 'ready'`、または`group`/`session`が`closed`） | 同上 | `socket.emit('error', errorBody(OrderServeRejected, message).error)` |
| Store（`store:${storeId}`ルーム） | `PUT /:id`で`isActive`が`false`へ更新される、または`DELETE /:id`（内部で同じ更新を経由） | 対象店舗の全Socket.io接続を強制切断 | `fastify.io.in(\`store:${storeId}\`).disconnectSockets(true)` |
| Store（`store:${storeId}`ルーム） | `PUT /:id`で`isActive`が`true`へ更新される、または`isActive`を含まない更新 | 強制切断しない（回帰なし） | 変更なし |
