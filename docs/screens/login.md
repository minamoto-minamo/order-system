---
type: Screen
id: S101
title: ログイン
description: ユーザー名・パスワードによるスタッフ・管理者認証。成功時に httpOnly cookie を受け取りホームへ遷移する画面。
resource: frontend/src/pages/login/Login/Login.tsx
tags: [common]
---

# ログイン

スタッフ・管理者のログイン画面。フロント実装者・QA 向け。

- Path: `/login`
- Devices: Desktop / Tablet / Mobile
- Auth: none。認証済みユーザーがアクセスすると `/` へリダイレクトする。

## 概要

ユーザー名・パスワード入力で認証する。成功時に httpOnly cookie を受け取りホーム（`/`）へ遷移する。ロールは `staff` / `admin` の2値。`admin` ロールのみ管理メニューへのアクセスが許可される。ホール・キッチンはロールではなくホーム画面で選択するモードである。

## UI 要素

- Username input
- Password input
- Login button
- Error message area

## アクション

- 資格情報を送信 → `POST /api/auth/login { username, password }`
- 成功時 → `Set-Cookie(token)` + `/` へリダイレクト

バックエンドで rate-limiting を設定済み。エラー時は分かりやすいメッセージを表示する。

## 連携する API・Socket

- `POST /api/auth/login`
- `GET /api/auth/me`（認証チェック用）

参照: [Auth API](../api/endpoints/auth.md)

## 満たすべき条件

- 正常な資格情報で cookie がセットされる。
- エラー時は適切なメッセージを表示する。
