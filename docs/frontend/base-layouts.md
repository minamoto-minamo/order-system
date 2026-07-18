---
type: Frontend Guide
title: 基底ページ / Layouts
description: 画面の土台として使う 3 つの Layout の責務と選び方。
resource: ../../frontend/src/layouts
tags: [frontend, layout, page]
---

# 基底ページ / Layouts

画面ルートは `frontend/src/App.tsx` で 3 つの layout に振り分けている。見た目の共通化だけでなく、Socket 接続時の通知方針もここで分けている。

## 関連ドキュメント

- [Shared Components ガイド](shared-components.md): `ToastStack`、`NoticeBanner` の役割と使い分け
- [Feature Components ガイド](feature-components.md): `AppHeader`、`ActionBar`、`NavDrawer` など layout の上に載せる文脈付き UI の扱い

## Layout 一覧

| Layout               | 主な対象                                       | 自動で提供するもの                                                          | 使わない方がよい場面                                |
| -------------------- | ---------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------- |
| `PageLayout`         | 店舗スタッフ/管理者向けの通常画面              | `ToastStack`、`NoticeBanner`、Socket エラー/切断通知、`staff:called` バナー | 未認証客画面、platform 管理画面                     |
| `CustomerPageLayout` | QR 注文などの客向け画面                        | `ToastStack`、Socket 接続/切断通知                                          | スタッフ向け画面、`staff:called` バナーが必要な画面 |
| `PlatformPageLayout` | `admin.<BASE_DOMAIN>` 配下の platform 管理画面 | `ToastStack` のみ                                                           | 店舗 tenant 画面、Socket 通知が必要な画面           |

## `PageLayout`

対象:

- `RequireAuth` を通る tenant 側の通常画面
- 例: ホーム、ホール、キッチン、グループ詳細、各管理画面

責務:

- `ToastStack` を常設して store の toast をどの画面でも表示できるようにする
- `NoticeBanner` を常設して `useBannerStore` のメッセージを上部バナーとして表示する
- Socket の `error`, `connect_error`, `disconnect`, `reconnect_failed` を監視して、接続系エラーを toast 表示する
- `staff:called` を受けてホール/全スタッフ向けのバナー表示を行う

推奨:

- tenant 画面で Socket 接続を前提に運用するページは基本的にこれを使う
- ページごとの差分は layout ではなく、中で `AppHeader` / `ActionBar` / `FooterBar` を組み合わせて作る

注意:

- `PageLayout` 自体はヘッダーやナビゲーションを描画しない。ヘッダーが必要なら各ページで `AppHeader` を明示的に置く
- `staff:called` は全 staff 向けの横断通知なので、客画面や platform 画面に流さない

## `CustomerPageLayout`

対象:

- 未認証ゲストが使う客向け画面
- 現状は `/order/:id`

責務:

- `ToastStack` を常設する
- Socket 接続/切断の失敗だけを toast 表示する

推奨:

- `group:join` で個別グループ room に join するようなページ
- tenant の UI を流用しつつ、スタッフ専用のバナーやナビゲーションを載せたくないページ

注意:

- `staff:called` バナーや Socket `error` ハンドリングは持たない
- 見た目の土台は最小限なので、画面側でヘッダーや固定フッターを組む前提

## `PlatformPageLayout`

対象:

- `admin.<BASE_DOMAIN>` 上の platform 管理画面
- 例: `/platform/stores`

責務:

- `ToastStack` を常設するのみ

推奨:

- platform API だけを使い、tenant Socket に依存しない画面
- platform 用 auth store を前提にした管理画面

注意:

- tenant 向け Socket リスナーや banner は持たない
- 客画面のようなゲスト Socket 前提のページにも使わない

## ルートとの対応

`frontend/src/App.tsx` では次のように使い分けている。

- `RequireAuth` 配下: `PageLayout`
- `ROUTES.customerOrderPattern`: `CustomerPageLayout`
- `RequirePlatformAuth` 配下: `PlatformPageLayout`

新規ルート追加時は、まず「tenant staff 画面か / customer 画面か / platform 画面か」で layout を決める。迷った場合は Socket の通知要件を見ると判断しやすい。
