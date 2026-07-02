---
type: Screen
title: 画面一覧
description: order-system のフロントエンド全画面（S100〜S405）の一覧とナビゲーション。
---

# 画面一覧

order-system のフロントエンド画面を1画面=1ファイルで記述する。各ファイルは画面ID・パス・デバイス・認証要件・UI 要素・アクション・連携する API/Socket・満たすべき条件を含む。CLAUDE.md の画面一覧表と画面ID（S1xx / S2xx / S3xx / S4xx）で対応する。

| ID   | 画面                             | パス                                     |
|------|----------------------------------|------------------------------------------|
| S100 | [ホーム](home.md)                | `/`                                      |
| S101 | [ログイン](login.md)             | `/login`                                 |
| S102 | [グループ詳細](group-detail.md)  | `/hall/group/:id` `/kitchen/group/:id`   |
| S200 | [ホール](hall.md)                | `/hall`                                  |
| S300 | [キッチン](kitchen.md)           | `/kitchen`                               |
| S400 | [管理者メニュー](admin-menu.md)  | `/admin`                                 |
| S401 | [商品設定](admin-products.md)    | `/admin/products`                        |
| S402 | [席レイアウト設定](admin-seats.md) | `/admin/seats`                         |
| S403 | [日次レポート](admin-report.md)  | `/admin/report`                          |
| S404 | [詳細設定](admin-settings.md)    | `/admin/settings`                        |
| S405 | [スタッフ管理](admin-staff.md)   | `/admin/staff`                           |
