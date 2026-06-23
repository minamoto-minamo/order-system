# E004 — Orders

## Purpose

注文作成・更新・取消に関する API。書き込みは主に Socket.io 経由だが、作成/取消は REST でも扱う。

## Audience

フロント実装者、バックエンド実装者

## ID / Paths / Auth

- ID: E004
- Base: `/api/orders`
- Auth: bearer

## Summary

- GET `/api/orders` — 注文一覧（クエリ: groupId, status, sessionId）
- POST `/api/orders` — 注文作成（複数アイテムを一括）
- PUT `/api/orders/:id/cancel` — 注文キャンセル（数量指定）

## Request / Response (例)

POST /api/orders

```json
{
  "groupId": 1,
  "items": [{ "menuItemId": 3, "qty": 2, "isTakeout": false }],
  "courseId": null
}
```

Response 201: order object with status

PUT /api/orders/:id/cancel

```json
{ "qty": 1 }
```

Response 200: updated order object

## Acceptance Criteria

- 作成で 201 を返す
- キャンセルは状態遷移と在庫・キッチンキューへの通知を行う

## Notes

主要な状態遷移は Socket イベントで同期される。
