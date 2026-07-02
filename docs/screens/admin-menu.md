---
type: Screen
id: S400
title: 管理者メニュー
description: 商品設定・席設定・レポート・設定・スタッフの各管理画面へ遷移する管理者ダッシュボード。
resource: frontend/src/pages/admin/AdminMenu/AdminMenu.tsx
tags: [admin]
---

# 管理者メニュー

各管理画面へのナビゲーション。管理者・フロント実装者 向け。

- Path: `/admin`
- Devices: Desktop / Tablet
- Auth: admin required

## 概要

商品設定・席設定・レポート・設定・スタッフへのリンクを提供するダッシュボード。

## UI 要素

- 各管理機能のカード / リンク
- Quick status widgets（現在セッション、アラート）

各画面への遷移先:

- [商品設定](admin-products.md)
- [席レイアウト設定](admin-seats.md)
- [日次レポート](admin-report.md)
- [詳細設定](admin-settings.md)
- [スタッフ管理](admin-staff.md)

## 連携する API・Socket

- `GET /api/auth/me`（認証チェック）

参照: [Auth API](../api/endpoints/auth.md)

## 満たすべき条件

- 未認証・非管理者はリダイレクトされる。リンクで各画面に遷移可能。
