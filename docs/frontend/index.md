---
type: Index
title: Frontend ガイド
description: フロントエンドの基底レイアウト、shared components、feature components の利用ガイド。
tags: [frontend, index, layout, components, features]
---

# Frontend ガイド

`frontend/src/layouts`、`frontend/src/components`、`frontend/src/features/*/components` の使い分けをまとめる。新規画面を追加する際の入口として使う。

## フォルダの役割

- `frontend/src/layouts`: ページ全体の骨格、ヘッダー・通知・余白・スクロール領域のような土台を管理する
- `frontend/src/components`: feature をまたいで再利用する shared UI を管理する
- `frontend/src/features/*/components`: feature 固有の文脈を持ち、同一 feature 内で再利用する UI を管理する
- `frontend/src/pages/*/components`: 単一画面でしか使わない page-local UI を管理する。この配置ルールは Feature Components ガイドの中で扱う

- [基底ページ / Layouts](base-layouts.md) — `PageLayout` / `CustomerPageLayout` / `PlatformPageLayout` の責務と選び方
- [Shared Components ガイド](shared-components.md) — `components/primitives` / `components/composite` / `components/feedback` の配置ルールと利用場面
- [Feature Components ガイド](feature-components.md) — `features/*/components` の配置ルールと、page-local / shared との境界
