---
type: API Endpoint Group
id: E012
title: Seat Layout
description: 席レイアウト（キャンバスサイズ・グリッドサイズ・テーブル・席配置）の一括取得・保存 API。
resource: backend/src/routes/seatLayout.ts
tags: [seat-layout, seats, api]
---

# Seat Layout

席レイアウト（キャンバスサイズ・グリッドサイズ・テーブル・席配置）の一括取得・保存。個別の席・テーブル枠操作は [Seats / SeatTables](./seats.md) を参照。管理 UI 実装者・バックエンド実装者向け。

- Base: `/api/seat-layout`
- Auth: GET は bearer、PUT は bearer + admin 限定

## エンドポイント

- `GET /api/seat-layout` — レイアウト全体取得
- `PUT /api/seat-layout` — レイアウト一括保存（admin のみ）

## GET /api/seat-layout

```json
{
  "canvasCols": 16,
  "canvasRows": 12,
  "canvasColsMin": 8,
  "canvasColsMax": 32,
  "canvasRowsMin": 6,
  "canvasRowsMax": 24,
  "gridSize": 48,
  "gridSizeMin": 32,
  "gridSizeMax": 80,
  "tables": [
    { "id": 1, "label": "A", "x": 2, "y": 2, "w": 3, "h": 2 }
  ],
  "seats": [
    { "id": 1, "label": "A1", "x": 2, "y": 2, "type": "table", "tableId": 1 },
    { "id": 2, "label": "C1", "x": 8, "y": 1, "type": "counter", "tableId": null }
  ]
}
```

- 座標・サイズはグリッド単位の整数
- `Min` / `Max` フィールドはキャンバス編集時の UI 制約値

## PUT /api/seat-layout

```json
{
  "canvasCols": 16,
  "canvasRows": 12,
  "gridSize": 48,
  "tables": [
    { "id": 1, "label": "A", "x": 2, "y": 2, "w": 3, "h": 2 },
    { "id": -1, "label": "B", "x": 6, "y": 2, "w": 3, "h": 2 }
  ],
  "seats": [
    { "id": 1, "label": "A1", "x": 2, "y": 2, "tableId": 1 },
    { "id": -1, "label": "B1", "x": 6, "y": 2, "tableId": -1 }
  ]
}
```

- `id < 0` は新規作成、`id > 0` は既存レコードの更新
- リクエストに含まれない既存 id は削除される
- 使用中の席（active/bill_requested グループに紐づく）を削除しようとすると 409
- `canvasCols` / `canvasRows` / `gridSize` は DB の Min/Max 制約内でないと 400
- `Setting.canvasCols` / `canvasRows` / `gridSize` を同時に更新する

Response: 保存後のレイアウト（GET と同形式）
Socket emit: `seatLayout:updated`（保存後の SeatLayoutResponse オブジェクト）

テーブル・席の追加・更新・削除を1リクエストで完結できる。使用中席の誤削除を防止し、保存後に接続中の全スタッフクライアントへリアルタイム通知する。

座席タイプ（`type`）は `tableId` の有無から自動判定（`table` / `counter`）。クライアント側で `tableId` に仮 id（負数）を指定した場合、サーバーが実 id に解決して保存する。
