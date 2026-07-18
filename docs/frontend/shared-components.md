---
type: Frontend Guide
title: Shared Components ガイド
description: `frontend/src/components` 配下の shared UI の配置ルールと推奨利用場面を整理したガイド。
resource: ../../frontend/src/components
tags: [frontend, components, shared, ui]
---

# Shared Components ガイド

`frontend/src/components` に置く shared UI の使い分けをまとめる。ここに置くのは、feature をまたいで再利用され、文脈依存が薄い UI に限る。

## 関連ドキュメント

- [Frontend ガイド](index.md): 全体の入口と各フォルダの役割
- [Feature Components ガイド](feature-components.md): feature 固有 UI と page-local UI との境界
- [基底ページ / Layouts](base-layouts.md): `ToastStack`、`NoticeBanner` をどの layout が常設するか

## 配置ルール

- `components/primitives`: button, icon, simple controls のような薄い再利用部品
- `components/composite`: modal, tab, slide-up footer のような複合 UI
- `components/feedback`: toast, load error, banner, error boundary のような通知・障害系 UI

同一 feature の中でしか意味を持たない UI は `features/*/components` に置く。単一画面でしか使わない UI は、その画面配下の `components/` に置く。

## Import ルール

- shared UI は `@/components/primitives` / `@/components/composite` / `@/components/feedback` のサブパス import を使う
- `@/components` の一括 import は、新規コードでは使わない

## Components / Primitives

| Component | 推奨用途 | 避けたい使い方 | 主な使用箇所 |
|---|---|---|---|
| `BaseButton` | 既定 variant を使う通常ボタン全般 | アイコン専用ボタン、カード型ナビゲーション | 画面全体で広く使用 |
| `IconButton` | アイコン主体の小さな操作。閉じる、戻る、ベル、会計など | ラベル主体の主要 CTA | `AppHeader`, `OrderHistory`, `CustomerOrder` |
| `Icon` | SVG/PNG を `currentColor` で扱いたいアイコン表示 | 装飾画像、写真、alt が必要な意味画像 | 全体で広く使用 |
| `QuantityPicker` | 人数や取消数量のような、最小値/最大値を持つ数値入力 | 商品一覧で高速に個数を足し引きする用途 | `CreateGroupSheet`, `CancelModal`, `CourseConfirmModal` |
| `ToggleButtonGroup` | 少数の排他的モード切替。表示切替、税込/税別、ランキング軸 | 選択肢が多いフィルタ、複数選択 UI | `Kitchen`, `Settings`, `DailyReport` |
| `ZeroStartStepper` | 0 個状態から加算を始める軽量ステッパー | 最小値 1 の人数入力、広い説明付き数量入力 | `MenuAdd`, `CustomerMenuList`, `CourseModal` |

## Components / Composite

| Component | 推奨用途 | 避けたい使い方 | 主な使用箇所 |
|---|---|---|---|
| `BottomSheet` | ボトムシート見た目だけを再利用したい時。独自構造のシート本文 | そのまま確認ダイアログを作る用途 | `BottomSheetModal`, `SeatLayout/EditSheet` |
| `BottomSheetModal` | 確認、破壊的操作確認、簡易フォーム、スクロール付き詳細確認 | 複雑な多項目入力フォーム全般 | セッション確認、QR、キャンセル、商品/コース削除確認など |
| `FormSheetModal` | 保存/キャンセルを持つ多項目フォームのボトムシート | 単一入力、単純な yes/no 確認 | `StoreFormModal`, `StaffFormModal` |
| `InputModal` | 単一文字列の追加/編集/削除 | 複数項目フォーム、補助説明の多い入力 | 商品カテゴリ・サブカテゴリ CRUD |
| `MenuConfirmModal` | 注文明細と合計を確認して確定するフロー | 汎用確認ダイアログ、注文以外の明細確認 | `MenuAdd`, `CustomerOrder` |
| `SlideUpFooter` | モバイル向けの固定 CTA。選択中 items に対する「確認へ進む」など | 常時表示の情報バー、複数段の複雑なフッター | `MenuAdd`, `CreateGroupSheet`, `CustomerOrder` |
| `TabNavigation` | 少数タブの切替。横幅均等の上部タブ | ネストの深いタブ、多数タブ | `GroupDetail`, `CustomerOrder` |

## Components / Feedback

| Component | 推奨用途 | 避けたい使い方 | 主な使用箇所 |
|---|---|---|---|
| `ErrorBoundary` | アプリ全体の最上位で render crash を受け止める | 個別 widget ごとの局所フォールバック | `main.tsx` |
| `RetryableLoadError` | 初期ロード失敗でページ全体を再試行画面に切り替える | フィールド単位のエラー、保存失敗通知 | 多くのページの `if (loadError)` 分岐 |
| `NoticeBanner` | store 全体に見せる一時通知。タップで dismiss するもの | 永続メッセージ、詳細説明、複数通知の積み上げ | `PageLayout` |
| `Toast` | 単発のインライン/局所エラー表示。モーダル内や単画面の補助通知 | store 全体の積み上げ通知 | `LoginForm`, `BottomSheetModal`, `FormSheetModal`, `RetryableLoadError` |
| `ToastStack` | store 経由の全画面共通 toast 表示 | 局所的なフォームエラー表示 | 各 layout |

## Shared に上げる条件

1. 複数 feature から使われている
2. 特定の業務文脈を前提にしていない
3. props が feature 固有の型や文言に強く依存していない

## Shared から外す条件

1. 実質的に 1 つの feature でしか使っていない
2. 業務文脈を外すと component の意味が崩れる
3. 単一画面専用の分岐や文言が増えてきた

## 補足

- `Toast` と `ToastStack` は役割が異なる。単発エラーは `Toast`、store に積む全体通知は `useToastStore` + `ToastStack`
- 0 個状態から始める数量 UI は `QuantityPicker` ではなく `ZeroStartStepper` を優先する。0 個状態からの追加体験が前提だから
