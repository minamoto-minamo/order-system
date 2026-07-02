---
type: Screen
id: S404
title: 詳細設定
description: 店舗名・税率・営業終了時刻など Setting レコードを編集し、settings:updated で即時配信する画面。
resource: frontend/src/pages/admin/Settings/Settings.tsx
tags: [admin]
---

# 詳細設定

店舗設定・税率・営業終了時刻などの編集。管理者・運用担当 向け。

- Path: `/admin/settings`
- Devices: Desktop
- Auth: admin required

## 概要

Setting レコードを編集する。保存時に `settings:updated` を即時配信する。

## UI 要素

- Form: storeName, closingTime, taxRateInHouse, taxRateTakeout
- Save button

## 連携する API・Socket

- `GET /api/settings`
- `PUT /api/settings`（`settings:updated` を emit）

参照: [Settings API](../api/endpoints/settings.md) / [WebSocket イベント](../api/websockets.md)

## 満たすべき条件

- 設定変更が保存され、Socket で配信される。
