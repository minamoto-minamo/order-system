# S300 — Kitchen

## Purpose

キッチン用に未調理・提供待ち注文の表示と状態操作を定義する。

## Audience

フロント実装者、Kitchen UX, QA

## ID / Path / Devices / Auth

- ID: S300
- Path: `/kitchen`
- Devices: Tablet / Large display
- Auth: login + open session required（未認証は `/login`、セッション未開始は `/` へリダイレクト）

## Summary

未調理注文を横断表示し、調理完了・提供完了の操作を Socket 経由で行う。

## UI Elements

- View toggle (card / ticket)
- Pending list, Ready area
- Complete / Serve buttons, elapsed time

## Actions / Flows

- order:complete(itemId) → server updates status pending→ready
- order:serve(itemId) → server updates status ready→served

## API / Socket

- GET `/api/orders?status=pending,ready`
- GET `/api/groups?status=active,bill_requested`
- GET `/api/seats`
- GET `/api/menus`
- GET `/api/categories`
- GET `/api/subcategories`
- Socket receives: order:created, order:updated, order:cancelled, group:created, group:updated, seat:updated, menu:soldout
- Client emits: order:complete, order:serve

## Acceptance Criteria

- Socket イベントで UI と DB 状態が同期すること。
