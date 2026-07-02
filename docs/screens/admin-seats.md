---
type: Screen
id: S402
title: 席レイアウト設定
description: グリッド上でテーブルと席をドラッグ&ドロップ配置し、保存するとホール画面へ即時反映される席レイアウトエディタ。
resource: frontend/src/pages/admin/SeatLayout/SeatLayout.tsx
tags: [admin]
---

# 席レイアウト設定

席レイアウトエディタ（ドラッグ&ドロップ）。管理者・フロント実装者・QA 向け。

- Path: `/admin/seats`
- Devices: Desktop
- Auth: admin required

## 概要

グリッドでテーブルと席を配置する。保存するとホール画面へ即時反映される。

## UI 要素

- Palette（table, seat types）、canvas grid、save button、seat editor

## 連携する API・Socket

- `GET/POST/PUT/DELETE /api/seats`, `/api/seat-tables`

参照: [Seats API](../api/endpoints/seats.md) / [Seat Layout API](../api/endpoints/seat-layout.md)

## 満たすべき条件

- 保存後、`GET /api/seats` の結果に変更が反映される。
- 使用中の席は削除不可。
