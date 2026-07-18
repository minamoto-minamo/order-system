---
type: Screen
id: S100
title: ホーム
description: アプリ起動時のモード選択（Hall / Kitchen / Admin）と営業セッションの開始・締め・再開を行う画面。
resource: frontend/src/pages/home/Home/Home.tsx
tags: [common]
---

# ホーム

アプリ起動時の入口。モード選択と営業セッション操作を提供する。フロント実装者・QA・PM 向け。

- Path: `/`
- Devices: Mobile / Tablet / Desktop
- Auth: login required。未認証は `/login` へリダイレクトする。

## 概要

モード（Hall / Kitchen / Admin）を選択する。現在の営業セッションを表示し、営業開始・締め・再開の操作を提供する。

## UI 要素

- Mode buttons: Hall / Kitchen / Admin（Admin は admin ロール以外は disabled）
- Session badge: status（open / closed）と開始時刻
- Action buttons: Start session / Close session / Reopen

## アクション

- Start session → `POST /api/sessions`（admin のみ）
- Close session → `PUT /api/sessions/:id { status: 'closed' }`（admin のみ）
- Reopen session → `PUT /api/sessions/:id { status: 'open' }`（admin のみ）

セッション締めには確認モーダルを必須とする。

## 連携する API・Socket

- `GET /api/sessions/current` — 現在セッション取得
- `GET /api/settings` — 店舗名の表示
- `POST /api/sessions`（requireAdmin）
- `PUT /api/sessions/:id`（requireAdmin）
- Socket 購読: `session:updated`, `settings:updated`

参照: [Sessions API](../api/endpoints/sessions.md) / [Settings API](../api/endpoints/settings.md) / [WebSocket イベント](../api/websockets.md)

## 満たすべき条件

- Mode buttons が正しいルートへ遷移する。
- セッションの開始・締め・再開が API を呼び、新しい状態を反映する。
