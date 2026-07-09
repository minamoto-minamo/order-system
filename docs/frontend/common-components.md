---
type: Frontend Guide
title: 共通コンポーネント利用ガイド
description: `frontend/src/components` の公開コンポーネントを、推奨利用場面ごとに整理したガイド。
resource: ../../frontend/src/components
tags: [frontend, components, ui]
---

# 共通コンポーネント利用ガイド

`frontend/src/components/index.ts` から公開しているコンポーネントの使い分けをまとめる。推奨用途は実装責務と既存利用箇所を根拠にしている。

## Layout

| Component       | 推奨用途                                                                                | 避けたい使い方                                    | 主な使用箇所                                                      |
| --------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------- |
| `AppHeader`     | tenant 側の通常ページ上部。タイトル、パンくず、右アクション、NavDrawer 起点が必要な画面 | 客画面、platform 画面、ドロワー不要の簡易ヘッダー | `Home`, `Hall`, `Kitchen`, `GroupDetail`, 各 admin 画面           |
| `FooterBar`     | 画面最下部に常設する補助バー。編集中の状態や統計表示                                    | 主要 CTA の固定フッター。モーダルの action row    | `SeatLayout` の `StatsBar`                                        |
| `LoginForm`     | ユーザー名/パスワードの認証画面の全面フォーム                                           | 一般フォーム、項目数の多い設定フォーム            | `Login`, `PlatformLogin`                                          |
| `NavDrawer`     | tenant 側のモード切替、セッション管理、ログアウトを持つ共通ドロワー                     | platform 用メニュー、客画面メニュー               | `AppHeader` 経由で使用                                            |
| `SlideUpFooter` | モバイル向けの固定 CTA。選択中 items に対する「確認へ進む」など                         | 常時表示の情報バー、複数段の複雑なフッター        | `MenuAdd`, `CreateGroupSheet`, `CustomerOrder`                    |
| `SubHeader`     | `AppHeader` の直下に置く 2 カラムの補助操作帯                                           | 単独の主ヘッダー代替、長文説明帯                  | `Hall`, `Kitchen`, `Settings`, `SeatLayout`, `StoreList`, `Staff` |

## Modal

| Component          | 推奨用途                                                     | 避けたい使い方                         | 主な使用箇所                                            |
| ------------------ | ------------------------------------------------------------ | -------------------------------------- | ------------------------------------------------------- |
| `BottomSheet`      | ボトムシート見た目だけを再利用したい時。独自構造のシート本文 | そのまま確認ダイアログを作る用途       | `BottomSheetModal`, `SeatLayout/EditSheet`              |
| `BottomSheetModal` | 確認、破壊的操作確認、簡易フォーム、スクロール付き詳細確認   | 複雑な多項目入力フォーム全般           | セッション確認、QR、キャンセル、商品/コース削除確認など |
| `FormSheetModal`   | 保存/キャンセルを持つ多項目フォームのボトムシート            | 単一入力、単純な yes/no 確認           | `StoreFormModal`, `StaffFormModal`                      |
| `InputModal`       | 単一文字列の追加/編集/削除                                   | 複数項目フォーム、補助説明の多い入力   | 商品カテゴリ・サブカテゴリ CRUD                         |
| `MenuConfirmModal` | 注文明細と合計を確認して確定するフロー                       | 汎用確認ダイアログ、注文以外の明細確認 | `MenuAdd`, `CustomerOrder`                              |

## Controls

| Component           | 推奨用途                                                  | 避けたい使い方                             | 主な使用箇所                                            |
| ------------------- | --------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------- |
| `BaseButton`        | 既定の variant を使う通常ボタン全般                       | アイコン専用ボタン、カード型ナビゲーション | 画面全体で広く使用                                      |
| `IconButton`        | アイコン主体の小さな操作。閉じる、戻る、ベル、会計など    | ラベル主体の主要 CTA                       | `AppHeader`, `OrderHistory`, `CustomerOrder`            |
| `NavButton`         | モード選択や管理メニューのような「大きい遷移カード」      | 行内ボタン、フォーム送信                   | `Home`, `AdminMenu`                                     |
| `QuantityControl`   | 人数や取消数量のような、最小値/最大値を持つ数値入力       | 商品一覧で高速に個数を足し引きする用途     | `CreateGroupSheet`, `CancelModal`, `CourseConfirmModal` |
| `ToggleButtonGroup` | 少数の排他的モード切替。表示切替、税込/税別、ランキング軸 | 選択肢が多いフィルタ、複数選択 UI          | `Kitchen`, `Settings`, `DailyReport`                    |
| `MenuQtyStepper`    | 商品一覧で 0 個から加算していく軽量ステッパー             | 最小値 1 の人数入力、広い説明付き数量入力  | `MenuAdd`, `CustomerMenuList`, `CourseModal`            |

## Display

| Component            | 推奨用途                                                      | 避けたい使い方                                 | 主な使用箇所                                                   |
| -------------------- | ------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| `ErrorBoundary`      | アプリ全体の最上位で render crash を受け止める                | 個別 widget ごとの局所フォールバック           | `main.tsx`                                                     |
| `Icon`               | SVG/PNG を `currentColor` で扱いたいアイコン表示              | 装飾画像、写真、alt が必要な意味画像           | 全体で広く使用                                                 |
| `LoadError`          | 初期ロード失敗でページ全体を再試行画面に切り替える            | フィールド単位のエラー、保存失敗通知           | 多くのページの `if (loadError)` 分岐                           |
| `NoticeBanner`       | store 全体に見せる一時通知。タップで dismiss するもの         | 永続メッセージ、詳細説明、複数通知の積み上げ   | `PageLayout`                                                   |
| `OrderSection`       | 注文履歴をセクション単位で束ねる簡易ラッパ                    | 汎用カードセクション、フォームセクション       | `OrderHistory`, `CustomerOrderHistory`                         |
| `StatusBadge`        | `OrderItemStatus` を色付きで見せる時                          | グループ状態やセッション状態など別 enum の表示 | `OrderHistory`                                                 |
| `SubCategorySidebar` | 左側に固定するサブカテゴリの縦フィルタ                        | 多段ツリー、水平タブ                           | `MenuAdd`, `CustomerMenuList`                                  |
| `TabNavigation`      | 少数タブの切替。横幅均等の上部タブ                            | ネストの深いタブ、多数タブ                     | `GroupDetail`, `CustomerOrder`                                 |
| `Toast`              | 単発のインライン/局所エラー表示。モーダル内や単画面の補助通知 | store 全体の積み上げ通知                       | `LoginForm`, `BottomSheetModal`, `FormSheetModal`, `LoadError` |
| `ToastStack`         | store 経由の全画面共通 toast 表示                             | 局所的なフォームエラー表示                     | 各 layout                                                      |

## 選び方の目安

1. 画面全体の骨格なら `layouts/` を選ぶ
2. 確認・入力のオーバーレイなら `modal/` を選ぶ
3. ユーザー操作の最小単位なら `controls/` を選ぶ
4. 表示専用の再利用部品なら `display/` を選ぶ

## 補足

- `Toast` と `ToastStack` は役割が異なる。単発エラーは `Toast`、store に積む全体通知は `useToastStore` + `ToastStack`
- `AppHeader` を使うページでは、ナビゲーションやセッション操作は `NavDrawer` に寄せる前提で構成する
- 商品数量 UI は `QuantityControl` ではなく `MenuQtyStepper` を優先する。0 個状態からの追加体験が前提だから
