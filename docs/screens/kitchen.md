---
type: Screen
id: S300
title: キッチン
description: 未調理・提供待ち注文を横断表示し、調理完了・提供完了の操作を Socket 経由で行うキッチン向け画面。
resource: frontend/src/pages/kitchen/Kitchen/Kitchen.tsx
tags: [kitchen]
---

# キッチン

未調理・提供待ち注文の表示と状態操作。フロント実装者・Kitchen UX・QA 向け。

- Path: `/kitchen`
- Devices: Tablet / Large display
- Auth: login + open session required。未認証は `/login`、セッション未開始は `/` へリダイレクトする。

## 概要

未調理注文を横断表示する。調理完了・提供完了の操作を Socket 経由で行う。

## UI 要素

- View toggle（card / ticket）
- Pending list, Ready area
- Complete / Serve ボタン、経過時間
- チケットの商品名の下に、選択されたオプション（`分類名: 選択肢名`）を併記する（商品オプション機能）
- セットメニューの内訳商品は、セット本体とは別に通常商品と同じ形の個別チケットとして表示される。セット親明細自体は確定時点で `served` 扱いのため厨房画面には現れない

## アクション

- `order:complete(itemId)` → サーバーが status を pending→ready に更新
- `order:serve(itemId)` → サーバーが status を ready→served に更新

## 連携する API・Socket

- `GET /api/orders?status=pending,ready`
- `GET /api/groups?status=active,bill_requested`
- `GET /api/seats`
- `GET /api/menus`
- `GET /api/categories`
- `GET /api/subcategories`
- Socket 受信: `order:created`, `order:updated`, `order:cancelled`, `group:created`, `group:updated`, `seat:updated`, `menu:soldout`, `menu:created`, `menu:updated`, `menu:deleted`
- Client 送信: `order:complete`, `order:serve`

参照: [Orders API](../api/endpoints/orders.md) / [Groups API](../api/endpoints/groups.md) / [Seats API](../api/endpoints/seats.md) / [Menus API](../api/endpoints/menus.md) / [WebSocket イベント](../api/websockets.md)

## 満たすべき条件

- Socket イベントで UI と DB 状態が同期する。
