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

- カテゴリツリー、商品一覧、商品モーダル（`ProductModal.tsx`）、品切れトグル
- 削除確認モーダル（`BottomSheetModal`）。商品・カテゴリ・小分類のいずれの削除も確認ステップを経る。カテゴリ・小分類はカスケード削除を行わず、配下に小分類・商品が残っている場合は 409 で削除を拒否する既存仕様のため、削除確認では「配下に小分類・商品がある場合は削除できません」等の制約警告文言を表示する（カスケード削除される旨の表示ではない）
- 商品オプション編集（`OptionGroupEditor.tsx`）: 商品モーダル内に組み込み。オプション分類（Group）の追加・削除、分類ごとの「注文時に選択必須」トグル、分類内の選択肢（名前・追加金額）の追加・削除を行う。追加金額は正・0・負のいずれも入力可（割引選択肢を表現できる）。保存すると `optionGroups` が全置換される
- セットメニュー構成編集（`SetFrameEditor.tsx`）: 商品モーダル内の「セットメニュー」チェックボックスをオンにすると表示され、`OptionGroupEditor` の代わりに表示される（排他。1商品はオプション付き商品かセット商品のどちらか一方にしかなれない）。内訳の枠（Frame）の追加・削除、各枠内の選択肢（既存の通常商品からのセレクトボックスによるピッカー）の追加・削除を行う。ピッカーの選択肢一覧はセット商品（`isSet: true`、他のセット商品・自分自身を含む）を除外したもの。保存すると `setFrames` が全置換される

## 連携する API・Socket

- CRUD エンドポイント: `/api/menus`, `/api/categories`, `/api/subcategories`
- Socket: `menu:soldout`

参照: [Menus API](../api/endpoints/menus.md) / [WebSocket イベント](../api/websockets.md)

## 満たすべき条件

- 商品 CRUD が正しく反映され、soldOut は即時配信される。
- セットメニュー（`isSet: true`）は商品オプション（`optionGroups`）と同時設定できない（保存時に 422 エラー）。
