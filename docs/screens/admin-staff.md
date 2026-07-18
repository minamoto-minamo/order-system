---
type: Screen
id: S405
title: スタッフ管理
description: スタッフアカウントの作成・編集・削除（CRUD）とログイン中デバイスの一覧・強制ログアウトを行う画面。パスワードはハッシュ保存する。
resource: frontend/src/pages/admin/Staff/Staff.tsx
tags: [admin]
---

# スタッフ管理

スタッフアカウント管理（CRUD）。管理者・フロント実装者 向け。

- Path: `/admin/staff`
- Devices: Desktop
- Auth: admin required

## 概要

スタッフの作成・編集・削除。パスワードはハッシュ保存する。ログイン中デバイスの一覧表示・デバイス単位の強制ログアウトも行う。

## UI 要素

- Staff list（ユーザー名・ロールバッジ・作成日、自分自身には selfLabel 表示）
- create/edit modal、delete confirmation（自分自身は削除不可）
- ログイン中デバイス一覧モーダル（発行日時・有効期限・User-Agent・IP、デバイス単位の強制ログアウト）

## 連携する API・Socket

- `GET/POST/PUT/DELETE /api/staff`
- `GET /api/staff/:id/sessions` — ログイン中デバイス一覧
- `DELETE /api/staff/:id/sessions/:sessionId` — 指定デバイスの強制ログアウト

参照: [Staff API](../api/endpoints/staff.md)

## 満たすべき条件

- CRUD が API と一致して動作する。
- パスワードは平文保存されない。
- デバイス一覧・強制ログアウトが API と一致して動作する。
