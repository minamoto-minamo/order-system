# Phase 1 Data Model: デザイントークンのコントラストをWCAG AA基準に合わせて改善する

本フィーチャーはCSS変数（デザイントークン）とそれを参照するUIコンポーネントのクラス名のみを変更する。データベース・API・アプリケーション状態のスキーマ変更は発生しないため、対象外とする。

## 参考: 変更対象のデザイントークン（CSS変数）一覧

トークンは `frontend/src/styles/tailwind.css` の `@theme` ブロックで定義されるCSS変数であり、Tailwind CSS v4の仕組みにより自動的に `bg-*` / `text-*` / `border-*` ユーティリティクラスとして利用可能になる（別途 `tailwind.config.js` での登録は不要）。

| トークン名 | 種別 | 値 | 状態 |
|---|---|---|---|
| `--color-amber-bg` | 背景色 | `#fef9e8` | 既存（変更なし、takeoutボタンで新たに参照） |
| `--color-amber-border` | 枠線色 | `#fcd34d` | 既存（変更なし、takeoutボタンで新たに参照） |
| `--color-amber-fg` | 文字色 | `#92400e` | 既存（変更なし、takeoutボタンで新たに参照） |
| `--color-order-pending-fg` | 文字色 | `#8c5000` | **新規追加** |
| `--color-order-ready-fg` | 文字色 | `#8c4d04` | **新規追加** |

algorithm/計算根拠は `research.md` を参照。
