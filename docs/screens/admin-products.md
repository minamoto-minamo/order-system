---
type: Screen
id: S401
title: 商品設定
description: カテゴリツリーと商品一覧の CRUD、飲み放題・コースの編集、品切れ/テイクアウト区分を管理する画面。
resource: frontend/src/pages/admin/Products/Products.tsx
tags: [admin]
---

# 商品設定

商品管理（カテゴリ / 商品 / 飲み放題 / コース）の操作。管理者・フロント実装者 向け。

- Path: `/admin/products`
- Devices: Desktop
- Auth: admin required

## 概要

カテゴリツリーと商品一覧の CRUD。品切れ / テイクアウト区分を管理する。

## UI 要素

- カテゴリツリー、商品一覧、商品モーダル、品切れトグル
- 飲み放題プラン / コースエディタ

## 連携する API・Socket

- CRUD エンドポイント: `/api/menus`, `/api/categories`, `/api/subcategories`
- Socket: `menu:soldout`

参照: [Menus API](../api/endpoints/menus.md) / [Courses API](../api/endpoints/courses.md) / [Drink Plans API](../api/endpoints/drink-plans.md) / [WebSocket イベント](../api/websockets.md)

## 満たすべき条件

- 商品 CRUD が正しく反映され、soldOut は即時配信される。
