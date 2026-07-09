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
- `course:created` — コース作成時にブロードキャスト。payload: `Course`
- `course:updated` — コース更新時にブロードキャスト。payload: `Course`
- `course:deleted` — コース削除時にブロードキャスト。payload: `courseId: number`
- `drinkPlan:created` — ドリンクプラン作成時にブロードキャスト。payload: `DrinkPlan`
- `drinkPlan:updated` — ドリンクプラン更新時にブロードキャスト。payload: `DrinkPlan`
- `drinkPlan:deleted` — ドリンクプラン削除時にブロードキャスト。payload: `drinkPlanId: number`
- `seatLayout:updated` — 席レイアウト保存時にブロードキャスト。payload: `SeatLayoutResponse`
- `session:updated` — 営業セッションの開始/終了時にブロードキャスト。payload: `Session`
- `settings:updated` — 店舗設定変更時にブロードキャスト。payload: `PublicSetting`（`storeName` / `closingTime` のみ。未認証の客用ソケットにも配信されるため税率等の内部設定値は含まない）
- `staff:called` — 顧客がスタッフ呼び出しをした際にブロードキャスト。payload: `(groupId: string, groupName: string)`
- `error` — Socket 経由の操作（`order:complete` / `order:serve`）が失敗した際に発生元クライアントへ送信。payload: `ApiErrorPayload`

## Client → Server

- `group:join` — 客用ゲスト接続が自グループの更新を受信するために join する。payload: `groupId: string`（UUID）。サーバー側で対象グループが自 storeId に属するか検証してから join する
- `order:complete` — キッチンが調理完了を報告（`pending` → `ready` に遷移）。payload: `itemId: string`（UUID）
- `order:serve` — ホールが提供完了を報告（`ready` → `served` に遷移）。payload: `itemId: string`（UUID）

注文作成は REST `POST /api/orders`（スタッフ）または `POST /api/customer/orders`（客）経由で行う。Socket では行わない。

## 関連

API 全体の契約は [API 全体仕様](spec.md) を参照。
