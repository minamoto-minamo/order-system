---
type: Screen
id: S406
title: コース設定
description: コース（食べ放題）と飲み放題プランの作成・編集・削除（CRUD）を行う管理者向け画面。
resource: frontend/src/pages/admin/Courses/Courses.tsx
tags: [admin]
---

# コース設定

コース・飲み放題プランの管理（CRUD）。管理者・フロント実装者 向け。

- Path: `/admin/courses`
- Devices: Desktop
- Auth: admin required

## 概要

飲み放題プランとコースをそれぞれ一覧表示し、作成・編集・削除する。コースは飲み放題プランを内包でき、対象メニューを個数付きで紐付ける。

## UI 要素

- 飲み放題プランセクション（名称・価格・対象メニュー数を一覧表示）
- コースセクション（名称・価格・紐付く飲み放題プラン・フード内容を一覧表示）
- 飲み放題プラン作成/編集モーダル（名称・価格・対象メニューのカテゴリ別選択、カテゴリ単位の一括選択）
- コース作成/編集モーダル（名称・価格・飲み放題プラン選択・フードメニューのカテゴリ別個数指定）
- 削除確認（各モーダルの delete アクション）

## 連携する API・Socket

- `GET/POST/PUT/DELETE /api/drink-plans`
- `GET/POST/PUT/DELETE /api/courses`
- `GET /api/menus` / `GET /api/categories` / `GET /api/subcategories` — 対象メニュー選択用

参照: [Courses API](../api/endpoints/courses.md) / [Drink Plans API](../api/endpoints/drink-plans.md) / [Menus API](../api/endpoints/menus.md)

## 満たすべき条件

- 飲み放題プラン・コースの CRUD が API と一致して動作する。
- コース編集時、紐付く飲み放題プランとフードメニュー内容が正しく初期表示される。
