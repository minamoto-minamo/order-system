# Quickstart: デザイントークンのコントラストをWCAG AA基準に合わせて改善する

実装完了後、以下の手順で動作確認する。

## 前提

```bash
pnpm --filter frontend dev   # または pnpm dev（backendも同時起動）
```

## 1. テイクアウトボタンの確認

1. スタッフでログインし、任意のグループ詳細画面（`GroupDetail`）でメニュー追加画面を開く。
2. 注文タイプを「テイクアウト」に切り替える。
3. 画面下部の確定ボタン（`MenuAdd.tsx`）が、白背景＋オレンジ寄りの濃色文字＋淡い黄色背景（`amber-bg`/`amber-fg`/`amber-border`）で表示され、文字がはっきり読めることを目視確認する。
4. 同じ商品でテイクアウト注文確定モーダル（`MenuConfirmModal`）を開き、確定ボタンが同様の配色になっていることを確認する。

## 2. 注文ステータスバッジの確認

1. 任意のグループの注文履歴（`OrderHistory` / `OrderStatusBadge`）を開く。
2. 未調理（pending）状態の注文行のバッジ文字が、以前より明らかに濃い色で表示され、小さい文字サイズでも読み取れることを確認する。
3. 提供待ち（ready）状態の注文行についても同様に確認する。

## 3. コントラスト比の検証（任意・推奨）

ブラウザDevToolsのカラーピッカー（Chrome DevToolsのContrast ratio表示など）で、以下の組み合わせが4.5:1以上（目標5.5:1以上）であることを確認する:

- `amber-bg`（背景）× `amber-fg`（文字） — takeoutボタン
- `order-pending-bg`（背景）× `order-pending-fg`（文字） — 未調理バッジ
- `order-ready-bg`（背景）× `order-ready-fg`（文字） — 提供待ちバッジ

## 4. 既存機能への影響がないことの確認

- `bg-amber-bg border-amber-border text-amber-fg` パターンを使う既存箇所（`Kitchen/SidePanel.tsx`の`complete-btn`、`Toast`のdefaultバリアント等）の見た目が変わっていないこと。
- `order-pending` / `order-ready` トークン自体（バッジの背景色・枠線色）は変更していないため、バッジの背景色・枠線の見た目は変わらないこと。

## 5. 自動テスト

```bash
pnpm --filter frontend test
```

`BaseButton`（takeoutバリアント）と`OrderStatusBadge`（pending/ready）のレンダリング結果に、期待するトークンクラス（`bg-amber-bg`, `text-amber-fg`, `text-order-pending-fg`, `text-order-ready-fg`等）が含まれることを検証するテストが通ること。
