---
type: Screen
id: S405
title: スタッフ管理
description: スタッフアカウントの作成・編集・削除（CRUD）を行う画面。パスワードはハッシュ保存する。
resource: frontend/src/pages/admin/Staff/Staff.tsx
tags: [admin]
---

# スタッフ管理

スタッフアカウント管理（CRUD）。管理者・フロント実装者 向け。

- Path: `/admin/staff`
- Devices: Desktop
- Auth: admin required

## 概要

スタッフの作成・編集・削除。パスワードはハッシュ保存する。

## UI 要素

- Staff list、create/edit modal、delete confirmation

## 連携する API・Socket

- `GET/POST/PUT/DELETE /api/staff`

参照: [Staff API](../api/endpoints/staff.md)

## 満たすべき条件

- CRUD が API と一致して動作する。
- パスワードは平文保存されない。
