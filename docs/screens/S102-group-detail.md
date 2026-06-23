# S102 — Group Detail

## Purpose

グループの注文管理（履歴・追加・キャンセル）と状態操作の仕様。

## Audience

フロント実装者、QA

## ID / Path / Devices / Auth

- ID: S102
- Path: `/hall/group/:id`, `/kitchen/group/:id`
- Devices: Mobile (FS) / Tablet (side panel)
- Auth: login + open session required（未認証は `/login`、セッション未開始は `/` へリダイレクト）

## Summary

注文一覧の表示、注文追加、部分/全キャンセル、会計/退店などの操作を行う。

## UI Elements

- Tabs: Menu / Order History / Courses（`active` 状態のみ3タブ。`bill_requested` 以降は「注文履歴」タブのみ表示）
- Order list with status, qty, controls
- Quantity control, Cancel button, Complete/Serve buttons (kitchen)
- Header actions: Bill request, Leave

## Actions / Flows

- Add orders → POST `/api/orders` (batch)
- Cancel → PUT `/api/orders/:id/cancel`
- Bill request / Close group → PUT `/api/groups/:id` { status }

## API / Socket

- GET `/api/groups/:id` — グループ情報取得
- GET `/api/orders?groupId=` — 注文一覧
- GET `/api/menus` — メニュー一覧（注文追加タブ用）
- GET `/api/categories` — カテゴリ一覧
- GET `/api/subcategories` — サブカテゴリ一覧
- GET `/api/courses` — コース一覧
- GET `/api/drink-plans` — 飲み放題プラン一覧
- GET `/api/seats` — 席情報（席ラベル表示用）
- GET `/api/settings` — 税率取得
- POST `/api/orders` — 注文追加（バッチ）
- PUT `/api/orders/:id/cancel` — 注文キャンセル
- PUT `/api/groups/:id` — グループ状態変更（コース適用・会計リクエスト・退店処理）
- Socket（購読）: order:created, order:updated, order:cancelled, group:updated, settings:updated
- Socket（送信）: order:complete（pending→ready）, order:serve（ready→served）

## Acceptance Criteria

- 注文追加/キャンセルが API と一致し、Socket で他クライアントに伝播する。

## Notes

- Partial cancel flow must support qty selection UI.
