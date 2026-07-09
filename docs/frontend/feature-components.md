---
type: Frontend Guide
title: Feature Components ガイド
description: `frontend/src/features/*/components` 配下の文脈付き UI の配置ルールと推奨利用場面を整理したガイド。
resource: ../../frontend/src/features
tags: [frontend, features, components, ui]
---

# Feature Components ガイド

`frontend/src/features/*/components` は、同一 feature の複数画面で使うが shared には上げない UI を置く場所として扱う。feature の業務文脈を持つ UI を shared から切り離すための層。

## 関連ドキュメント

- [Frontend ガイド](index.md): 全体の入口と各フォルダの役割
- [Shared Components ガイド](shared-components.md): shared UI へ上げる条件と import ルール
- [基底ページ / Layouts](base-layouts.md): `AppHeader`、`ActionBar` をどの layout 上で使うか

## 配置ルール

- `features/*/components` には、その feature の用語、操作フロー、状態表現に依存する UI を置く
- feature をまたいで再利用しないものは shared に上げない
- 単一画面でしか使わない UI は、feature 配下ではなく、その画面配下の `components/` に置く

## Import ルール

- 文脈付き UI は `@/features/*/components` から import する
- shared UI が必要な場合だけ `@/components/primitives` / `@/components/composite` / `@/components/feedback` を使う

## Features / Auth

| Component | 推奨用途 | 避けたい使い方 | 主な使用箇所 |
|---|---|---|---|
| `LoginForm` | ユーザー名/パスワードの認証画面の全面フォーム | 一般フォーム、項目数の多い設定フォーム | `Login`, `PlatformLogin` |

## Features / Menu

| Component | 推奨用途 | 避けたい使い方 | 主な使用箇所 |
|---|---|---|---|
| `SubCategorySidebar` | メニュー画面で使う左側固定のサブカテゴリ縦フィルタ | 多段ツリー、水平タブ、汎用サイドバー | `MenuAdd`, `CustomerMenuList` |

## Features / Order

| Component | 推奨用途 | 避けたい使い方 | 主な使用箇所 |
|---|---|---|---|
| `OrderHistorySection` | 注文履歴をセクション単位で束ねる簡易ラッパ | 汎用カードセクション、フォームセクション | `OrderHistory`, `CustomerOrderHistory` |

## Features / Navigation

| Component | 推奨用途 | 避けたい使い方 | 主な使用箇所 |
|---|---|---|---|
| `AppHeader` | tenant 側の通常ページ上部。タイトル、パンくず、右アクション、NavDrawer 起点が必要な画面 | 客画面、platform 画面、ドロワー不要の簡易ヘッダー | `Home`, `Hall`, `Kitchen`, `GroupDetail`, 各 admin 画面 |
| `NavDrawer` | tenant 側のモード切替、セッション管理、ログアウトを持つ共通ドロワー | platform 用メニュー、客画面メニュー | `AppHeader` 経由で使用 |
| `NavigationCard` | モード選択や管理メニューのような「大きい遷移カード」 | 行内ボタン、フォーム送信 | `Home`, `AdminMenu` |
| `ActionBar` | 一覧や管理画面の補助操作帯。絞り込み、補助 CTA、右上操作の配置に使う | 単独の主ヘッダー代替、長文説明帯 | `Hall`, `Kitchen`, `Settings`, `SeatLayout`, `StoreList`, `Staff` |

## Feature に置く条件

1. 同一 feature 内の複数画面で使う
2. 業務文脈や feature 固有の語彙を含む
3. shared にすると抽象化が不自然になる

## Page 配下へ下げる条件

1. 1 画面でしか使っていない
2. props や表示文言がその画面専用である
3. 別画面での再利用予定がなく、共通化コストの方が高い

現状では `SeatLayout` 専用の `FooterBar` と `GroupDetail` 専用の注文ステータス badge を画面側へ寄せている。

## Shared へ上げる条件

1. 複数 feature にまたがって再利用される
2. feature 固有の状態や文言を取り除いても自然に成立する
3. import 先を `@/components/*` にしても責務がぶれない

## Layout と組み合わせる時の見方

- tenant staff 画面で使う `AppHeader` / `NavDrawer` は、まず [基底ページ / Layouts](base-layouts.md) で `PageLayout` 前提かを確認する
- `ActionBar` は tenant 専用 navigation ではなく、補助操作帯として platform 管理画面でも利用してよい
- customer 画面では tenant 向け navigation UI を持ち込まない

## 選び方の目安

1. 1 画面専用なら page 配下の `components/`
2. 同一 feature 内で再利用するなら `features/*/components`
3. feature をまたいで再利用し、文脈依存が薄いなら `components/*`
