# Phase 1 Data Model: GroupDetailの初期ロードとSocketイベントの競合による注文消失を修正する

本フィーチャーはバックエンドのデータモデル（Prismaスキーマ・DBテーブル）を変更しない。既存の `OrderItem`（`shared/types/index.ts`）をそのまま使用する。

以下はフロントエンド内部でのみ使用する、本フィーチャーで新規導入する一時的なランタイム表現。永続化はしない。

## QueuedOrderEvent（新規・フロントエンド内部のみ）

`fetchAll` 実行中に受信した注文関連Socketイベントを、完了まで一時的に保持するための判別共用体。`GroupDetail.tsx` 内のrefにのみ存在し、コンポーネント外へは公開しない。

```ts
type QueuedOrderEvent =
  | { type: 'created'; item: OrderItem }
  | { type: 'updated'; item: OrderItem }
  | { type: 'cancelled'; id: string }
```

| フィールド | 型 | 説明 |
|---|---|---|
| `type` | `'created' \| 'updated' \| 'cancelled'` | 受信したSocketイベントの種別（`order:created`/`order:updated`/`order:cancelled`に対応） |
| `item` | `OrderItem` | `created`/`updated`イベントのペイロード（サーバーから送出される完全なOrderItem） |
| `id` | `string` | `cancelled`イベントのペイロード（idのみ送出される既存仕様に合わせる） |

**ライフサイクル**:
1. `fetchAll`開始時に空配列へリセットされる。
2. フェッチ実行中（`isFetchingRef.current === true`の間）に受信した対象イベントが末尾へ追加される（受信順を保持）。
3. フェッチ完了（成功）時、`applyQueuedOrderEvents(base, queue)` に渡され、RESTスナップショットへ順番に適用された結果が`items` stateとして採用される。
4. 適用後、キューはクリアされる。
5. フェッチが失敗した場合、または自身が最新世代でなくなっていた場合は、キューの内容を破棄する（stateには適用しない）。

## FetchGeneration（新規・フロントエンド内部のみ）

多重フェッチ（Socket再接続の連打等）が競合した際に、最新のフェッチ結果のみをstateへ反映するための単調増加カウンタ。`GroupDetail.tsx`内のrefで保持する（`useRef<number>(0)`）。

- `fetchAll`が呼ばれるたびにインクリメントされ、そのフェッチ呼び出し固有の世代番号として捕捉される。
- フェッチ完了時、捕捉した世代番号が現在のref値と一致する場合のみ、state更新（`setGroup`/`setItems`等）とキュー再適用を行う。一致しない場合は完全に破棄する。

## 既存エンティティとの関係

- `OrderItem`（既存・変更なし）: `GroupDetail`の`items` state（`OrderItem[]`）の要素型。`QueuedOrderEvent`の`item`フィールドはこの型をそのまま使う。
- 本フィーチャーによる状態遷移の追加はない（`OrderItemStatus`の値・遷移ルールは変更しない）。
