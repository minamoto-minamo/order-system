# Implementation Plan: デザイントークンのコントラストをWCAG AA基準に合わせて改善する

**Branch**: `001-color-contrast-aa` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-color-contrast-aa/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

設計レビューで指摘された2件のコントラスト不足（takeout系ボタンの白文字、order-pending/order-readyバッジ文字色）をWCAG AA基準（4.5:1以上、実装目標5.5:1以上）に適合させる。技術的アプローチは次の2点。(1) takeoutボタンは新規トークンを追加せず、既存の `amber-bg` / `amber-border` / `amber-fg` トークン（`frontend/src/styles/tailwind.css`）を再利用して「淡い背景＋濃色文字」パターンに切り替える。(2) `order-pending-fg`（`#8c5000`）/ `order-ready-fg`（`#8c4d04`）を新規CSS変数として追加し、`OrderStatusBadge` の文字色を差し替える。両方とも純粋なCSS変数追加とTailwindユーティリティクラスの置換のみで完結し、ロジック変更・API変更・データモデル変更は発生しない。

## Technical Context

**Language/Version**: TypeScript 5.x（React 18） / CSS（Tailwind CSS v4, `@theme` ブロックによるCSS変数ベースのトークン定義）

**Primary Dependencies**: React 18, Vite, Tailwind CSS v4（`@import "tailwindcss"` + `@theme` — 別途 `tailwind.config.js` は使用しない。`--color-*` 変数を `@theme` に追加すると自動的に `bg-*`/`text-*`/`border-*` ユーティリティが生成される）

**Storage**: N/A（見た目のみの変更。DB/API/状態管理に影響なし）

**Testing**: Jest + React Testing Library（`frontend/src/__tests__/`）。既存の `noticeAndStepper.test.tsx` が `toast.props.className).toContain('bg-amber-bg')` の形でクラス名アサーションを行っており、本フィーチャーも同様にレンダリング結果の `className` に期待トークンクラスが含まれることを確認する方式を踏襲する。色そのもの（コントラスト比の数値）はCSS変数定義時点で本plan.mdに算出根拠を記載し、実装時のコードレビュー・目視確認で担保する（自動テストでピクセル色を検証する仕組みは本プロジェクトに存在しないため新設しない）。

**Target Platform**: Webブラウザ（既存のfrontend SPA。デスクトップ/タブレット、店舗スタッフ向け画面）

**Project Type**: Web application（frontend + backend構成のうち、本フィーチャーは frontend のみが対象）

**Performance Goals**: N/A（CSS変数追加とクラス名置換のみ。ビルドサイズ・実行時パフォーマンスへの影響は無視できる）

**Constraints**: 既存の意味色トークンの命名パターン（`{name}` / `{name}-bg` / `{name}-border` / `{name}-fg`）を踏襲すること。ハードコードカラー（`#xxx`直書き）はコンポーネント側に書かないこと（`frontend/CLAUDE.md`のルール）。

**Scale/Scope**: 変更ファイルは3ファイル（`tailwind.css`, `OrderStatusBadge.tsx`, `BaseButton.tsx`）+ ドキュメント更新1ファイル（`frontend/CLAUDE.md`のトークン表）。新規追加コンポーネント・新規APIなし。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` はテンプレートのプレースホルダーのままで、本プロジェクト固有の原則は定義されていない（GATE対象なし）。代わりにリポジトリの `CLAUDE.md` / `frontend/CLAUDE.md` に記載された既存ルールを遵守する:

- 「ハードコードカラーは書かない。必ずトークンを使う」→ 遵守（新規トークンをCSS変数として`@theme`に追加し、コンポーネントはトークン参照のみ）
- 「低頻度・セマンティックカラーはトークンに追加してから使う」→ 遵守（`order-pending-fg`/`order-ready-fg`を`@theme`に追加）
- 「影響を最小化する」（ユーザーのグローバル指示）→ 遵守（指摘された3箇所以外の色・ロジックには触れない）

違反なし。Phase 0 に進む。

## Project Structure

### Documentation (this feature)

```text
specs/001-color-contrast-aa/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command) — 本フィーチャーはデータモデル変更がないため「対象外」の旨のみ記載
├── quickstart.md         # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

`contracts/` はAPI/外部インターフェース変更が存在しないため生成しない。

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── styles/
│   │   └── tailwind.css                                   # (1) order-pending-fg / order-ready-fg トークン追加
│   ├── components/primitives/button/
│   │   └── BaseButton.tsx                                  # (2) takeoutバリアントのクラス変更
│   └── pages/group/GroupDetail/components/
│       └── OrderStatusBadge.tsx                             # (3) order-pending/order-readyの文字色トークン差し替え
├── src/__tests__/                                           # (4) 新規/既存テストへのアサーション追加
└── CLAUDE.md                                                 # (5) セマンティックカラートークン表の更新（ドキュメント整合性維持）
```

**Structure Decision**: 既存の `frontend/` ワークスペース内で完結する変更。新規ディレクトリ・新規パッケージは作成しない。バックエンド（`backend/`）・共有型（`shared/`）への変更は不要。

## Phase 0: Outline & Research

`research.md` を参照。Technical Contextに `NEEDS CLARIFICATION` は残っていない（`/speckit-clarify` で3件のQ&Aとして解決済み）。

## Phase 1: Design & Contracts

`data-model.md`（対象外の旨を明記）、`quickstart.md`（手動検証手順）を生成する。`contracts/` はAPI変更がないため生成しない。

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified

違反なし。本セクションは該当なし。
