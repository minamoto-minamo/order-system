# Implementation Plan: 商品管理画面の削除操作に確認ステップを追加する

**Branch**: `001-products-delete-confirm` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-products-delete-confirm/spec.md`

## Summary

Products画面（`frontend/src/pages/admin/Products/`）の商品・小分類・カテゴリ削除は、編集モーダルの「削除」ボタンから確認なしに即実行される。本機能では、削除ボタンのタップ時に編集モーダルを閉じてから確認ステップ（`BottomSheetModal`）を表示し、明示的な確定操作を経てから既存の削除API呼び出し（`deleteCat`/`deleteSub`/`deleteProduct`）を実行するよう変更する。実装パターンは、同リポジトリの `frontend/src/pages/admin/Staff/Staff.tsx` が既に採用している「ページ状態としての削除対象（`deleteTarget`）＋独立した確認用 `BottomSheetModal`」をそのまま踏襲する。新規の共有コンポーネントは追加しない。

## Technical Context

**Language/Version**: TypeScript（プロジェクト共通設定に準拠）

**Primary Dependencies**: React 18, react-i18next（既存の `useTranslation`/`t()` を使用）、既存の `BottomSheetModal`（`frontend/src/components/composite/BottomSheetModal`）

**Storage**: N/A（フロントエンドのUI状態変更のみ。バックエンドAPI・DBスキーマの変更なし）

**Testing**: Jest（`pnpm --filter frontend test`）によるコンポーネント/ロジックの単体テスト。E2Eは対象外（Claude担当のE2E実行はplan外、Codex実行担当が単体テストを追加する）

**Target Platform**: Webブラウザ（既存のProducts管理画面と同一）

**Project Type**: Web application（frontend + backend の既存モノレポ構成。本機能は frontend のみ変更）

**Performance Goals**: N/A（既存の削除APIレイテンシに追加のオーバーヘッドを生まない。確認ステップはクライアント側の状態遷移のみ）

**Constraints**: 既存の `BottomSheetModal` コンポーネントのAPI（`primaryAction`/`secondaryAction`/`show`/`onClose`）をそのまま利用し、新規モーダル基盤を追加しない（spec.md Assumptions を参照）

**Scale/Scope**: `frontend/src/pages/admin/Products/Products.tsx` 1ファイルの状態管理変更と、`frontend/src/i18n/locales/ja.ts` への文言追加のみ。他画面（Staff、GroupDetail等）への影響なし

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` はテンプレートのまま未記入（プロジェクト固有の憲章は定義されていない）ため、本チェックは `CLAUDE.md` のコア原則（シンプル第一・手を抜かない・影響を最小化する・テストで検証する）に対する自己評価で代替する。

- **シンプル第一**: 新規の抽象化・共有コンポーネントを追加せず、既存の `BottomSheetModal` と `Staff.tsx` の確認パターンをそのまま再利用する。PASS。
- **手を抜かない**: カテゴリ・小分類の破壊的削除（カスケード）には、単純な確認文言では不十分なため配下データが失われる旨を明示する文言を要件化済み（spec.md FR-006）。PASS。
- **影響を最小化する**: 変更ファイルは `Products.tsx` と `ja.ts` の2ファイルに限定し、`InputModal`/`ProductModal`/`BottomSheetModal` などの既存共有コンポーネントのAPIは変更しない（`onDelete` の呼び出しタイミングのみを、Products.tsx側の呼び出し元で変更する）。PASS。
- **テストで検証する**: 変更対象（`deleteCat`/`deleteSub`/`deleteProduct` の呼び出しタイミングと確認ステップの状態遷移）に対する単体テストをCodex実行担当が追加する（tasks.md参照）。PASS。

違反なし。Complexity Trackingへの記載は不要。

## Project Structure

### Documentation (this feature)

```text
specs/001-products-delete-confirm/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

`contracts/` は作成しない。本機能はバックエンドAPI・外部インターフェースの変更を伴わないフロントエンドのみのUIフロー変更のため。

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── pages/admin/Products/
│   │   ├── Products.tsx                    # 変更対象: 削除確認の状態管理・確認モーダルの追加
│   │   └── components/
│   │       ├── types.ts                    # 変更対象: 削除確認用の型（DeleteTarget等）を追加
│   │       ├── ProductModal.tsx             # 変更なし（onDeleteの呼び出し元がタイミングを変更するのみ）
│   │       └── ... (CategorySidebar.tsx, ProductList.tsx は変更なし)
│   ├── components/composite/
│   │   ├── BottomSheetModal/               # 変更なし（既存コンポーネントをそのまま利用）
│   │   └── InputModal/                     # 変更なし（onDeleteの呼び出し元がタイミングを変更するのみ）
│   └── i18n/locales/ja.ts                  # 変更対象: productSettings配下に削除確認文言を追加
└── src/pages/admin/Products/*.test.tsx     # 新規: 削除確認フローの単体テスト（Codex実行担当が追加）
```

**Structure Decision**: 既存のWebアプリケーション構成（`frontend/` + `backend/` モノレポ）をそのまま利用。本機能は `frontend/src/pages/admin/Products/` 配下のページコンポーネントと `frontend/src/i18n/locales/ja.ts` のみを変更するフロントエンド限定の変更であり、新規ディレクトリ・新規共有コンポーネントは追加しない。

## Complexity Tracking

該当なし（Constitution Checkに違反なし）。
