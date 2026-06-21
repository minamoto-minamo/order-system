# S102 — Group Detail

## Purpose
グループの注文管理（履歴・追加・キャンセル）と状態操作の仕様。

## Audience
フロント実装者、QA

## ID / Path / Devices / Auth
- ID: S102
- Path: `/hall/group/:id`, `/kitchen/group/:id`
- Devices: Mobile (FS) / Tablet (side panel)
- Auth: none

## Summary
注文一覧の表示、注文追加、部分/全キャンセル、会計/退店などの操作を行う。

## UI Elements
- Tabs: Orders / Menu / Courses
- Order list with status, qty, controls
- Quantity control, Cancel button, Complete/Serve buttons (kitchen)
- Header actions: Bill request, Leave

## Actions / Flows
- Add orders → POST `/api/orders` (batch)
- Cancel → PUT `/api/orders/:id/cancel`
- Bill request / Close group → PUT `/api/groups/:id` { status }

## API / Socket
- GET `/api/orders?groupId=`
- POST `/api/orders`
- PUT `/api/orders/:id/cancel`
- Socket: order:created, order:updated, order:cancelled

## Acceptance Criteria
- 注文追加/キャンセルが API と一致し、Socket で他クライアントに伝播する。

## Notes
- Partial cancel flow must support qty selection UI.

