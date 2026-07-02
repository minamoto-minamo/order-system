---
type: WebSocket Events
title: WebSocket / Socket.io イベント
description: サーバーとクライアント間でやり取りする Socket.io イベントの一覧と payload 仕様。
resource: ../../backend/src/plugins/socket.ts
tags: [websocket, socketio, realtime, events]
---

主要な状態遷移は Socket.io イベントで同期する。REST は参照および操作に用いる。イベント一覧は実装に合わせて随時更新する。

## 規約

イベント名は小文字のコロン区切り（例: `order:created`）。payload は JSON で、必須フィールドを明記する。型定義は [`shared/types/index.ts`](../../shared/types/index.ts) の `ServerToClientEvents` / `ClientToServerEvents` を参照。

接続時に httpOnly cookie の JWT を検証する。未認証の場合は接続を拒否する。

## Server → Client

- `order:created` — 注文作成時にブロードキャスト。payload: `OrderItem`
- `order:updated` — 注文の状態変化（`pending` → `ready` → `served`）をブロードキャスト。payload: `OrderItem`
- `order:cancelled` — 注文キャンセル時にブロードキャスト。payload: `itemId: string`（UUID）
- `group:created` — グループ作成時にブロードキャスト。payload: `Group`
- `group:updated` — グループ更新時（ステータス変更・コース適用等）にブロードキャスト。payload: `Group`
- `seat:created` — 席追加時にブロードキャスト。payload: `Seat`
- `seat:updated` — 席の占有状態変化時にブロードキャスト。payload: `Seat`
- `menu:soldout` — メニュー品目の品切れ状態変化時にブロードキャスト。payload: `(menuItemId: number, soldOut: boolean)`（2引数）
- `menu:created` — メニュー品目作成時にブロードキャスト。payload: `MenuItem`
- `menu:updated` — メニュー品目更新時にブロードキャスト（`soldOut` 変更時は `menu:soldout` と同時に発火）。payload: `MenuItem`
- `menu:deleted` — メニュー品目削除時にブロードキャスト。payload: `menuItemId: number`
- `seatLayout:updated` — 席レイアウト保存時にブロードキャスト。payload: `SeatLayoutResponse`
- `session:updated` — 営業セッションの開始/終了時にブロードキャスト。payload: `Session`
- `settings:updated` — 店舗設定変更時にブロードキャスト。payload: `Setting`
- `staff:called` — 顧客がスタッフ呼び出しをした際にブロードキャスト。payload: `(groupId: string, groupName: string)`

## Client → Server

- `order:complete` — キッチンが調理完了を報告（`pending` → `ready` に遷移）。payload: `itemId: string`（UUID）
- `order:serve` — ホールが提供完了を報告（`ready` → `served` に遷移）。payload: `itemId: string`（UUID）

注文作成は REST `POST /api/orders` 経由で行う。Socket では行わない。

## 関連

API 全体の契約は [API 全体仕様](spec.md) を参照。
