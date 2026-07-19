---
type: Screen
id: S401
title: 商品設定
description: カテゴリツリーと商品一覧の CRUD、品切れ/テイクアウト区分を管理する画面。
resource: frontend/src/pages/admin/Products/Products.tsx
tags: [admin]
---

# 商品設定

商品管理（カテゴリ / 商品）の操作。管理者・フロント実装者 向け。

- Path: `/admin/products`
- Devices: Desktop
- Auth: admin required

## 概要

カテゴリツリーと商品一覧の CRUD。品切れ / テイクアウト区分を管理する。

## UI 要素

- カテゴリツリー、商品一覧、商品モーダル、品切れトグル
- 削除確認モーダル（`BottomSheetModal`）。商品・カテゴリ・小分類のいずれの削除も確認ステップを経る。カテゴリ・小分類はカスケード削除を行わず、配下に小分類・商品が残っている場合は 409 で削除を拒否する既存仕様のため、削除確認では「配下に小分類・商品がある場合は削除できません」等の制約警告文言を表示する（カスケード削除される旨の表示ではない）

## 連携する API・Socket

- CRUD エンドポイント: `/api/menus`, `/api/categories`, `/api/subcategories`
- Socket: `menu:soldout`

参照: [Menus API](../api/endpoints/menus.md) / [WebSocket イベント](../api/websockets.md)

## 満たすべき条件

- 商品 CRUD が正しく反映され、soldOut は即時配信される。
