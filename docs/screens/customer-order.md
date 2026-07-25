---
type: Screen
id: S103
title: 客用注文
description: 客席 QR などから開く注文画面。メニュー閲覧、注文送信、注文履歴確認、スタッフ呼び出し、会計依頼を行う。
resource: frontend/src/pages/customer/CustomerOrder/CustomerOrder.tsx
tags: [customer]
---

# 客用注文

来店客が自分の端末で操作する注文画面。フロント実装者・QA 向け。

- Path: `/order/:id`
- Devices: Mobile / Tablet
- Auth: none。スタッフ認証不要。存在しないグループIDや受付外ステータスでは操作不可表示になる。

## 概要

グループ ID を URL から受け取り、対象グループの店内メニューと注文履歴を表示する。`group.status === 'active'` の間は追加注文と会計依頼が可能で、`bill_requested` では注文履歴表示のみに制限される。

## UI 要素

- Header: グループ名、スタッフ呼び出しボタン、会計依頼ボタン（`active` 時のみ）
- Tabs: Menu / Order History（`bill_requested` 時は Order History のみ）
- Menu list: カテゴリ、サブカテゴリ、数量操作
- 商品オプション（`optionGroups`）またはセット構成（`isSet`/`setFrames`）を持つ商品は数量ステッパーの代わりに「オプションを選ぶ」ボタンを表示し、タップするとボトムシート（`OptionSelectSheet` / `SetFrameSelectSheet`、ホール画面（グループ詳細）と共通コンポーネント）が開く。分類ごと（オプション）または枠ごと（セット、全枠必須）にラジオボタンで択一選択する
- Slide-up footer: 注文確認ボタン（選択数が 1 件以上のときのみ）
- 注文確認モーダル: 商品名の下にオプション内訳（`分類名: 選択肢名`）またはセット内訳（`枠名: 選択商品名`）を表示する
- スタッフ呼び出し確認モーダル
- 会計依頼確認モーダル
- 状態別表示: loading / group not found / order not accepted
- 注文履歴タブに、コース明細と同様の「セット」セクションが表示される。セットの親明細の下に内訳2品がまとめて表示される（客用画面にキャンセル操作はない）

## アクション

- 初期表示時にグループ情報・メニュー・注文履歴を並列取得する
- 数量選択後、注文確認モーダルから `POST /api/customer/orders` を送信する。商品オプション付き商品は `items[].selectedChoiceIds`、セット商品は `items[].selectedFrameChoiceIds` を含める
- スタッフ呼び出し確認後、`POST /api/customer/groups/:id/call-staff` を送信する
- 会計依頼確認後、`POST /api/customer/groups/:id/bill` を送信する
- Socket 再接続時はデータ再取得し、対象グループ room へ再 join する

品切れエラー（`customer.orders.sold_out`）時は該当商品の数量をクリアし、メニュー一覧を再取得して最新状態に同期する。

## 連携する API・Socket

- `GET /api/customer/groups/:id` - グループ情報取得
- `GET /api/customer/groups/:id/menus` - 客用メニュー、カテゴリ、サブカテゴリ取得（各商品に `optionGroups`・`isSet`・`setFrames` を含む）
- `GET /api/customer/groups/:id/orders` - 注文履歴取得
- `POST /api/customer/orders` - 注文送信
- `POST /api/customer/groups/:id/call-staff` - スタッフ呼び出し
- `POST /api/customer/groups/:id/bill` - 会計依頼
- Socket 送信: `group:join`
- Socket 購読: `order:created`, `order:updated`, `order:cancelled`, `group:updated`
- Socket 接続イベント: `connect` 時に再取得と再 join を行う

参照: [Groups API](../api/endpoints/groups.md) / [Orders API](../api/endpoints/orders.md) / [Menus API](../api/endpoints/menus.md) / [WebSocket イベント](../api/websockets.md)

## 満たすべき条件

- `active` 状態では追加注文・スタッフ呼び出し・会計依頼ができる。
- `bill_requested` 状態では追加注文 UI が消え、履歴閲覧のみになる。
- 同一グループの注文・状態更新は Socket 受信で即時反映される。
