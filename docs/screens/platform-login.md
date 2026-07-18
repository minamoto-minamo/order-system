---
type: Screen
id: S500
title: プラットフォーム管理者ログイン
description: プラットフォーム管理者がユーザー名・パスワードで認証し、店舗管理画面へ入るためのログイン画面。
resource: frontend/src/pages/platform/PlatformLogin/PlatformLogin.tsx
tags: [platform]
---

# プラットフォーム管理者ログイン

プラットフォーム管理者専用のログイン画面。フロント実装者・QA・運用担当 向け。

- Path: `/platform/login`
- Devices: Desktop / Tablet / Mobile
- Auth: none。認証済みプラットフォーム管理者がアクセスすると `/platform/stores` へリダイレクトする。

## 概要

ユーザー名・パスワードでプラットフォーム管理者認証を行う。成功時は platform 用 auth store を更新し、店舗管理へ遷移する。入力不足と認証失敗は別メッセージで扱う。

## UI 要素

- Username input
- Password input
- Login button
- Error message area
- Loading state（送信中ラベル）

## アクション

- 初期化時に `GET /api/platform/auth/me` で既存ログイン状態を確認する
- 入力チェック後、`POST /api/platform/auth/login { username, password }` を送信する
- 成功時は `/platform/stores` へ遷移する
- 失敗時はエラーメッセージを表示し、その場に留まる

## 連携する API・Socket

- `GET /api/platform/auth/me` - 既存セッション確認（App 初期化時）
- `POST /api/platform/auth/login` - ログイン
- Socket 連携なし

参照: [Platform API](../api/endpoints/platform.md)

## 満たすべき条件

- ユーザー名またはパスワード未入力では API を呼ばず入力エラーを表示する。
- 正常な資格情報でログイン成功し、店舗管理へ遷移する。
- 認証失敗時は再入力可能なままエラー表示を維持する。
