# WebSockets / Socket.io Events

## Purpose

サーバーとクライアント間でやり取りする Socket.io イベントの仕様を一覧化する。

## Audience

フロント実装者、バックエンド実装者、QA

## Conventions

- イベント名は小文字のコロン区切り（例: `order:created`）
- Payload は JSON。必須フィールドを明記する
- 型定義は `shared/types/index.ts` の `ServerToClientEvents` / `ClientToServerEvents` を参照

## 認証

Socket.io 接続時に httpOnly cookie の JWT を検証する。未認証の場合は接続を拒否する。

## Server → Client

- `order:created`
  - Description: 注文作成時にブロードキャスト
  - Payload: `OrderItem`

- `order:updated`
  - Description: 注文の状態変化（`pending` → `ready` → `served`）をブロードキャスト
  - Payload: `OrderItem`

- `order:cancelled`
  - Description: 注文キャンセル時にブロードキャスト
  - Payload: `itemId: string`（UUID）

- `group:created`
  - Description: グループ作成時にブロードキャスト
  - Payload: `Group`

- `group:updated`
  - Description: グループ更新時（ステータス変更・コース適用等）にブロードキャスト
  - Payload: `Group`

- `seat:created`
  - Description: 席追加時にブロードキャスト
  - Payload: `Seat`

- `seat:updated`
  - Description: 席の占有状態変化時にブロードキャスト
  - Payload: `Seat`

- `menu:soldout`
  - Description: メニュー品目の品切れ状態変化時にブロードキャスト
  - Payload: `(menuItemId: number, soldOut: boolean)`（2引数）

- `menu:created`
  - Description: メニュー品目作成時にブロードキャスト
  - Payload: `MenuItem`

- `menu:updated`
  - Description: メニュー品目更新時にブロードキャスト（`soldOut` 変更時は `menu:soldout` と同時に発火）
  - Payload: `MenuItem`

- `menu:deleted`
  - Description: メニュー品目削除時にブロードキャスト
  - Payload: `menuItemId: number`

- `seatLayout:updated`
  - Description: 席レイアウト保存時にブロードキャスト
  - Payload: `SeatLayoutResponse`

- `session:updated`
  - Description: 営業セッションの開始/終了時にブロードキャスト
  - Payload: `Session`

- `settings:updated`
  - Description: 店舗設定変更時にブロードキャスト
  - Payload: `Setting`

- `staff:called`
  - Description: 顧客がスタッフ呼び出しをした際にブロードキャスト
  - Payload: `(groupId: string, groupName: string)`

## Client → Server

- `order:complete`
  - Description: キッチンが調理完了を報告（`pending` → `ready` に遷移）
  - Payload: `itemId: string`（UUID）

- `order:serve`
  - Description: ホールが提供完了を報告（`ready` → `served` に遷移）
  - Payload: `itemId: string`（UUID）

> 注文作成は REST `POST /api/orders` 経由で行う。Socket では行わない。

## Notes

- 主要な状態遷移は Socket イベントで同期される。REST は参照用および操作に利用する。
- イベント一覧は実装に合わせて随時更新すること。
