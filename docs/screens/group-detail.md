---
type: Screen
id: S102
title: グループ詳細
description: グループ単位の注文管理（履歴・追加・部分/全キャンセル）と会計リクエスト・退店などの状態操作を行う画面。
resource: frontend/src/pages/group/GroupDetail/GroupDetail.tsx
tags: [common]
---

# グループ詳細

グループの注文管理と状態操作。フロント実装者・QA 向け。

- Path: `/hall/group/:id`, `/kitchen/group/:id`
- Devices: Mobile（フルスクリーン）/ Tablet（サイドパネル）
- Auth: login + open session required。未認証は `/login`、セッション未開始は `/` へリダイレクトする。

## 概要

注文一覧を表示する。注文追加、部分/全キャンセル、会計・退店などの操作を行う。

## UI 要素

- Tabs: Menu / Order History / Courses（`active` 状態のみ3タブ。`bill_requested` 以降は「注文履歴」タブのみ表示）
- ステータス・数量・操作を含む注文一覧
- 数量コントロール、キャンセルボタン、Complete / Serve ボタン（kitchen）
- Header actions（`active` 状態のみ表示）: QRコード表示、席変更
- Footer（注文履歴タブ）: 小計・税額・合計表示、会計リクエスト ボタン。`bill_requested` 以降は 会計キャンセル / 退店 ボタンに切り替わる
- メニュー一覧の商品タップ時、商品オプション（`optionGroups`）またはセット構成（`isSet`/`setFrames`）を持つ商品は数量ステッパー直接操作の代わりに「オプションを選ぶ」ボタンを表示し、タップするとボトムシートが開く（`OptionSelectSheet` / `SetFrameSelectSheet`、`frontend/src/features/order/components/`）
  - オプション: 分類ごとにラジオボタンで択一選択。`required: true` の分類が未選択の間は追加ボタンが無効
  - セット: 枠ごとにラジオボタンで択一選択。**全ての枠が選択必須**（任意の枠はない）。品切れの選択肢はラジオボタンが無効化される
  - いずれも数量ステッパーを持ち、確定すると確認モーダル（`MenuConfirmModal`）に内訳（`分類名: 選択肢名` または `枠名: 選択商品名`）と金額（オプションは加算後、セットはセット価格のみ）が表示される
- 注文履歴タブに、コース明細（「コース」セクション）と同様の「セット」セクション（`OrderHistorySection`）が表示される。セットの親明細（セット価格・数量）の下に内訳2品がまとめて表示され、親明細にのみキャンセルボタンがある（内訳の個別キャンセルは提供しない）

部分キャンセルのフローは数量選択 UI をサポートする必要がある。

## アクション

- 注文追加 → `POST /api/orders`（バッチ）。商品オプション付き商品は `items[].selectedChoiceIds`、セット商品は `items[].selectedFrameChoiceIds` を含める
- キャンセル → `PUT /api/orders/:id/cancel`。セットの親明細をキャンセルすると、内訳の子明細にも同じ数量変更が連動する（同一トランザクション）。内訳の子明細を直接キャンセルすることはできない（409）
- コース適用 → `POST /api/groups/:id/course`
- コース人数変更 → `PUT /api/groups/:id/course`
- コース解除 → `DELETE /api/groups/:id/course`
- 席変更 → `PUT /api/groups/:id { seatIds, name }`
- 会計リクエスト / 会計キャンセル / グループ締め（退店） → `PUT /api/groups/:id { status }`

## 連携する API・Socket

- `GET /api/groups/:id` — グループ情報取得
- `GET /api/orders?groupId=` — 注文一覧
- `GET /api/menus` — メニュー一覧（注文追加タブ用）
- `GET /api/categories` — カテゴリ一覧
- `GET /api/subcategories` — サブカテゴリ一覧
- `GET /api/courses` — コース一覧
- `GET /api/drink-plans` — 飲み放題プラン一覧
- `GET /api/seats` — 席情報（席ラベル表示用）
- `GET /api/seat-layout` — 席レイアウト取得（席変更モーダル用）
- `GET /api/groups?status=active,bill_requested` — 席変更モーダルでの他グループ占有チェック用
- `POST /api/orders` — 注文追加（バッチ）
- `PUT /api/orders/:id/cancel` — 注文キャンセル
- `POST /api/groups/:id/course` — コース適用
- `PUT /api/groups/:id/course` — コース人数変更
- `DELETE /api/groups/:id/course` — コース解除
- `PUT /api/groups/:id` — グループ状態変更（会計リクエスト・会計キャンセル・退店）、席変更
- Socket 購読: `order:created`, `order:updated`, `order:cancelled`, `group:updated`, `menu:soldout`, `menu:created`, `menu:updated`, `menu:deleted`, `course:created`, `course:updated`, `course:deleted`, `drinkPlan:created`, `drinkPlan:updated`, `drinkPlan:deleted`
- Socket 送信: `order:complete`（pending→ready）, `order:serve`（ready→served）

税率・税込モードは `GET /api/settings` を呼ばず、グループ取得時のレスポンスに含まれる `effectiveTaxRateInHouse` / `effectiveTaxRateTakeout` / `effectiveTaxInclusive` を参照する（`closed` 確定時点でスナップショットされた値）。

参照: [Groups API](../api/endpoints/groups.md) / [Orders API](../api/endpoints/orders.md) / [Menus API](../api/endpoints/menus.md) / [Courses API](../api/endpoints/courses.md) / [Drink Plans API](../api/endpoints/drink-plans.md) / [Seats API](../api/endpoints/seats.md) / [Seat Layout API](../api/endpoints/seat-layout.md) / [WebSocket イベント](../api/websockets.md)

## 満たすべき条件

- 注文追加・キャンセルが API と一致し、Socket で他クライアントに伝播する。
