---
type: Screen
id: S200
title: ホール
description: 席レイアウトを表示し、空席を複数選択してグループを作成するホール店員向けの席一覧画面。
resource: frontend/src/pages/hall/Hall/Hall.tsx
tags: [hall]
---

# ホール

席一覧とグループ作成フロー。フロント実装者・QA 向け。

- Path: `/hall`
- Devices: Mobile
- Auth: login + open session required。未認証は `/login`、セッション未開始は `/` へリダイレクトする。

## 概要

席レイアウトを読み表示する。空席を複数選択してグループを作成する。

## UI 要素

- Seat grid（label, status badge）
- ステータス件数バー（空席 / 着席 / 提供待ち / 会計リクエスト）
- 複数選択、Create group ボタン
- Guest count modal（`CreateGroupSheet`）
- 閉店時刻の警告バナー（`AppHeader` 共通機能）
- スタッフ呼び出しバナー（`staff:called` 受信時に表示）

## アクション

- 席レイアウト取得 → `GET /api/seat-layout`
- グループ作成 → `POST /api/groups`
- Socket イベントで UI 更新: `group:created`, `group:updated`, `seat:created`, `seat:updated`, `seatLayout:updated`, `staff:called`

## 連携する API・Socket

- `GET /api/seat-layout` — 席レイアウト一括取得（席・テーブル枠・グリッドサイズ）
- `GET /api/groups?status=active,bill_requested` — アクティブグループ一覧
- `GET /api/orders?status=ready` — 提供待ち注文数の取得
- `POST /api/groups`
- Socket 購読: `group:created`, `group:updated`, `seat:created`, `seat:updated`, `seatLayout:updated`, `order:created`, `order:updated`, `order:cancelled`, `staff:called`

参照: [Seats API](../api/endpoints/seats.md) / [Seat Layout API](../api/endpoints/seat-layout.md) / [Groups API](../api/endpoints/groups.md) / [Orders API](../api/endpoints/orders.md) / [WebSocket イベント](../api/websockets.md)

## 満たすべき条件

- 空席選択からグループ作成が可能。表示ステータスは groups(active) と一致する。
