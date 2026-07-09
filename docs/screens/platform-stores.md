---
type: Screen
id: S501
title: プラットフォーム店舗管理
description: プラットフォーム管理者が店舗一覧の閲覧、新規追加、名称変更、有効/無効切り替え、ログアウトを行う画面。
resource: frontend/src/pages/platform/StoreList/StoreList.tsx
tags: [platform]
---

# プラットフォーム店舗管理

店舗マスタを管理する一覧画面。フロント実装者・QA・運用担当 向け。

- Path: `/platform/stores`
- Devices: Desktop / Tablet
- Auth: platform admin required。未認証時は `/platform/login` へリダイレクトする。

## 概要

登録済み店舗の一覧表示、店舗追加、店舗名編集、有効/無効切り替えを行う。ヘッダーからログアウトできる。データ取得失敗時は通常一覧ではなくエラー表示に切り替える。

## UI 要素

- Header: 画面タイトル、ログアウトボタン
- SubHeader: 店舗追加ボタン
- Store rows: 店舗名、稼働状態バッジ、サブドメイン、作成日、編集ボタン、有効/無効切り替えボタン
- Store form modal
  - add: subdomain, name, adminUsername, adminPassword
  - edit: subdomain（表示のみ）, name
- Toggle confirmation modal
- Empty state / load error state

## アクション

- 初期表示で `GET /api/platform/stores` を実行する
- 店舗追加モーダルから `POST /api/platform/stores` を送信する
- 店舗編集モーダルから `PUT /api/platform/stores/:id { name }` を送信する
- 有効/無効確認後、`PUT /api/platform/stores/:id { isActive }` を送信する
- ログアウト時は `POST /api/platform/auth/logout` を送信し、失敗してもローカル認証状態は解除する

認証切れで `/api/platform/*` が 401 を返した場合、API クライアントが platform auth store を `null` にし、ルートガード経由でログイン画面へ戻す。

## 連携する API・Socket

- `GET /api/platform/auth/me` - 画面到達前の認証確認（App 初期化時）
- `GET /api/platform/stores` - 店舗一覧取得
- `POST /api/platform/stores` - 店舗追加
- `PUT /api/platform/stores/:id` - 店舗名更新、有効/無効切り替え
- `POST /api/platform/auth/logout` - ログアウト
- Socket 連携なし

参照: [Platform API](../api/endpoints/platform.md)

## 満たすべき条件

- 初期表示で一覧・空状態・ロードエラーのいずれかが適切に表示される。
- 追加・編集・有効/無効切り替えが成功すると一覧へ即時反映される。
- ログアウトまたは 401 応答で管理画面に残留しない。
